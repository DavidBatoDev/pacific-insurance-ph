"use client";

import { AlertTriangle } from "lucide-react";

export default function InboxError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="mx-auto max-w-lg rounded-lg border border-amber-border bg-card p-6"><AlertTriangle size={24} className="mb-3 text-amber" aria-hidden="true" /><h1 className="text-lg font-bold">Correspondence could not be loaded</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your account’s correspondence access or the inbox connection may have changed. Retry the request. If it continues, ask an Admin to check the mailbox and your account access.</p><button type="button" onClick={reset} className="mt-4 rounded-md bg-brand px-3 py-2 text-xs font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Try again</button></section>;
}
