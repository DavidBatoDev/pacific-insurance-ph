import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkInboxFreshness, reduceInboxFreshness, startInboxFreshnessPolling, type InboxFreshnessResult, type InboxFreshnessState } from "./inbox-freshness-poller";

const baseline = "a".repeat(32);
const newer = "b".repeat(32);
class Visibility extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
  set(value: DocumentVisibilityState) { this.visibilityState = value; this.dispatchEvent(new Event("visibilitychange")); }
}
const cleanups: (() => void)[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanups.splice(0).forEach((stop) => stop()); vi.useRealTimers(); vi.unstubAllGlobals(); });
function harness(check: (signal: AbortSignal) => Promise<InboxFreshnessResult> = checkInboxFreshness) {
  const visibility = new Visibility();
  const connectivity = new EventTarget();
  let online = true;
  let state: InboxFreshnessState = { revision: baseline, error: null };
  let changes = 0;
  const stop = startInboxFreshnessPolling({ check, visibility, connectivity, isOnline: () => online, onResult: (result) => {
    const next = reduceInboxFreshness(state, result);
    if (next !== state) changes++;
    state = next;
  } });
  cleanups.push(stop);
  return { visibility, connectivity, stop, get state() { return state; }, get changes() { return changes; }, get notice() { return state.revision !== baseline; }, online(value: boolean) { online = value; connectivity.dispatchEvent(new Event(value ? "online" : "offline")); } };
}
const json = (revision: string) => Response.json({ revision });

 describe("authorized freshness scheduling and state", () => {
  it("keeps equal baselines quiet, reports changed membership once, and clears when membership returns", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(baseline)).mockResolvedValueOnce(json(newer)).mockResolvedValueOnce(json(newer)).mockResolvedValueOnce(json(baseline));
    vi.stubGlobal("fetch", fetcher);
    const h = harness();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.notice).toBe(false);
    expect(h.changes).toBe(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.notice).toBe(true);
    expect(h.changes).toBe(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.changes).toBe(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.notice).toBe(false);
    expect(h.state.error).toBeNull();
  });

  it.each(["network", "503", "malformed", "html", "redirect", "extra metadata"])("preserves known membership through %s and recovers on the next successful check", async (failure) => {
    let call = 0;
    vi.stubGlobal("fetch", async () => {
      if (++call === 1) return json(newer);
      if (call > 2) return json(newer);
      if (failure === "network") throw new TypeError("offline");
      if (failure === "503") return new Response("unavailable", { status: 503 });
      if (failure === "malformed") return new Response('{"revision":', { headers: { "Content-Type": "application/json" } });
      if (failure === "html") return new Response("<html>login</html>", { headers: { "Content-Type": "text/html" } });
      if (failure === "redirect") return new Response(null, { status: 307, headers: { Location: "/login" } });
      return Response.json({ revision: newer, subject: "must not be accepted" });
    });
    const h = harness();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.state).toEqual({ revision: newer, error: "transient" });
    expect(h.notice).toBe(true);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.state).toEqual({ revision: newer, error: null });
  });

  it.each([401, 403])("stops on %s even when connectivity later resumes", async (status) => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => { calls++; return Response.json({ error: "denied" }, { status }); });
    const h = harness();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.state).toEqual({ revision: baseline, error: "unauthorized" });
    h.online(false); h.online(true); h.visibility.set("hidden"); h.visibility.set("visible");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(calls).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts at ten seconds, preserves the view, and recovers without overlapping requests", async () => {
    let calls = 0;
    let inflight = 0;
    let maximum = 0;
    const h = harness(async (signal) => {
      calls++; inflight++; maximum = Math.max(maximum, inflight);
      try {
        if (calls === 1) {
          const { promise, reject } = Promise.withResolvers<void>();
          signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
          await promise;
        }
        return { ok: true, revision: newer };
      } finally { inflight--; }
    });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.state).toEqual({ revision: baseline, error: "transient" });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(maximum).toBe(1);
    expect(h.state).toEqual({ revision: newer, error: null });
  });

  it("pauses while hidden or offline and checks immediately on eligible return", async () => {
    let calls = 0;
    const h = harness(async () => { calls++; return { ok: true, revision: baseline }; });
    await vi.advanceTimersByTimeAsync(0);
    h.visibility.set("hidden");
    await vi.advanceTimersByTimeAsync(90_000);
    expect(calls).toBe(1);
    h.online(false); h.visibility.set("visible");
    await vi.advanceTimersByTimeAsync(90_000);
    expect(calls).toBe(1);
    h.online(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(2);
    h.online(false);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(calls).toBe(2);
    h.online(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(3);
  });

  it("ignores an obsolete response after hide/resume and never starts a second unresolved check", async () => {
    const { promise, resolve } = Promise.withResolvers<InboxFreshnessResult>();
    let calls = 0;
    let signal!: AbortSignal;
    const h = harness((value) => { signal = value; calls++; return calls === 1 ? promise : Promise.resolve({ ok: true, revision: baseline }); });
    h.visibility.set("hidden");
    expect(signal.aborted).toBe(true);
    h.visibility.set("visible"); h.online(true);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(calls).toBe(1);
    resolve({ ok: true, revision: newer });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(2);
    expect(h.notice).toBe(false);
    expect(h.changes).toBe(0);
  });

  it("keeps an active request single-flight through redundant lifecycle events and retains its deadline", async () => {
    let calls = 0;
    const { promise } = Promise.withResolvers<InboxFreshnessResult>();
    const h = harness(() => { calls++; return promise; });
    h.visibility.set("visible"); h.online(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(1);
    expect(h.state.error).toBe("transient");
    await vi.advanceTimersByTimeAsync(90_000);
    expect(calls).toBe(1);
  });

  it("unmount aborts and removes scheduling/listeners; a late result cannot update the view", async () => {
    const { promise, resolve } = Promise.withResolvers<InboxFreshnessResult>();
    let signal!: AbortSignal;
    let calls = 0;
    const h = harness((value) => { calls++; signal = value; return promise; });
    h.stop();
    expect(signal.aborted).toBe(true);
    resolve({ ok: true, revision: newer });
    h.visibility.set("visible"); h.online(true);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h.state).toEqual({ revision: baseline, error: null });
    expect(calls).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
