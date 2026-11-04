import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/gmail/access", () => ({ getGmailReadAccess: vi.fn(), getGmailSendAccess: vi.fn() }));
vi.mock("@/lib/gmail/api", () => ({ gmailRequest: vi.fn() }));
vi.mock("@/lib/gmail/reply", () => ({ getReplyDraft: vi.fn() }));

import type { OutboundClaim, OutboundEmail, OutboundEmailRepository, OutboundResult } from "@/lib/repositories/outbound-email";
import { GmailAuthorizationError } from "@/lib/gmail/policy";
import { GmailSendError } from "@/lib/gmail/send-api";
import type { Client } from "@/lib/repositories/clients";
import type { User } from "@/lib/repositories/users";
import { EmailAttachmentError, type AttachmentManifestEntry } from "./email-attachments";
import { createOutboundEmailService, outboundPayloadHash, STALE_SENDING_MS, type OutboundEmailDeps } from "./outbound-email";

const ID = "11111111-2222-4333-8444-555555555555";
const NOW = Date.parse("2026-11-04T02:00:00.000Z");
const actor = { id: "actor-1", role: "Assistant", status: "Active" } as User;
const access = { accessToken: "token", googleSubject: "subject1", oauthClientId: "client1" };

function row(overrides: Partial<OutboundEmail> = {}): OutboundEmail {
  return {
    id: ID, communicationId: "comm-1", preparedBy: actor.id, actorId: actor.id, googleSubject: "subject1", oauthClientId: "client1",
    clientId: "client-1", origin: { type: "contact", clientId: "client-1" }, sourceKey: "contact:client:client-1:a@example.test",
    recipientEmail: "a@example.test", subject: "Hello", body: "Body", templateName: null, externalContactId: null, replyToMessageId: null,
    targetKind: "client", targetId: "client-1", rfcMessageId: `<crm.${ID}@pacificinsuranceph.com>`, inReplyTo: null, references: [],
    requestedThreadId: null, attachments: [], payloadHash: "a".repeat(64), generation: 0, repeatOf: null, state: "prepared",
    dispatchToken: null, dispatchStartedAt: null, acceptedAt: null, gmailMessageId: null, gmailThreadId: null, errorCode: null,
    providerHttpStatus: null, effectsAppliedAt: null, acceptanceMetadata: {}, createdAt: new Date(NOW - 1_000).toISOString(),
    ...overrides,
  };
}

/** Models the SQL contract: atomic single claim, token-checked finish, idempotent effects. */
function memoryRepository(initial: OutboundEmail) {
  let current = initial;
  const calls = { claim: 0, finish: [] as OutboundResult[], effects: 0, failPrepared: [] as string[] };
  const failures = { finish: false, effects: false };
  const repository: OutboundEmailRepository = {
    prepare: vi.fn(),
    get: async () => current,
    list: async () => [current],
    claim: async (): Promise<OutboundClaim> => {
      calls.claim++;
      if (current.state !== "prepared") return { claimed: false, dispatchToken: null, message: current, blockedBy: null, problem: null };
      current = { ...current, state: "sending", dispatchToken: "token-1", dispatchStartedAt: new Date(NOW).toISOString() };
      return { claimed: true, dispatchToken: "token-1", message: current, blockedBy: null, problem: null };
    },
    failPrepared: async (_actor, _id, code) => {
      calls.failPrepared.push(code);
      if (current.state === "prepared") current = { ...current, state: "failed", errorCode: code };
      return current;
    },
    finish: async (_id, token, result) => {
      calls.finish.push(result);
      if (failures.finish) throw new Error("db down");
      if (token !== current.dispatchToken) throw new Error("token");
      current = result.state === "accepted"
        ? { ...current, state: "accepted", gmailMessageId: result.gmailMessageId, gmailThreadId: result.gmailThreadId, acceptedAt: result.acceptedAt ?? null, errorCode: result.errorCode ?? null }
        : { ...current, state: result.state, errorCode: result.errorCode };
      return current;
    },
    applyEffects: async () => {
      calls.effects++;
      if (failures.effects) throw new Error("effects failed");
      if (current.state === "accepted" && !current.effectsAppliedAt) current = { ...current, effectsAppliedAt: new Date(NOW).toISOString() };
      return current;
    },
  };
  return { repository, calls, failures, read: () => current };
}

