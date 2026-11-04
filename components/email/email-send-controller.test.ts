import { describe, expect, it, vi } from "vitest";

import type { EmailDraftSeed, EmailSendView } from "@/lib/communications/outbound-email.types";
import { draftKey, EmailSendController, type EmailSendApi, type IntentStore } from "./email-send-controller";

const draft: EmailDraftSeed = { origin: { type: "contact", clientId: "c1" }, recipient: "a@example.test", subject: "S", body: "B" };

function view(overrides: Partial<EmailSendView> = {}): EmailSendView {
  return {
    origin: draft.origin, id: "intent-1", communicationId: "comm", state: "prepared", recipient: "a@example.test", subject: "S", body: "B",
    attachments: [], errorCode: null, acceptedAt: null, gmailThreadId: null, effectsPending: false, threadMismatch: false, canRepeat: false,
    ...overrides,
  };
}

function memoryStore(): IntentStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: (key) => data.get(key) ?? null, set: (key, id) => { data.set(key, id); }, remove: (key) => { data.delete(key); } };
}

function api(overrides: Partial<EmailSendApi> = {}): EmailSendApi {
  return {
    prepare: vi.fn(async (input) => ({ ok: true as const, data: view({ id: input.intentId }) })),
    send: vi.fn(async (id) => ({ ok: true as const, data: view({ id, state: "accepted", gmailThreadId: "t" }) })),
    get: vi.fn(async (id) => ({ ok: true as const, data: view({ id }) })),
    check: vi.fn(async (id) => ({ ok: true as const, data: view({ id }) })),
    ...overrides,
  };
}

describe("EmailSendController", () => {
  it("ignores a second click while a send is in flight", async () => {
    let release!: () => void;
    const send = vi.fn(() => new Promise<{ ok: true; data: EmailSendView }>((resolve) => { release = () => resolve({ ok: true, data: view({ state: "accepted" }) }); }));
    const controller = new EmailSendController(api({ send }), memoryStore(), () => "intent-1");
    await controller.init("actor", draft.origin);
    await controller.review(draft);
    const first = controller.send();
    const second = controller.send();
    release();
    await Promise.all([first, second]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps the persisted intent after a lost send response and recovers its status without dispatching", async () => {
    const store = memoryStore();
    const send = vi.fn(async () => { throw new TypeError("network"); });
    const get = vi.fn(async (id: string) => ({ ok: true as const, data: view({ id, state: "unknown" }) }));
    const controller = new EmailSendController(api({ send, get }), store, () => "intent-1");
    await controller.init("actor", draft.origin);
    await controller.review(draft);
    await controller.send();
    expect(controller.getPhase()).toMatchObject({ kind: "lost", intentId: "intent-1", step: "send" });
    expect([...store.data.values()]).toEqual(["intent-1"]);
    await controller.check();
    expect(controller.getPhase()).toMatchObject({ kind: "view", view: { id: "intent-1", state: "unknown" } });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("reuses the same intent ID when a lost prepare is retried", async () => {
    const ids = ["first", "second"];
    const prepare = vi.fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockImplementation(async (input: { intentId: string }) => ({ ok: true, data: view({ id: input.intentId }) }));
    const controller = new EmailSendController(api({ prepare, get: vi.fn(async () => ({ ok: false as const, error: "Email not found." })) }), memoryStore(), () => ids.shift()!);
    await controller.init("actor", draft.origin);
    await controller.review(draft);
    await controller.check();
    expect(controller.getPhase()).toMatchObject({ kind: "lost", step: "prepare" });
    await controller.review(draft);
    expect(prepare.mock.calls.map(([input]) => input.intentId)).toEqual(["first", "first"]);
  });

  it("restores an unresolved send on remount instead of starting another", async () => {
    const store = memoryStore();
    store.set("crm-email-intent:actor:{\"clientId\":\"c1\",\"type\":\"contact\"}", "intent-old");
    const prepare = vi.fn();
    const controller = new EmailSendController(api({ prepare, get: vi.fn(async (id) => ({ ok: true as const, data: view({ id, state: "unknown" }) })) }), store, () => "new");
    await controller.init("actor", draft.origin);
    expect(controller.getPhase()).toMatchObject({ kind: "view", view: { id: "intent-old", state: "unknown" } });
    expect(prepare).not.toHaveBeenCalled();
  });

  it("invalidates a review when the draft is edited, and adopts the server's canonical ID", async () => {
    const store = memoryStore();
    const controller = new EmailSendController(api({ prepare: vi.fn(async () => ({ ok: true as const, data: view({ id: "canonical" }) })) }), store, () => "local");
    await controller.init("actor", draft.origin);
    await controller.review(draft);
    expect([...store.data.values()]).toEqual(["canonical"]);
    controller.invalidate(draftKey({ ...draft, body: "edited" }));
    expect(controller.getPhase()).toMatchObject({ kind: "idle" });
    expect(store.data.size).toBe(0);
  });

  it("fires onSent once, only for an acceptance with completed effects started in this mount", async () => {
    const onSent = vi.fn();
    const check = vi.fn(async (id: string) => ({ ok: true as const, data: view({ id, state: "accepted" }) }));
    const send = vi.fn(async (id: string) => ({ ok: true as const, data: view({ id, state: "accepted", effectsPending: true }) }));
    const controller = new EmailSendController(api({ send, check }), memoryStore(), () => "intent-1", onSent);
    await controller.init("actor", draft.origin);
    await controller.review(draft);
    await controller.send();
    expect(onSent).not.toHaveBeenCalled();
    await controller.check();
    await controller.check();
    expect(onSent).toHaveBeenCalledTimes(1);

    const restoredOnSent = vi.fn();
    const store = memoryStore();
    store.set("crm-email-intent:actor:{\"clientId\":\"c1\",\"type\":\"contact\"}", "old");
    const restored = new EmailSendController(api({ get: vi.fn(async (id) => ({ ok: true as const, data: view({ id, state: "accepted", effectsPending: true }) })) }), store, () => "x", restoredOnSent);
    await restored.init("actor", draft.origin);
    expect(restoredOnSent).not.toHaveBeenCalled();
  });
});
