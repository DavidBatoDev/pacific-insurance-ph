import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ scoped: vi.fn(), access: vi.fn(), request: vi.fn() }));
vi.mock("./review", () => ({
  getScopedInboxMessage: mocks.scoped,
  InboxReviewError: class InboxReviewError extends Error { constructor(message: string, public status = 400) { super(message); } },
}));
vi.mock("./access", () => ({ getGmailReadAccess: mocks.access }));
vi.mock("./api", () => ({ gmailRequest: mocks.request }));

import { getReplyDraft, replyRecipient, replyReferences } from "./reply";

const linked = {
  id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", googleSubject: "subject1", gmailMessageId: "gm1", gmailThreadId: "th1",
  rfcMessageId: "<orig@example.test>", subject: "Re: Renewal — ñ", targetKind: "renewal", targetId: "t1", clientId: "c1",
};

function provider(headers: Record<string, string>, override: Record<string, unknown> = {}) {
  return { id: "gm1", threadId: "th1", payload: { headers: Object.entries(headers).map(([name, value]) => ({ name, value })) }, ...override };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.scoped.mockResolvedValue(linked);
  mocks.access.mockResolvedValue({ accessToken: "t", googleSubject: "subject1", oauthClientId: "c" });
});

describe("replyRecipient", () => {
  it("prefers a single Reply-To mailbox", () => expect(replyRecipient("Desk <Desk@Example.test>", "person@example.test")).toBe("desk@example.test"));
  it("falls back to From when Reply-To is absent", () => expect(replyRecipient(undefined, "Person <person@example.test>")).toBe("person@example.test"));
  it.each([
    ["a@example.test, b@example.test", "person@example.test"],
    ["not an address", "person@example.test"],
  ])("blocks ambiguous or invalid Reply-To %j instead of falling back", (replyTo, from) => expect(replyRecipient(replyTo, from)).toBeNull());
});

describe("replyReferences", () => {
  it("keeps distinct ordered references and appends the original ID last", () => {
    expect(replyReferences(["<a@x>", "<b@x>", "<a@x>", "<orig@x>"], "<orig@x>")).toEqual(["<a@x>", "<b@x>", "<orig@x>"]);
  });
  it("caps the chain at 100 IDs while keeping the newest", () => {
    const many = Array.from({ length: 150 }, (_, index) => `<r${index}@x>`);
    const result = replyReferences(many, "<orig@x>");
    expect(result).toHaveLength(100);
    expect(result.at(-1)).toBe("<orig@x>");
    expect(result[0]).toBe("<r51@x>");
  });
});

describe("getReplyDraft", () => {
  it("builds a threaded draft from the live provider headers and the unchanged subject", async () => {
    mocks.request.mockResolvedValue(provider({ From: "Person <person@example.test>", "Reply-To": "desk@example.test", "Message-ID": "<orig@example.test>", References: "<root@example.test> <mid@example.test>" }));
    await expect(getReplyDraft(linked.id)).resolves.toEqual({
      messageId: linked.id, clientId: "c1", targetKind: "renewal", targetId: "t1", googleSubject: "subject1",
      recipient: "desk@example.test", subject: "Re: Renewal — ñ", inReplyTo: "<orig@example.test>",
      references: ["<root@example.test>", "<mid@example.test>", "<orig@example.test>"], threadId: "th1",
    });
    expect(mocks.request).toHaveBeenCalledWith("messages/gm1?format=full", expect.anything());
  });

  it("refuses unlinked correspondence before contacting Gmail", async () => {
    mocks.scoped.mockResolvedValue({ ...linked, targetId: null, targetKind: null, clientId: null });
    await expect(getReplyDraft(linked.id)).rejects.toThrow("Link this correspondence before replying.");
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("propagates revoked scope without contacting Gmail", async () => {
    mocks.scoped.mockRejectedValue(new Error("Correspondence not found."));
    await expect(getReplyDraft(linked.id)).rejects.toThrow("Correspondence not found.");
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it.each([
    ["missing Message-ID", provider({ From: "person@example.test" })],
    ["Message-ID that differs from the stored evidence", provider({ From: "person@example.test", "Message-ID": "<other@example.test>" })],
    ["ambiguous Reply-To", provider({ From: "person@example.test", "Reply-To": "a@example.test, b@example.test", "Message-ID": "<orig@example.test>" })],
    ["a different thread", provider({ From: "person@example.test", "Message-ID": "<orig@example.test>" }, { threadId: "other" })],
  ])("blocks %s", async (_label, payload) => {
    mocks.request.mockResolvedValue(payload);
    await expect(getReplyDraft(linked.id)).rejects.toThrow();
  });

  it("blocks when the connected mailbox identity differs", async () => {
    mocks.access.mockResolvedValue({ accessToken: "t", googleSubject: "someone-else", oauthClientId: "c" });
    await expect(getReplyDraft(linked.id)).rejects.toThrow("different mailbox");
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
