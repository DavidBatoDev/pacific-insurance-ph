"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useTransition } from "react";
import { checkInboxFreshness, reduceInboxFreshness, startInboxFreshnessPolling } from "./inbox-freshness-poller";

export function InboxFreshness({ revision, selectedMessageId, page }: { revision: string; selectedMessageId: string | null; page: number }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reduceInboxFreshness, { revision, error: null });
  const [pending, startTransition] = useTransition();
  useEffect(() => startInboxFreshnessPolling({
    check: checkInboxFreshness,
    onResult: dispatch,
    visibility: document,
    connectivity: window,
    isOnline: () => navigator.onLine !== false,
  }), [revision]);
  const changed = state.revision !== revision;
  function refresh() {
    const href = `/inbox?page=1${selectedMessageId ? `&message=${encodeURIComponent(selectedMessageId)}` : ""}`;
    startTransition(() => {
      if (page === 1 && window.location.pathname + window.location.search === href) router.refresh();
      else router.replace(href, { scroll: false });
    });
  }
  if (!changed && !state.error) return null;
  return <div className="mb-4 space-y-2 rounded-lg border border-border bg-surface-2 px-4 py-3 text-[13px]">
    {changed && <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-between gap-3">
      <span className="font-semibold">Inbox updates available</span>
      <button type="button" onClick={refresh} disabled={pending || state.error === "unauthorized"} className="rounded-md bg-brand px-3 py-2 text-xs font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Refreshing…" : "Refresh inbox"}</button>
    </div>}
    {state.error && <p role="status" aria-live="polite" className="text-muted-foreground">{state.error === "unauthorized" ? <>Session expired or access changed. <Link href="/login?redirectTo=%2Finbox" className="font-semibold text-brand-hover underline focus-visible:outline-2 focus-visible:outline-ring">Sign in again.</Link></> : "Couldn't check for new emails. Your current view is unchanged."}</p>}
  </div>;
}
