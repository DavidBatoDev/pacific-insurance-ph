import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/gmail/access", () => ({ getGmailReadAccess: vi.fn(), getGmailSendAccess: vi.fn() }));
vi.mock("@/lib/gmail/api", () => ({ gmailRequest: vi.fn() }));
vi.mock("@/lib/gmail/reply", () => ({ getReplyDraft: vi.fn() }));

import type { OutboundEmail, OutboundEmailRepository } from "@/lib/repositories/outbound-email";
import type { User } from "@/lib/repositories/users";
import { OutboundEmailError } from "./outbound-email";
import { createSentEmailService, manilaRange, parseSelectedMessage, parseSentEmailFilters } from "./sent-email";
import { DEFAULT_SENT_EMAIL_FILTERS, sentEmailUrl, type SentEmailSummary } from "./sent-email.types";

const ID = "11111111-2222-4333-8444-555555555555";
const NOW = Date.parse("2026-11-19T02:00:00.000Z");
const actor = { id: "actor-1", role: "Assistant", status: "Active" } as User;

function rejects(params: Record<string, string | string[] | undefined>) {
  expect(() => parseSentEmailFilters(params)).toThrow(OutboundEmailError);
}

describe("parseSentEmailFilters", () => {
  it("defaults to accepted (Sent) mail, page 1, unbounded dates", () => {
    expect(parseSentEmailFilters({})).toEqual(DEFAULT_SENT_EMAIL_FILTERS);
  });

  it("accepts every allowlisted status and nothing else", () => {
    for (const status of ["sent", "all", "prepared", "sending", "failed", "unknown"]) {
      expect(parseSentEmailFilters({ status }).status).toBe(status);
    }
    rejects({ status: "accepted" });
    rejects({ status: "SENT" });
  });

  it("rejects repeated recognized parameters instead of picking one", () => {
    rejects({ status: ["sent", "all"] });
    rejects({ q: ["a", "b"] });
    expect(parseSentEmailFilters({ unrelated: ["x", "y"] }).status).toBe("sent");
  });

  it("validates real calendar days, including leap years", () => {
    expect(parseSentEmailFilters({ from: "2028-02-29" }).from).toBe("2028-02-29");
    rejects({ from: "2027-02-29" });
    rejects({ to: "2026-13-01" });
    rejects({ to: "2026-1-01" });
    rejects({ from: "2026-11-20", to: "2026-11-19" });
    expect(parseSentEmailFilters({ from: "2026-11-19", to: "2026-11-19" }).to).toBe("2026-11-19");
  });

  it("bounds the query and page", () => {
    expect(parseSentEmailFilters({ q: "  pacificcross  " }).query).toBe("pacificcross");
    expect(parseSentEmailFilters({ q: "x".repeat(200) }).query).toHaveLength(200);
    rejects({ q: "x".repeat(201) });
    expect(parseSentEmailFilters({ page: "2001" }).page).toBe(2001);
    rejects({ page: "2002" });
    rejects({ page: "0" });
    rejects({ page: "1.5" });
    rejects({ page: "-1" });
  });
});

describe("parseSelectedMessage", () => {
  it("distinguishes absent, valid and invalid selections", () => {
    expect(parseSelectedMessage({})).toBeNull();
    expect(parseSelectedMessage({ message: ID })).toBe(ID);
    expect(parseSelectedMessage({ message: "nope" })).toBe("invalid");
    expect(parseSelectedMessage({ message: [ID, ID] })).toBe("invalid");
  });
});

describe("manilaRange", () => {
  it("maps inclusive Philippine days to [midnight, next midnight) instants", () => {
    expect(manilaRange("2026-11-19", "2026-11-19")).toEqual({
      from: "2026-11-18T16:00:00.000Z",
      to: "2026-11-19T16:00:00.000Z",
    });
    expect(manilaRange("2028-02-29", "2028-02-29").to).toBe("2028-02-29T16:00:00.000Z");
    expect(manilaRange("2026-12-31", "2026-12-31").to).toBe("2026-12-31T16:00:00.000Z");
    expect(manilaRange(null, null)).toEqual({ from: null, to: null });
  });
});

describe("sentEmailUrl", () => {
  it("omits defaults and round-trips encoded filters through the parser", () => {
    expect(sentEmailUrl(DEFAULT_SENT_EMAIL_FILTERS)).toBe("/inbox/sent");
    const filters = { query: "100% a_b\\c & d", status: "unknown" as const, from: "2026-11-01", to: "2026-11-19", page: 3 };
    const url = sentEmailUrl(filters, ID);
    const params = Object.fromEntries(new URL(url, "http://x").searchParams);
    expect(parseSentEmailFilters(params)).toEqual(filters);
    expect(parseSelectedMessage(params)).toBe(ID);
  });
});

