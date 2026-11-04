"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Check, Reply } from "lucide-react";
import { getReplyDraftAction } from "@/app/(app)/email/actions";
import { EmailAttachmentChoices } from "@/components/email/email-attachment-choices";
import { EmailSendControls } from "@/components/email/email-send-controls";
import type { EmailSendPhase } from "@/components/email/email-send-controller";
import { RecentEmailSends } from "@/components/email/recent-email-sends";
import { INPUT } from "@/components/hub/primitives";
import { gmailThreadUrl, type EmailDraftSeed } from "@/lib/communications/outbound-email.types";
import type { InboxReviewData } from "@/lib/gmail/review";
import type { InboxMessage } from "@/lib/repositories/inbox/inbox.entity";

const SECONDARY_BUTTON = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-border-strong bg-card px-3 py-2 text-xs font-semibold hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";

type EmailOriginal = { messageId: string; partId: string };

/**
 * Reply to the authoritative sender of linked correspondence. Recipient and subject are locked to
 * the original so Gmail keeps the thread; there is no unthreaded fallback. State lives here, keyed
 * only by the selected message, so inbox freshness checks never discard an edited reply.
 */
export function ReplyControl({ data, message }: { data: InboxReviewData; message: InboxMessage }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<{ seed: EmailDraftSeed; clientId: string } | null>(null);
  const [body, setBody] = useState("");
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [emailAttachments, setEmailAttachments] = useState<EmailOriginal[]>([]);
  const [phase, setPhase] = useState<EmailSendPhase["kind"]>("idle");
  const [sentNotice, setSentNotice] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const onPhaseChange = useCallback((next: EmailSendPhase) => setPhase(next.kind), []);

  if (!data.canReply) {
    return data.replyBlockedReason
      ? <p className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted-foreground"><Reply size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{data.replyBlockedReason}</p>
      : null;
  }

  async function startReply() {
    if (loadingRef.current) return;
    setSentNotice(false);
    setOpen(true);
    if (locked) { requestAnimationFrame(() => bodyRef.current?.focus()); return; }
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await getReplyDraftAction(message.id);
      if (!result.ok) { setError(result.error); return; }
      setLocked({ seed: result.data.draft, clientId: result.data.clientId });
      requestAnimationFrame(() => bodyRef.current?.focus());
    } catch {
      setError("The reply could not be prepared. Check your connection and try again.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }
  function closeReply() {
    setOpen(false);
    setError(null);
    // The send control unmounts; reload recent outcomes so a pending one stays visible.
    setRefreshKey((key) => key + 1);
  }

  function onSent() {
    // Accepted with workflow effects complete: clear this composition so it cannot be resent by
    // accident, and refresh in place (same URL keeps the selected message and page).
    setOpen(false);
    setBody("");
    setDocumentIds([]);
    setEmailAttachments([]);
    setLocked(null);
    setSentNotice(true);
    setRefreshKey((key) => key + 1);
    router.refresh();
  }

  const busy = phase === "preparing" || phase === "sending" || phase === "checking";
  const clientId = locked?.clientId ?? message.clientId;
  const draft: EmailDraftSeed | null = locked ? {
    origin: { type: "reply", messageId: message.id },
    recipient: locked.seed.recipient,
    subject: locked.seed.subject,
    body,
    documentIds,
    emailAttachments,
  } : null;

  return <section aria-labelledby="reply-heading" className="rounded-lg border border-border bg-surface-2/60 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="reply-heading" className="flex items-center gap-2 text-sm font-bold"><Reply size={16} aria-hidden="true" />Reply from admin@pacificinsuranceph.com</h3>
      {!open && <button type="button" onClick={() => void startReply()} disabled={loading} className={SECONDARY_BUTTON}><Reply size={14} aria-hidden="true" />{loading ? "Preparing reply…" : "Reply"}</button>}
    </div>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Replies go to the original sender (or its Reply-To) in the same Gmail thread. No Cc recipients or original attachments are included automatically.</p>
    {sentNotice && <p role="status" className="mt-3 flex items-center gap-1.5 text-xs text-green"><Check size={14} aria-hidden="true" />Reply sent — accepted by Gmail. Delivery and reading are not confirmed.</p>}
    {open && error && <div role="alert" className="mt-3 rounded-md border border-red-border bg-red-soft p-3 text-xs leading-relaxed text-red">
      <p className="flex items-start gap-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{error}</p>
      <p className="mt-1.5 text-muted-foreground">The CRM only sends replies that Gmail can thread to this message. If this cannot be resolved, reply from the mailbox directly.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={gmailThreadUrl(message.gmailThreadId)} target="_blank" rel="noopener noreferrer" className={SECONDARY_BUTTON}>Open in Gmail<ArrowUpRight size={12} aria-hidden="true" /><span className="sr-only">(opens a new tab)</span></a>
        <button type="button" onClick={() => void startReply()} disabled={loading} className={SECONDARY_BUTTON}>{loading ? "Trying again…" : "Try again"}</button>
        <button type="button" onClick={closeReply} className={SECONDARY_BUTTON}>Close</button>
      </div>
    </div>}
    {open && !error && loading && <p role="status" className="mt-3 text-xs text-muted-foreground">Loading the original sender and thread from Gmail…</p>}
    {open && draft && !error && <div className="mt-4 space-y-3">
      <dl className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-md border border-border bg-card p-3 text-xs leading-relaxed">
        <dt className="text-subtle">To</dt><dd className="break-words font-semibold">{draft.recipient}</dd>
        <dt className="text-subtle">Subject</dt><dd className="break-words">{draft.subject || <span className="text-muted-foreground">(No subject)</span>}</dd>
      </dl>
      <p className="text-[10.5px] leading-relaxed text-subtle">Recipient and subject match the original so the reply stays in its thread. To write to someone else or change the subject, start a new email from the client instead.</p>
      <label className="block text-xs font-semibold">Reply<textarea ref={bodyRef} value={body} onChange={(event) => setBody(event.target.value)} rows={8} disabled={busy} className={`${INPUT} mt-1.5 min-h-[160px] resize-y leading-relaxed`} placeholder="Write your reply. The original message is not quoted automatically." /></label>
      {clientId && <EmailAttachmentChoices clientId={clientId} documentIds={documentIds} onDocumentIds={setDocumentIds} emailAttachments={emailAttachments} onEmailAttachments={setEmailAttachments} />}
      <EmailSendControls draft={draft} ready={body.trim().length > 0} sendLabel="Send reply" reviewLabel="Review reply" onSent={onSent} onPhaseChange={onPhaseChange} />
      <div><button type="button" onClick={closeReply} disabled={busy} className={SECONDARY_BUTTON}>Close reply</button></div>
    </div>}
    {clientId && <div className="mt-4"><RecentEmailSends clientId={clientId} replyToMessageId={message.id} title="Replies" refreshKey={refreshKey} /></div>}
  </section>;
}
