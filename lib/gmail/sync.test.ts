import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InboxSyncState, IncomingMessage, InboxMessage } from "@/lib/repositories/inbox/inbox.entity";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ repository: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/repositories/inbox", () => ({ getInboxRepository: mocks.repository }));
vi.mock("./access", () => ({ getGmailReadAccess: mocks.access }));
vi.mock("./inbox-config", () => ({ getGmailInboxConfig: () => ({ topicName: "projects/pacific-insurane-ph/topics/pacific-gmail-inbox" }) }));

import { enableGmailInbox, renewGmailInboxWatch, syncGmailInbox } from "./sync";
import { getGmailAttachment, gmailRequest } from "./api";
import { GmailAuthorizationError } from "./policy";

const access = { accessToken: "synthetic-secret-token", googleSubject: "subject1", oauthClientId: "client1" };
const boundary = Date.parse("2026-11-01T00:00:00.500Z");
function initialState(): InboxSyncState {
  return { googleSubject: "subject1", oauthClientId: "client1", enabledAt: new Date(boundary).toISOString(), historyId: "90071992547409931234", pageToken: null, recoveryHistoryId: null, watchExpiresAt: null, lastSyncedAt: null, lastError: null, pending: true, leaseToken: null, leaseUntil: null };
}
function message(id: string, received = boundary) {
  return { id, threadId: "thread1", internalDate: String(received), labelIds: ["INBOX"], payload: { partId: "", mimeType: "text/plain", headers: [{ name: "From", value: "client@example.test" }], body: { data: Buffer.from(`Evidence ${id}`).toString("base64url"), size: Buffer.byteLength(`Evidence ${id}`) } } };
}

type Commit = { leaseToken: string; messages: IncomingMessage[]; historyId: string; pageToken: string | null; recoveryHistoryId: string | null; complete: boolean };
// Behavioral persistence model: enforces the lease and non-advancing cursor; rows survive restarts.
function memoryStore(start: InboxSyncState | null = initialState()) {
  let state = start;
  const rows = new Map<string, IncomingMessage>();
  const commits: Commit[] = [];
  let busy = false;
  const repository = {
    getSyncState: vi.fn(async () => state ? { ...state } : null),
    enableSync: vi.fn(async (input: { googleSubject: string; oauthClientId: string; historyId: string; enabledAt: string; watchExpiresAt: string | null }, actorId: string) => {
      if (actorId !== "admin") throw new Error("forbidden");
      if (!state) state = { ...initialState(), ...input };
      return { ...state };
    }),
    claimSync: vi.fn(async (leaseToken: string) => {
      if (!state || busy || state.leaseToken) return null;
      state.leaseToken = leaseToken;
      return { ...state };
    }),
    commitSync: vi.fn(async (input: Commit) => {
      if (!state || state.leaseToken !== input.leaseToken) throw new Error("lease_lost");
      if (!input.complete && input.historyId !== state.historyId) throw new Error("early_cursor_advance");
      for (const row of input.messages) if (!rows.has(row.gmailMessageId)) rows.set(row.gmailMessageId, row);
      commits.push(input);
      state.pageToken = input.pageToken;
      state.recoveryHistoryId = input.recoveryHistoryId;
      if (input.complete) { state.historyId = input.historyId; state.leaseToken = null; }
    }),
    releaseSync: vi.fn(async (token: string, code: string | null) => {
      if (state?.leaseToken === token) { state.leaseToken = null; state.lastError = code; }
    }),
    updateWatch: vi.fn(async (_subject: string, expiry: string) => { if (state) state.watchExpiresAt = expiry; }),
  };
  mocks.repository.mockReturnValue(repository);
  return { repository, rows, commits, state: () => state, setBusy: () => { busy = true; } };
}

