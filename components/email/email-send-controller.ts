import type { ActionResult } from "@/lib/actions/context";
import type { EmailDraftSeed, EmailOrigin, EmailSendView, PrepareEmailInput } from "@/lib/communications/outbound-email.types";

/** Server actions the controller drives; injected so the state machine is testable without React. */
export interface EmailSendApi {
  prepare: (input: PrepareEmailInput) => Promise<ActionResult<EmailSendView>>;
  send: (id: string) => Promise<ActionResult<EmailSendView>>;
  get: (id: string) => Promise<ActionResult<EmailSendView>>;
  check: (id: string) => Promise<ActionResult<EmailSendView>>;
}

/** Only the active intent ID is persisted, never message content. */
export interface IntentStore {
  get: (key: string) => string | null;
  set: (key: string, id: string) => void;
  remove: (key: string) => void;
}

export type EmailSendPhase =
  | { kind: "idle"; message?: string }
  | { kind: "preparing" }
  | { kind: "view"; view: EmailSendView; draftKey: string | null; message?: string }
  | { kind: "sending"; view: EmailSendView; draftKey: string | null }
  | { kind: "checking"; view: EmailSendView; draftKey: string | null }
  /** The browser lost the server's answer; the persisted intent ID is the only recovery handle. */
  | { kind: "lost"; intentId: string; step: "prepare" | "send"; message?: string };

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Identity of the email's source; optimistic-concurrency revisions are not part of it. */
export function originKey(origin: EmailOrigin): string {
  return stable(origin.type === "renewal_draft" ? { type: origin.type, id: origin.id } : origin);
}

export function draftKey(draft: EmailDraftSeed): string {
  return stable(draft);
}

/** sessionStorage when available; blocked storage falls back to memory without disabling dedupe. */
export function browserIntentStore(): IntentStore {
  const memory = new Map<string, string>();
  const storage = (): Storage | null => {
    try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
  };
  return {
    get: (key) => {
      try { return storage()?.getItem(key) ?? memory.get(key) ?? null; } catch { return memory.get(key) ?? null; }
    },
    set: (key, id) => {
      memory.set(key, id);
      try { storage()?.setItem(key, id); } catch { /* memory copy retained */ }
    },
    remove: (key) => {
      memory.delete(key);
      try { storage()?.removeItem(key); } catch { /* memory copy removed */ }
    },
  };
}

const LOST_MESSAGE = "The server's answer did not arrive. Check the sending status before doing anything else.";

export class EmailSendController {
  private phase: EmailSendPhase = { kind: "idle" };
  private listeners = new Set<() => void>();
  /** Synchronous guard: a second click can never start a parallel request. */
  private busy = false;
  private key: string | null = null;
  /** Sends/checks started in this mounted instance; old accepted rows never fire callbacks. */
  private initiated = new Set<string>();
  private fired = new Set<string>();

  constructor(
    private readonly api: EmailSendApi,
    private readonly store: IntentStore,
    private readonly newId: () => string,
    private onSent?: (view: EmailSendView) => void,
  ) {}

  /** The mounted component supplies its latest callback; acceptance fires the current one. */
  setOnSent(onSent: ((view: EmailSendView) => void) | undefined): void {
    this.onSent = onSent;
  }

  getPhase = (): EmailSendPhase => this.phase;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private setPhase(phase: EmailSendPhase): void {
    this.phase = phase;
    for (const listener of this.listeners) listener();
  }

  private settle(view: EmailSendView, reviewed: string | null, message?: string): void {
    if (this.key) {
      if (view.state === "accepted" && !view.effectsPending) this.store.remove(this.key);
      else this.store.set(this.key, view.id);
    }
    this.setPhase({ kind: "view", view, draftKey: reviewed, ...(message ? { message } : {}) });
    if (view.state === "accepted" && !view.effectsPending && this.initiated.has(view.id) && !this.fired.has(view.id)) {
      this.fired.add(view.id);
      this.onSent?.(view);
    }
  }

  private async guarded(run: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try { await run(); } finally { this.busy = false; }
  }