function service(store: ReturnType<typeof memoryRepository>, overrides: Partial<OutboundEmailDeps> = {}) {
  const send = vi.fn(async () => ({ gmailMessageId: "gm-1", gmailThreadId: "th-1" }));
  const gmailRead = vi.fn();
  const svc = createOutboundEmailService({
    repository: () => store.repository,
    sender: async () => actor,
    resolve: async (draft) => ({
      client: { id: "client-1" } as Client, origin: draft.origin, targetKind: "client", targetId: "client-1", summary: "s",
      recipient: draft.recipient, subject: draft.subject, externalContactId: null, inReplyTo: null, references: [],
      requestedThreadId: null, googleSubject: null, draft,
    }),
    loadReviewed: async () => [],
    resolveAttachments: async () => [],
    connection: async () => ({ googleSubject: "subject1", oauthClientId: "client1", status: "connected" }),
    sendAccess: async () => access,
    readAccess: async () => access,
    send,
    gmailRead,
    markReconnectRequired: vi.fn(async () => undefined),
    now: () => NOW,
    ...overrides,
  });
  return { svc, send, gmailRead };
}

describe("sendPrepared", () => {
  let store: ReturnType<typeof memoryRepository>;
  beforeEach(() => { store = memoryRepository(row()); });

  it("dispatches once when two callers compete for the same intent", async () => {
    const { svc, send } = service(store);
    const [first, second] = await Promise.all([svc.sendPrepared(ID), svc.sendPrepared(ID)]);
    expect(send).toHaveBeenCalledTimes(1);
    // The loser reports whatever the winner has recorded so far; it never dispatches or fails.
    expect([first.state, second.state].every((state) => state === "accepted" || state === "sending")).toBe(true);
    expect(store.calls.claim).toBe(2);
    expect(store.read().state).toBe("accepted");
    expect(store.calls.effects).toBe(1);
  });

  it("returns the accepted status for a replay without contacting Gmail again", async () => {
    const { svc, send } = service(store);
    await svc.sendPrepared(ID);
    const replay = await svc.sendPrepared(ID);
    expect(replay.state).toBe("accepted");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["timeout", new GmailSendError("unknown", "gmail_send_timeout"), "unknown"],
    ["ambiguous 5xx", new GmailSendError("unknown", "gmail_send_unknown", 503), "unknown"],
    ["malformed success", new GmailSendError("unknown", "gmail_send_invalid_response", 200), "unknown"],
    ["unexpected exception", new Error("socket"), "unknown"],
    ["proven rejection", new GmailSendError("failed", "gmail_send_rejected", 400), "failed"],
  ])("records %s truthfully and never retries", async (_label, error, state) => {
    const failing = vi.fn(async () => { throw error; });
    const { svc } = service(store, { send: failing });
    const view = await svc.sendPrepared(ID);
    expect(view.state).toBe(state);
    expect(store.read().state).toBe(state);
    expect(store.calls.finish).toHaveLength(1);
    expect(failing).toHaveBeenCalledTimes(1);
    expect(store.calls.effects).toBe(0);
  });

  it("marks the connection for reconnect on an explicit 401 while keeping the send outcome", async () => {
    const mark = vi.fn(async () => undefined);
    const { svc } = service(store, { send: vi.fn(async () => { throw new GmailSendError("failed", "gmail_send_auth_required", 401); }), markReconnectRequired: mark });
    expect((await svc.sendPrepared(ID)).state).toBe("failed");
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it("reports an uncertain outcome, never failure, when persisting Gmail's acceptance fails", async () => {
    store.failures.finish = true;
    const { svc, send } = service(store);
    const view = await svc.sendPrepared(ID);
    expect(view.state).toBe("unknown");
    expect(view.errorCode).toBe("gmail_send_persistence_unavailable");
    expect(view.canRepeat).toBe(false);
    // The ledger still shows the dispatch; another click cannot resend.
    store.failures.finish = false;
    expect((await svc.sendPrepared(ID)).state).toBe("sending");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps an accepted send visibly sent with pending effects, and status checks only retry the effects", async () => {
    store.failures.effects = true;
    const { svc, send, gmailRead } = service(store);
    const view = await svc.sendPrepared(ID);
    expect(view).toMatchObject({ state: "accepted", effectsPending: true, canRepeat: false });
    store.failures.effects = false;
    const checked = await svc.check(ID);
    expect(checked).toMatchObject({ state: "accepted", effectsPending: false });
    expect(send).toHaveBeenCalledTimes(1);
    expect(gmailRead).not.toHaveBeenCalled();
  });

  it("fails before dispatch when a reviewed attachment changed", async () => {
    const { svc, send } = service(store, { loadReviewed: async () => { throw new EmailAttachmentError("changed", "unavailable"); } });
    const view = await svc.sendPrepared(ID);
    expect(view.state).toBe("failed");
    expect(store.calls.failPrepared).toEqual(["gmail_send_attachment_unavailable"]);
    expect(store.calls.claim).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("leaves the intent ready when Google is transiently unreachable before claim", async () => {
    const { svc, send } = service(store, { sendAccess: async () => { throw new GmailAuthorizationError("provider_unavailable", false); } });
    await expect(svc.sendPrepared(ID)).rejects.toThrow("Nothing was sent");
    expect(store.read().state).toBe("prepared");
    expect(store.calls.claim).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("records a revoked grant as not sent without claiming", async () => {
    const { svc } = service(store, { sendAccess: async () => { throw new GmailAuthorizationError("invalid_grant", true); } });
    expect((await svc.sendPrepared(ID)).state).toBe("failed");
    expect(store.calls.failPrepared).toEqual(["gmail_send_auth_required"]);
  });
});

describe("check (reconciliation)", () => {
  // Gmail rewrites Message-ID on send; only the server-built intent header identifies the copy.
  const sentMessage = (overrides: Record<string, unknown> = {}, headers: Record<string, string> = {}) => ({
    id: "gm-9", threadId: "th-9", internalDate: String(NOW - 60_000), labelIds: ["SENT"],
    payload: { headers: Object.entries({ "Message-Id": "<gmail-assigned@mail.gmail.com>", "X-PIPH-Outbound-ID": ID, From: "Pacific Insurance PH <admin@pacificinsuranceph.com>", To: "a@example.test", Subject: "Hello", ...headers }).map(([name, value]) => ({ name, value })) },
    ...overrides,
  });
  const unrelated = { id: "gm-1", threadId: "th-1", labelIds: ["SENT"], payload: { headers: [{ name: "To", value: "a@example.test" }, { name: "Subject", value: "Other" }] } };

  /** The real reader is generic over parsed JSON; the fake returns provider-shaped JSON. */
  function fakeReader(fn: (path: string) => unknown) {
    const mock = vi.fn(async (path: string) => fn(path));
    const typed = mock as unknown as OutboundEmailDeps["gmailRead"];
    return { mock, typed };
  }

  it("finalizes an unknown send from exactly one matching SENT message using Gmail's original time", async () => {
    const store = memoryRepository(row({ state: "unknown", dispatchToken: "token-1", dispatchStartedAt: new Date(NOW - 600_000).toISOString(), errorCode: "gmail_send_timeout" }));
    const gmailRead = fakeReader((path) => path.startsWith("messages?") ? { messages: [{ id: "gm-1" }, { id: "gm-9" }] } : path.startsWith("messages/gm-1") ? unrelated : sentMessage());
    const { svc, send } = service(store, { gmailRead: gmailRead.typed });
    const view = await svc.check(ID);
    expect(view.state).toBe("accepted");
    expect(store.calls.finish[0]).toMatchObject({ state: "accepted", gmailMessageId: "gm-9", occurredAt: new Date(NOW - 60_000).toISOString() });
    const started = Math.floor((NOW - 600_000) / 1000);
    expect(gmailRead.mock.mock.calls[0][0]).toBe(`messages?q=${encodeURIComponent(`in:sent to:a@example.test after:${started - 600} before:${started + 172_800}`)}&includeSpamTrash=true&maxResults=100`);
    expect(send).not.toHaveBeenCalled();
    expect(store.calls.effects).toBe(1);
  });

  it.each([
    ["no search results", () => ({ messages: [] })],
    ["a match without the SENT label", (path: string) => path.startsWith("messages?") ? { messages: [{ id: "gm-9" }] } : sentMessage({ labelIds: ["INBOX"] })],
    ["only unrelated sent mail in the window", (path: string) => path.startsWith("messages?") ? { messages: [{ id: "gm-1" }] } : unrelated],
    ["a copy with this ID but a different recipient", (path: string) => path.startsWith("messages?") ? { messages: [{ id: "gm-9" }] } : sentMessage({}, { To: "other@example.test" })],
    ["two copies with this ID", (path: string) => path.startsWith("messages?") ? { messages: [{ id: "gm-9" }, { id: "gm-10" }] } : sentMessage()],
  ])("keeps the outcome unknown with %s and never sends", async (_label, reader) => {
    const store = memoryRepository(row({ state: "unknown", dispatchToken: "token-1", dispatchStartedAt: new Date(NOW - 600_000).toISOString() }));
    const { svc, send } = service(store, { gmailRead: fakeReader(reader).typed });
    const view = await svc.check(ID);
    expect(view.state).toBe("unknown");
    expect(view.canRepeat).toBe(false);
    expect(view.notice).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
    expect(store.calls.finish.every((result) => result.state !== "failed")).toBe(true);
  });

  it("explicitly marks a stale sending row unknown and never re-claims it", async () => {
    const store = memoryRepository(row({ state: "sending", dispatchToken: "token-1", dispatchStartedAt: new Date(NOW - STALE_SENDING_MS - 1).toISOString() }));
    const { svc, send } = service(store, { gmailRead: fakeReader(() => ({ messages: [] })).typed });
    expect((await svc.get(ID)).state).toBe("unknown");
    const view = await svc.check(ID);
    expect(view.state).toBe("unknown");
    expect(store.read().state).toBe("unknown");
    expect(store.calls.claim).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("does not reconcile a send that is still within its dispatch window", async () => {
    const store = memoryRepository(row({ state: "sending", dispatchToken: "token-1", dispatchStartedAt: new Date(NOW - 5_000).toISOString() }));
    const gmailRead = vi.fn();
    const { svc } = service(store, { gmailRead });
    expect((await svc.check(ID)).state).toBe("sending");
    expect(gmailRead).not.toHaveBeenCalled();
  });
});

describe("outboundPayloadHash", () => {
  const attachment: AttachmentManifestEntry = { source: { type: "document", id: "d1" }, fileName: "a.pdf", mimeType: "application/pdf", size: 3, sha256: "b".repeat(64) };
  const input = {
    origin: { type: "renewal_draft" as const, id: "r1", updatedAt: "2026-11-01T00:00:00Z" }, clientId: "c", targetKind: "renewal", targetId: "r",
    recipient: "a@example.test", subject: "S", body: "B", templateName: null, externalContactId: null, inReplyTo: null, references: [],
    requestedThreadId: null, attachments: [attachment],
  };

  it("ignores optimistic-concurrency revisions so an explicit retry after a reviewed save keeps the same identity", () => {
    expect(outboundPayloadHash(input)).toBe(outboundPayloadHash({ ...input, origin: { ...input.origin, updatedAt: "2026-11-02T00:00:00Z" } }));
  });

  it("changes when any transmitted content or attachment bytes change", () => {
    const original = outboundPayloadHash(input);
    expect(outboundPayloadHash({ ...input, body: "B2" })).not.toBe(original);
    expect(outboundPayloadHash({ ...input, attachments: [{ ...attachment, sha256: "c".repeat(64) }] })).not.toBe(original);
    expect(outboundPayloadHash({ ...input, recipient: "b@example.test" })).not.toBe(original);
  });
});