function provider(handler: (url: URL, init: RequestInit | undefined) => Response | Promise<Response>) {
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => handler(new URL(String(input)), init));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue(access); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("bounded durable Gmail ingestion", () => {
  it("performs no OAuth/provider reads or implicit activation while disabled", async () => {
    memoryStore(null);
    const fetcher = provider(() => { throw new Error("must_not_read"); });
    expect(await syncGmailInbox()).toEqual({ processed: 0, complete: true, busy: false });
    await renewGmailInboxWatch();
    expect(mocks.access).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports busy accurately and cannot cross a mailbox identity boundary", async () => {
    const store = memoryStore(); store.setBusy();
    const fetcher = provider(() => { throw new Error("must_not_read"); });
    expect(await syncGmailInbox()).toEqual({ processed: 0, complete: false, busy: true });
    expect(mocks.access).not.toHaveBeenCalled();
    const mismatched = memoryStore();
    mocks.access.mockResolvedValue({ ...access, googleSubject: "different" });
    await expect(syncGmailInbox()).rejects.toThrow("identity_mismatch");
    expect(mismatched.state()).toMatchObject({ leaseToken: null, lastError: "identity_mismatch" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["read_permission_required", "invalid_grant", "invalid_token"])("persists %s authorization loss and releases the lease without reading mail", async (code) => {
    const store = memoryStore();
    const fetcher = provider(() => { throw new Error("must_not_read"); });
    mocks.access.mockRejectedValue(new GmailAuthorizationError(code, code !== "read_permission_required"));
    await expect(syncGmailInbox()).rejects.toThrow(code);
    expect(store.state()).toMatchObject({ leaseToken: null, lastError: code, historyId: "90071992547409931234", pageToken: null });
    expect(store.rows.size).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not persist arbitrary authorization exception codes or sensitive exception text", async () => {
    const store = memoryStore();
    mocks.access.mockRejectedValue(new GmailAuthorizationError("synthetic-secret-token", false));
    await expect(syncGmailInbox()).rejects.toThrow("gmail_sync_failed");
    expect(store.state()).toMatchObject({ leaseToken: null, lastError: "gmail_sync_failed" });
  });

  it("deduplicates additions, ignores outgoing/deleted mail, and commits the decimal cursor only after durable rows", async () => {
    const store = memoryStore();
    provider((url) => {
      if (url.pathname.endsWith("/history")) return Response.json({ historyId: "90071992547409931299", history: [{ messages: [{ id: "notAnAddition" }], messagesAdded: [{ message: { id: "a" } }, { message: { id: "a" } }, { message: { id: "sent" } }, { message: { id: "gone" } }] }] });
      if (url.pathname.endsWith("/a")) return Response.json(message("a"));
      if (url.pathname.endsWith("/sent")) return Response.json({ ...message("sent"), labelIds: ["SENT"] });
      if (url.pathname.endsWith("/gone")) return new Response("", { status: 404 });
      throw new Error("unexpected_request");
    });
    expect(await syncGmailInbox()).toEqual({ processed: 1, complete: true, busy: false });
    expect([...store.rows.keys()]).toEqual(["a"]);
    expect(store.commits.slice(0, -1).every((entry) => entry.historyId === "90071992547409931234" && !entry.complete)).toBe(true);
    expect(store.state()?.historyId).toBe("90071992547409931299");
  });

  it("reconciles new mail when watch registration fails without replacing the saved history boundary", async () => {
    const store = memoryStore();
    provider((url) => {
      if (url.pathname.endsWith("/watch")) return new Response("", { status: 503 });
      if (url.pathname.endsWith("/history")) return Response.json({ historyId: "90071992547409931299", history: [{ messagesAdded: [{ message: { id: "a" } }] }] });
      if (url.pathname.endsWith("/a")) return Response.json(message("a"));
      throw new Error("unexpected_request");
    });
    expect(await syncGmailInbox({ renewWatch: true })).toMatchObject({ processed: 1, complete: true, busy: false, watchRenewalError: "gmail_api_503" });
    expect([...store.rows.keys()]).toEqual(["a"]);
    expect(store.state()).toMatchObject({ historyId: "90071992547409931299", leaseToken: null });
  });

  it("includes token refresh and watch renewal in one deadline and resumes without using the watch cursor", async () => {
    const store = memoryStore();
    let clock = boundary;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    mocks.access.mockImplementation(async () => { clock += 24_000; return access; });
    provider((url) => {
      if (url.pathname.endsWith("/watch")) {
        clock += 10_000;
        return Response.json({ historyId: "90071992547409939999", expiration: String(boundary + 7 * 86400_000) });
      }
      if (url.pathname.endsWith("/history")) return Response.json({ historyId: "90071992547409931299", history: [] });
      throw new Error("unexpected_request");
    });
    expect(await syncGmailInbox({ renewWatch: true })).toMatchObject({ complete: false, busy: false });
    expect(store.state()).toMatchObject({ historyId: "90071992547409931234", pageToken: null, leaseToken: null });
    expect(await syncGmailInbox()).toMatchObject({ complete: true, busy: false });
    expect(store.state()?.historyId).toBe("90071992547409931299");
  });

  it("resumes within a frozen candidate page after the time budget without rereading successful bodies", async () => {
    const store = memoryStore();
    let now = boundary;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const readIds: string[] = [];
    provider((url) => {
      now += 12_000;
      if (url.pathname.endsWith("/history")) return Response.json({ historyId: "90071992547409931300", history: [{ messagesAdded: ["a", "b", "c", "d"].map((id) => ({ message: { id } })) }] });
      const id = url.pathname.split("/").at(-1)!;
      readIds.push(id);
      return Response.json(message(id));
    });
    expect(await syncGmailInbox()).toEqual({ processed: 2, complete: false, busy: false });
    expect(store.state()?.historyId).toBe("90071992547409931234");
    expect(store.state()?.pageToken).not.toBeNull();
    expect(await syncGmailInbox()).toEqual({ processed: 2, complete: true, busy: false });
    expect(readIds).toEqual(["a", "b", "c", "d"]);
    expect(store.rows.size).toBe(4);
  });

  it("keeps failed candidates and cursor intact so retry cannot skip a message", async () => {
    const store = memoryStore();
    let fail = true;
    provider((url) => {
      if (url.pathname.endsWith("/history")) return Response.json({ historyId: "99999999999999999999", history: [{ messagesAdded: [{ message: { id: "a" } }, { message: { id: "b" } }] }] });
      if (url.pathname.endsWith("/b") && fail) return new Response("PII provider detail", { status: 503 });
      return Response.json(message(url.pathname.split("/").at(-1)!));
    });
    await expect(syncGmailInbox()).rejects.toThrow("gmail_api_503");
    expect([...store.rows.keys()]).toEqual(["a"]);
    expect(store.state()).toMatchObject({ historyId: "90071992547409931234", lastError: "gmail_api_503", leaseToken: null });
    fail = false;
    expect(await syncGmailInbox()).toEqual({ processed: 1, complete: true, busy: false });
    expect([...store.rows.keys()]).toEqual(["a", "b"]);
  });

  it("recovers a 404 with paginated boundary filtering and the profile snapshot taken before listing", async () => {
    const store = memoryStore();
    const operations: string[] = [];
    provider((url) => {
      const last = url.pathname.split("/").at(-1)!;
      operations.push(last);
      if (last === "history") return new Response("", { status: 404 });
      if (last === "profile") return Response.json({ historyId: "90071992547409931400" });
      if (last === "messages") {
        expect(url.searchParams.get("q")).toBe(`after:${Math.floor(boundary / 1000) - 1}`);
        return Response.json(url.searchParams.has("pageToken") ? { messages: [{ id: "new" }] } : { messages: [{ id: "old" }, { id: "edge" }], nextPageToken: "second-page" });
      }
      return Response.json(message(last, last === "old" ? boundary - 1 : boundary));
    });
    expect(await syncGmailInbox()).toEqual({ processed: 2, complete: true, busy: false });
    expect(operations.slice(0, 3)).toEqual(["history", "profile", "messages"]);
    expect([...store.rows.keys()]).toEqual(["edge", "new"]);
    expect(store.state()).toMatchObject({ historyId: "90071992547409931400", pageToken: null, recoveryHistoryId: null });
    expect(store.commits.some((entry) => entry.recoveryHistoryId === "90071992547409931400" && entry.messages.length === 0)).toBe(true);
  });

  it("persists first enablement before watch and never performs a historical messages read", async () => {
    const store = memoryStore(null);
    const operations: string[] = [];
    provider((url) => {
      const operation = url.pathname.split("/").at(-1)!;
      operations.push(operation);
      if (operation === "profile") return Response.json({ historyId: "12345678901234567890" });
      expect(operation).toBe("watch");
      expect(store.state()).toMatchObject({ historyId: "12345678901234567890", pageToken: null });
      return Response.json({ historyId: "12345678901234567891", expiration: String(Date.now() + 86_400_000) });
    });
    await enableGmailInbox("admin");
    expect(operations).toEqual(["profile", "watch"]);
    expect(store.rows.size).toBe(0);
    expect(store.state()?.historyId).toBe("12345678901234567890");
    expect(store.repository.enableSync.mock.calls[0][1]).toBe("admin");
  });

  it("authorizes explicit enable before watch and never replaces an existing cursor with a watch cursor", async () => {
    const store = memoryStore();
    provider((url) => Response.json(url.pathname.endsWith("/profile") ? { historyId: "99999999999999999998" } : { historyId: "99999999999999999999", expiration: String(Date.now() + 86_400_000) }));
    await expect(enableGmailInbox("staff")).rejects.toThrow("forbidden");
    expect(store.repository.updateWatch).not.toHaveBeenCalled();
    await enableGmailInbox("admin");
    await renewGmailInboxWatch();
    expect(store.state()?.historyId).toBe("90071992547409931234");
    expect(store.state()?.enabledAt).toBe(new Date(boundary).toISOString());
    expect(store.state()?.watchExpiresAt).not.toBeNull();
  });
});

describe("Gmail HTTP security boundary", () => {
  it.each(["https://evil.test/profile", "../messages/send", "/profile", "messages/send", "messages/a/modify", "messages/a?format=raw", "messages/a%2Fsend?format=full", "profile#fragment", "history?startHistoryId=123&historyTypes=messageDeleted"])("rejects non-read endpoint %s before authentication or fetch", async (path) => {
    const fetcher = provider(() => { throw new Error("must_not_fetch"); });
    await expect(gmailRequest(path)).rejects.toThrow("gmail_disallowed_request");
    expect(fetcher).not.toHaveBeenCalled();
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it("rejects all message mutation POSTs and unexpected watch body fields", async () => {
    const fetcher = provider(() => { throw new Error("must_not_fetch"); });
    await expect(gmailRequest("messages/send", { method: "POST", body: { raw: "synthetic" } })).rejects.toThrow("gmail_disallowed_request");
    await expect(gmailRequest("messages/a/modify", { method: "POST", body: { addLabelIds: ["STARRED"] } })).rejects.toThrow("gmail_disallowed_request");
    await expect(gmailRequest("watch", { method: "POST", body: { topicName: "projects/pacific-insurane-ph/topics/pacific-gmail-inbox", labelIds: ["INBOX"] } })).rejects.toThrow("gmail_disallowed_request");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("forces redirect rejection, no-store and timeout, and sanitizes provider errors", async () => {
    provider((_url, init) => {
      expect(init).toMatchObject({ redirect: "error", cache: "no-store", method: "GET" });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response("medical-body synthetic-secret-token", { status: 403 });
    });
    await expect(gmailRequest("profile")).rejects.toMatchObject({ status: 403, message: "gmail_provider_error" });
  });

  it("rejects attachment identity and actual byte mismatches and returns active formats as inert bytes", async () => {
    const stored = { googleSubject: "other-subject", gmailMessageId: "a", attachments: [{ partId: "1", attachmentId: "file1", fileName: "proof.html", mimeType: "text/html", size: 3 }] } as InboxMessage;
    const fetcher = provider(() => Response.json({ size: 3, data: Buffer.from("abc").toString("base64url") }));
    await expect(getGmailAttachment(stored, "1")).rejects.toThrow("gmail_identity_mismatch");
    expect(fetcher).not.toHaveBeenCalled();
    stored.googleSubject = access.googleSubject;
    expect(await getGmailAttachment(stored, "1")).toMatchObject({ bytes: Buffer.from("abc"), mimeType: "application/octet-stream" });
    stored.attachments[0].size = 4;
    await expect(getGmailAttachment(stored, "1")).rejects.toThrow("gmail_attachment_size_mismatch");
    await expect(getGmailAttachment(stored, "missing")).rejects.toThrow("gmail_attachment_not_found");
  });
});
