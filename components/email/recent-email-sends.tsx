"use client";

import { useCallback, useEffect, useState } from "react";

import { checkEmailSendAction, listEmailSendsAction } from "@/app/(app)/email/actions";
import { Btn } from "@/components/hub/primitives";
import {
  EMAIL_SEND_ERROR_MESSAGES, emailSendStatusLabel, gmailThreadUrl,
  type EmailOrigin, type EmailSendView,
} from "@/lib/communications/outbound-email.types";

/**
 * Server-backed recent sends for one source, so closing a dialog or losing a response never hides
 * a pending outcome. Check status reconciles by reading Gmail; it never sends.
 */
export function RecentEmailSends({
  clientId,
  replyToMessageId,
  matches,
  title = "Recent emails",
  refreshKey,
  onSettled,
}: {
  clientId: string;
  replyToMessageId?: string;
  /** Narrows the client's sends to this workflow's source. */
  matches?: (origin: EmailOrigin) => boolean;
  title?: string;
  /** Change to reload after a send completes elsewhere on the page. */
  refreshKey?: unknown;
  onSettled?: (view: EmailSendView) => void;
}) {
  const [views, setViews] = useState<EmailSendView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listEmailSendsAction(clientId, replyToMessageId);
    if (result.ok) { setViews(result.data); setError(null); } else setError(result.error);
  }, [clientId, replyToMessageId]);

  useEffect(() => {
    let live = true;
    listEmailSendsAction(clientId, replyToMessageId).then((result) => {
      if (!live) return;
      if (result.ok) { setViews(result.data); setError(null); } else setError(result.error);
    }).catch(() => { if (live) setError("Recent emails could not be loaded."); });
    return () => { live = false; };
  }, [clientId, replyToMessageId, refreshKey]);

  const shown = (views ?? []).filter((view) => !matches || matches(view.origin)).slice(0, 5);
  if (error) return <p className="text-[12px] text-subtle">{error}</p>;
  if (!shown.length) return null;

  const check = async (view: EmailSendView) => {
    if (busy) return;
    setBusy(view.id);
    try {
      const result = await checkEmailSendAction(view.id);
      if (result.ok) {
        setViews((current) => current?.map((item) => item.id === view.id ? result.data : item) ?? null);
        if (result.data.state === "accepted" && !result.data.effectsPending) onSettled?.(result.data);
      } else setError(result.error);
    } catch {
      setError("Status could not be checked. Try again shortly; do not resend.");
    } finally {
      setBusy(null);
      void load().catch(() => undefined);
    }
  };

  return (
    <section aria-label={title} className="rounded-md border border-border-soft bg-surface-2 p-3 text-[12.5px]">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">{title}</div>
      <ul className="space-y-2">
        {shown.map((view) => (
          <li key={view.id} className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold">{view.subject || "(no subject)"} · {view.recipient}</div>
              <div className={view.state === "failed" ? "text-red" : view.state === "unknown" || view.effectsPending || view.threadMismatch ? "text-amber" : "text-muted-foreground"}>
                {emailSendStatusLabel(view)}
                {view.state === "failed" && view.errorCode ? ` ${EMAIL_SEND_ERROR_MESSAGES[view.errorCode] ?? ""}` : ""}
                {view.effectsPending ? " Workflow update pending." : ""}
                {view.threadMismatch ? ` ${EMAIL_SEND_ERROR_MESSAGES.gmail_send_thread_mismatch}` : ""}
                {view.acceptedAt ? ` · ${new Date(view.acceptedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}` : ""}
                {view.attachments.length ? ` · ${view.attachments.length} attachment${view.attachments.length === 1 ? "" : "s"}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(view.state === "unknown" || view.state === "sending" || view.effectsPending) && (
                <Btn size="sm" disabled={busy !== null} onClick={() => void check(view)}>{busy === view.id ? "Checking…" : "Check status"}</Btn>
              )}
              {view.gmailThreadId && (
                <a className="font-semibold text-primary underline underline-offset-2" href={gmailThreadUrl(view.gmailThreadId)} target="_blank" rel="noreferrer">Open in Gmail</a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