function summary(n: number): SentEmailSummary {
  return {
    id: `id-${n}`, clientId: "client-1", clientName: "A", clientReference: null, actorName: "Staff", recipient: "x@y.test",
    subject: "S", targetKind: "client", targetId: "client-1", originType: "contact", effectiveState: "accepted",
    occurredAt: "2026-11-19T00:00:00.000Z", createdAt: "2026-11-19T00:00:00.000Z", acceptedAt: null, attachmentCount: 0,
    effectsPending: false, threadMismatch: false,
  };
}

function repository(overrides: Partial<OutboundEmailRepository>): OutboundEmailRepository {
  const fail = () => { throw new Error("unexpected"); };
  return { prepare: fail, claim: fail, failPrepared: fail, finish: fail, applyEffects: fail, get: fail, list: fail, listAgency: fail, ...overrides };
}

describe("sentEmailService", () => {
  it("rejects non-senders before any repository read", async () => {
    const listAgency = vi.fn();
    const get = vi.fn();
    const service = createSentEmailService({
      sender: async () => { throw new OutboundEmailError("no", 403); },
      repository: () => repository({ listAgency, get }),
    });
    await expect(service.page(DEFAULT_SENT_EMAIL_FILTERS)).rejects.toMatchObject({ status: 403 });
    await expect(service.detail(ID)).rejects.toMatchObject({ status: 403 });
    expect(listAgency).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it("pages 50 rows using a lookahead row and Manila date bounds", async () => {
    const listAgency = vi.fn(async () => Array.from({ length: 51 }, (_, n) => summary(n)));
    const service = createSentEmailService({ sender: async () => actor, repository: () => repository({ listAgency }) });
    const result = await service.page({ query: "pc", status: "all", from: "2026-11-01", to: null, page: 3 });
    expect(listAgency).toHaveBeenCalledWith("actor-1", {
      query: "pc", status: "all", from: "2026-10-31T16:00:00.000Z", to: null, offset: 100,
    });
    expect(result.messages).toHaveLength(50);
    expect(result.hasNext).toBe(true);
    listAgency.mockResolvedValueOnce([summary(1)]);
    expect((await service.page(DEFAULT_SENT_EMAIL_FILTERS)).hasNext).toBe(false);
  });

  it("detail exposes the safe view only and never private ledger fields", async () => {
    const row = {
      id: ID, communicationId: "comm-1", preparedBy: "actor-1", actorId: "actor-1", googleSubject: "secret-subject",
      oauthClientId: "secret-client", clientId: "client-1", origin: { type: "submission", kind: "application", id: "app-1", contactId: "c" },
      sourceKey: "k", recipientEmail: "nb@pacificcross.com.ph", subject: "Submission", body: "Body", templateName: null,
      externalContactId: "c", replyToMessageId: null, targetKind: "application", targetId: "app-1", rfcMessageId: "<x>",
      inReplyTo: null, references: [], requestedThreadId: null, payloadHash: "a".repeat(64), generation: 0, repeatOf: null,
      attachments: [{ fileName: "a.pdf", mimeType: "application/pdf", size: 10, storagePath: "private/path", source: { type: "document", id: "d" } }],
      state: "sending", dispatchToken: "secret-token", dispatchStartedAt: new Date(NOW - 121_000).toISOString(), acceptedAt: null,
      gmailMessageId: null, gmailThreadId: null, errorCode: null, providerHttpStatus: null, effectsAppliedAt: null,
      acceptanceMetadata: {}, createdAt: new Date(NOW - 130_000).toISOString(),
    } as unknown as OutboundEmail;
    const service = createSentEmailService({
      sender: async () => actor, now: () => NOW,
      repository: () => repository({ get: async () => row }),
      clientLabel: async () => ({ name: "Juan Dela Cruz", referenceNo: "PI-1" }),
      userName: async () => "Eman",
    });
    const detail = await service.detail(ID);
    expect(detail.email.state).toBe("unknown");
    expect(detail.email.attachments).toEqual([{ fileName: "a.pdf", mimeType: "application/pdf", size: 10 }]);
    expect(detail).toMatchObject({ clientName: "Juan Dela Cruz", actorName: "Eman", targetKind: "application" });
    const json = JSON.stringify(detail);
    for (const secret of ["secret-token", "secret-subject", "secret-client", "private/path"]) expect(json).not.toContain(secret);
  });

  it("treats unavailable or malformed IDs as not found", async () => {
    const service = createSentEmailService({ sender: async () => actor, repository: () => repository({ get: async () => null }) });
    await expect(service.detail(ID)).rejects.toMatchObject({ status: 404 });
    await expect(service.detail("nope")).rejects.toMatchObject({ status: 404 });
  });
});
