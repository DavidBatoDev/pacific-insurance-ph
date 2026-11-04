export type InboxFreshnessResult = { ok: true; revision: string } | { ok: false; kind: "transient" | "unauthorized" };
export type InboxFreshnessState = { revision: string; error: "transient" | "unauthorized" | null };

/** Keep known membership through failed checks, and avoid repeated live-region updates. */
export function reduceInboxFreshness(state: InboxFreshnessState, result: InboxFreshnessResult): InboxFreshnessState {
  const revision = result.ok ? result.revision : state.revision;
  const error = result.ok ? null : result.kind;
  return state.revision === revision && state.error === error ? state : { revision, error };
}

export async function checkInboxFreshness(signal: AbortSignal): Promise<InboxFreshnessResult> {
  try {
    const response = await fetch("/api/inbox/freshness", { signal, credentials: "same-origin", cache: "no-store", redirect: "manual" });
    if (response.redirected || response.type === "opaqueredirect") return { ok: false, kind: "transient" };
    if (response.status === 401 || response.status === 403) return { ok: false, kind: "unauthorized" };
    if (!response.ok || !response.headers.get("content-type")?.split(";")[0].trim().match(/^application\/json$/i))
      return { ok: false, kind: "transient" };
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !("revision" in body)
      || typeof body.revision !== "string" || !/^[0-9a-f]{32}$/.test(body.revision)) return { ok: false, kind: "transient" };
    return { ok: true, revision: body.revision };
  } catch {
    return { ok: false, kind: "transient" };
  }
}

export function startInboxFreshnessPolling(options: {
  check: (signal: AbortSignal) => Promise<InboxFreshnessResult>;
  onResult: (result: InboxFreshnessResult) => void;
  visibility: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  connectivity: Pick<Window, "addEventListener" | "removeEventListener">;
  isOnline: () => boolean;
}): () => void {
  let stopped = false;
  let active: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let resumeRequested = false;
  const eligible = () => options.visibility.visibilityState === "visible" && options.isOnline();
  const clearTimers = () => { clearTimeout(timer); clearTimeout(deadline); timer = deadline = undefined; };
  const stop = () => {
    stopped = true;
    clearTimers();
    active?.abort();
    options.visibility.removeEventListener("visibilitychange", lifecycle);
    options.connectivity.removeEventListener("online", lifecycle);
    options.connectivity.removeEventListener("offline", lifecycle);
  };
  const publish = (result: InboxFreshnessResult) => {
    if (!result.ok && result.kind === "unauthorized") stop();
    options.onResult(result);
  };
  const run = async () => {
    if (stopped || !eligible()) return;
    if (active) { resumeRequested = active.signal.aborted; return; }
    clearTimeout(timer);
    resumeRequested = false;
    const request = new AbortController();
    active = request;
    deadline = setTimeout(() => {
      request.abort();
      if (!stopped && eligible()) publish({ ok: false, kind: "transient" });
    }, 10_000);
    try {
      const result = await options.check(request.signal);
      if (!stopped && !request.signal.aborted && eligible()) publish(result);
    } catch {
      if (!stopped && !request.signal.aborted && eligible()) publish({ ok: false, kind: "transient" });
    } finally {
      clearTimeout(deadline);
      active = null;
      if (!stopped && eligible()) {
        if (resumeRequested) void run();
        else timer = setTimeout(() => { void run(); }, 30_000);
      }
    }
  };
  function lifecycle() {
    if (stopped) return;
    if (!eligible()) { clearTimers(); resumeRequested = false; active?.abort(); }
    else void run();
  }
  options.visibility.addEventListener("visibilitychange", lifecycle);
  options.connectivity.addEventListener("online", lifecycle);
  options.connectivity.addEventListener("offline", lifecycle);
  void run();
  return stop;
}