  /** Restores the active intent for this actor + source instead of silently starting another. */
  init(actorId: string, origin: EmailOrigin): Promise<void> {
    this.key = `crm-email-intent:${actorId}:${originKey(origin)}`;
    const active = this.store.get(this.key);
    if (!active) return Promise.resolve();
    return this.guarded(async () => {
      try {
        const result = await this.api.get(active);
        if (result.ok) {
          if (result.data.state === "accepted" && !result.data.effectsPending) {
            this.store.remove(this.key!);
            return;
          }
          this.settle(result.data, null);
        } else {
          // Not found or no longer authorized: prepare never dispatches, so a fresh review is safe.
          this.store.remove(this.key!);
        }
      } catch {
        this.setPhase({ kind: "lost", intentId: active, step: "send", message: LOST_MESSAGE });
      }
    });
  }

  /** Prepares (never sends) the reviewed content; `repeatOfId` only for explicit Try again / Send another copy. */
  review(draft: EmailDraftSeed, repeatOfId?: string): Promise<void> {
    return this.guarded(async () => {
      const previous = this.phase;
      const intentId = previous.kind === "lost" && previous.step === "prepare" ? previous.intentId : this.newId();
      const reviewed = draftKey(draft);
      if (this.key) this.store.set(this.key, intentId);
      this.setPhase({ kind: "preparing" });
      try {
        const result = await this.api.prepare({ intentId, draft, ...(repeatOfId ? { repeatOfId } : {}) });
        if (result.ok) this.settle(result.data, reviewed);
        else {
          if (this.key) this.store.remove(this.key);
          this.setPhase(previous.kind === "view" ? { ...previous, message: result.error } : { kind: "idle", message: result.error });
        }
      } catch {
        this.setPhase({ kind: "lost", intentId, step: "prepare", message: LOST_MESSAGE });
      }
    });
  }

  send(): Promise<void> {
    return this.guarded(async () => {
      const phase = this.phase;
      if (phase.kind !== "view" || phase.view.state !== "prepared") return;
      this.initiated.add(phase.view.id);
      this.setPhase({ kind: "sending", view: phase.view, draftKey: phase.draftKey });
      try {
        const result = await this.api.send(phase.view.id);
        if (result.ok) this.settle(result.data, phase.draftKey);
        else this.setPhase({ ...phase, message: result.error });
      } catch {
        // The prepared row already exists: keep its canonical ID, never offer a blind resend.
        this.setPhase({ kind: "lost", intentId: phase.view.id, step: "send", message: LOST_MESSAGE });
      }
    });
  }

  /** Reconciles the shown send (or a lost response) without dispatching anything. */
  check(): Promise<void> {
    return this.guarded(async () => {
      const phase = this.phase;
      if (phase.kind === "lost") {
        try {
          const result = await this.api.get(phase.intentId);
          if (result.ok) {
            if (phase.step === "send") this.initiated.add(result.data.id);
            this.settle(result.data, null);
          } else if (phase.step === "prepare") {
            // Nothing was persisted; the same intent ID is reused on the next review.
            this.setPhase({ kind: "lost", intentId: phase.intentId, step: "prepare", message: "Nothing was prepared or sent. Review the email again." });
          } else {
            this.setPhase({ ...phase, message: result.error });
          }
        } catch {
          this.setPhase({ ...phase, message: LOST_MESSAGE });
        }
        return;
      }
      if (phase.kind !== "view") return;
      this.initiated.add(phase.view.id);
      this.setPhase({ kind: "checking", view: phase.view, draftKey: phase.draftKey });
      try {
        const result = await this.api.check(phase.view.id);
        if (result.ok) this.settle(result.data, phase.draftKey, result.data.notice);
        else this.setPhase({ ...phase, message: result.error });
      } catch {
        this.setPhase({ ...phase, message: "Status could not be checked. Try again shortly; do not resend." });
      }
    });
  }

  /** Editing after review invalidates it; the prepared evidence row is left untouched. */
  invalidate(currentDraftKey: string): void {
    const phase = this.phase;
    if (phase.kind === "view" && phase.view.state === "prepared" && phase.draftKey !== null && phase.draftKey !== currentDraftKey) {
      if (this.key) this.store.remove(this.key);
      this.setPhase({ kind: "idle", message: "You changed the email after review. Review it again before sending." });
    }
  }

  /** Leaves a not-dispatched intent (prepared/failed) to start over. */
  discard(): void {
    const phase = this.phase;
    if (phase.kind === "view" && (phase.view.state === "prepared" || phase.view.state === "failed" || (phase.view.state === "accepted" && !phase.view.effectsPending))) {
      if (this.key) this.store.remove(this.key);
      this.setPhase({ kind: "idle" });
    } else if (phase.kind === "lost" && phase.step === "prepare") {
      this.setPhase({ kind: "idle" });
    }
  }
}
