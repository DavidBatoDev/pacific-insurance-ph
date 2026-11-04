"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  checkEmailSendAction, getEmailSendAction, getEmailSenderAction, prepareEmailAction, sendPreparedEmailAction,
} from "@/app/(app)/email/actions";
import { I } from "@/components/hub/icons";
import { Btn } from "@/components/hub/primitives";
import {
  EMAIL_SEND_ERROR_MESSAGES, SENDER_MAILBOX, emailSendStatusLabel, gmailThreadUrl,
  type EmailDraftSeed, type EmailSendView,
} from "@/lib/communications/outbound-email.types";
import { cn } from "@/lib/utils";
import { browserIntentStore, draftKey, EmailSendController, type EmailSendPhase } from "./email-send-controller";

const API = { prepare: prepareEmailAction, send: sendPreparedEmailAction, get: getEmailSendAction, check: checkEmailSendAction };
const GMAIL_SENT_URL = `https://mail.google.com/mail/u/${encodeURIComponent(SENDER_MAILBOX)}/#sent`;

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function newIntentId(): string {
  return crypto.randomUUID();
}

/** Final reviewed content exactly as it will be dispatched. */
function ReviewedEmail({ view }: { view: EmailSendView }) {
  return (
    <div className="rounded-md border border-border-soft bg-surface-2 p-3.5 text-[12.5px]">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="font-semibold text-subtle">From</dt><dd className="break-all">Pacific Insurance PH &lt;{SENDER_MAILBOX}&gt;</dd>
        <dt className="font-semibold text-subtle">To</dt><dd className="break-all font-semibold">{view.recipient}</dd>
        <dt className="font-semibold text-subtle">Subject</dt><dd className="break-words">{view.subject || <span className="text-subtle">(no subject)</span>}</dd>
      </dl>
      <div className="mt-2.5 max-h-56 overflow-auto whitespace-pre-wrap border-t border-border-soft pt-2.5 leading-relaxed text-muted-foreground">{view.body}</div>
      <div className="mt-2.5 border-t border-border-soft pt-2.5">
        <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">Attachments ({view.attachments.length})</div>
        {view.attachments.length ? (
          <ul className="mt-1 space-y-0.5">
            {view.attachments.map((file, index) => (
              <li key={`${file.fileName}-${index}`} className="flex justify-between gap-3">
                <span className="break-all">{file.fileName}</span>
                <span className="shrink-0 text-subtle">{formatBytes(file.size)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-subtle">No files attached.</p>}
      </div>
    </div>
  );
}

function StatusBanner({ view }: { view: EmailSendView }) {
  const tone = view.state === "accepted" ? (view.threadMismatch || view.effectsPending ? "amber" : "green")
    : view.state === "failed" ? "red" : view.state === "unknown" ? "amber" : "neutral";
  return (
    <div role="status" aria-live="polite" className={cn("flex gap-2.5 rounded-md border p-3 text-[12.5px] leading-relaxed",
      tone === "green" && "border-green-border bg-green-soft text-green",
      tone === "amber" && "border-amber-border bg-amber-soft text-amber",
      tone === "red" && "border-red-border bg-red-soft text-red",
      tone === "neutral" && "border-border-soft bg-surface-2 text-foreground")}>
      {view.state === "accepted" && !view.effectsPending && !view.threadMismatch ? <I.check size={16} className="mt-0.5 shrink-0" /> : <I.alertTri size={16} className="mt-0.5 shrink-0" />}
      <div>
        <b>{emailSendStatusLabel(view)}</b>
        {view.state === "failed" && view.errorCode && <p>{EMAIL_SEND_ERROR_MESSAGES[view.errorCode] ?? "The email was not sent."}</p>}
        {view.state === "accepted" && view.effectsPending && <p>Gmail accepted this email; its workflow update is pending. Check status.</p>}
        {view.threadMismatch && <p>{EMAIL_SEND_ERROR_MESSAGES.gmail_send_thread_mismatch}</p>}
      </div>
    </div>
  );
}

/**
 * The one review → send → outcome control for every individual email. Preparing never sends;
 * only the explicit Send click dispatches the exact reviewed manifest. `onSent` fires once, only
 * after acceptance AND completed workflow effects, for a send/check started in this mount.
 */
export function EmailSendControls({
  draft,
  ready,
  blockedReason,
  sendLabel = "Send email",
  reviewLabel = "Review email",
  onSent,
  onPhaseChange,
}: {
  draft: EmailDraftSeed;
  /** Editor-level completeness (recipient/subject/required attachment). */
  ready: boolean;
  blockedReason?: string | null;
  sendLabel?: string;
  reviewLabel?: string;
  onSent?: (view: EmailSendView) => void;
  onPhaseChange?: (phase: EmailSendPhase) => void;
}) {
  const [controller] = useState(() => new EmailSendController(API, browserIntentStore(), newIntentId));
  useEffect(() => { controller.setOnSent(onSent); }, [controller, onSent]);
  const phase = useSyncExternalStore(controller.subscribe, controller.getPhase, controller.getPhase);
  const [sender, setSender] = useState<{ actorId: string } | { error: string } | null>(null);
  const [confirmCopy, setConfirmCopy] = useState(false);
  const originRef = useRef(draft.origin);
  const currentKey = draftKey(draft);

  useEffect(() => {
    let live = true;
    getEmailSenderAction().then((result) => {
      if (!live) return;
      if (!result.ok) { setSender({ error: result.error }); return; }
      setSender(result.data);
      void controller.init(result.data.actorId, originRef.current);
    }).catch(() => { if (live) setSender({ error: "Sending is unavailable right now. Reload the page." }); });
    return () => { live = false; };
  }, [controller]);

  useEffect(() => { controller.invalidate(currentKey); }, [controller, currentKey]);
  useEffect(() => { onPhaseChange?.(phase); }, [phase, onPhaseChange]);

  if (!sender) return <p className="mt-3.5 text-[12px] text-subtle">Checking sending permission…</p>;
  if ("error" in sender) {
    return (
      <p className="mt-3.5 rounded-md border border-border-soft bg-surface-2 p-3 text-[12.5px] text-muted-foreground">
        {sender.error} Emails from {SENDER_MAILBOX} are sent by active Admin and Staff accounts only.
      </p>
    );
  }

  const message = "message" in phase ? phase.message : undefined;
  const view = phase.kind === "view" || phase.kind === "sending" || phase.kind === "checking" ? phase.view : null;
  const working = phase.kind === "preparing" || phase.kind === "sending" || phase.kind === "checking";
  const restored = phase.kind === "view" && phase.draftKey === null;
  const sameContent = phase.kind === "view" && (phase.draftKey === null || phase.draftKey === currentKey);

  return (
    <div className="mt-3.5 space-y-2.5">
      {message && <p role="alert" className="rounded-md border border-amber-border bg-amber-soft p-2.5 text-[12.5px] text-amber">{message}</p>}
      {view?.notice && view.notice !== message && <p role="status" className="text-[12.5px] text-muted-foreground">{view.notice}</p>}

      {(phase.kind === "idle" || phase.kind === "preparing") && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11.5px] text-faint">From: {SENDER_MAILBOX}. Review shows the final recipient, content and real attachments before anything is sent.</span>
          <Btn variant="primary" disabled={!ready || Boolean(blockedReason) || working} title={blockedReason ?? undefined}
            onClick={() => void controller.review(draft)}>
            <I.mail size={15} /> {phase.kind === "preparing" ? "Preparing review…" : reviewLabel}
          </Btn>
        </div>
      )}
      {phase.kind === "idle" && blockedReason && <p className="text-[12px] text-red">{blockedReason}</p>}

      {phase.kind === "lost" && (
        <div className="rounded-md border border-amber-border bg-amber-soft p-3 text-[12.5px] text-amber">
          <p><b>{phase.step === "send" ? "Sending status unconfirmed." : "Review status unconfirmed."}</b> Reference {phase.intentId.slice(0, 8)}.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn size="sm" onClick={() => void controller.check()}>Check sending status</Btn>
            {phase.step === "prepare" && <Btn size="sm" variant="ghost" onClick={() => void controller.review(draft)}>Review again</Btn>}
          </div>
        </div>
      )}

      {view && (
        <>
          {view.state !== "prepared" && <StatusBanner view={view} />}
          {(view.state === "prepared" || view.state === "failed" || view.state === "unknown" || restored) && <ReviewedEmail view={view} />}
          {view.state === "prepared" && restored && <p className="text-[12px] text-muted-foreground">This reviewed email was not sent yet. Send it as shown, or discard it to start over.</p>}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {view.state === "prepared" && (
              <>
                <Btn variant="ghost" disabled={working} onClick={() => controller.discard()}>Edit</Btn>
                <Btn variant="primary" disabled={working} onClick={() => void controller.send()}>
                  <I.send size={15} /> {phase.kind === "sending" ? "Sending…" : sendLabel}
                </Btn>
              </>
            )}
            {view.state === "failed" && (
              <>
                <Btn variant="ghost" disabled={working} onClick={() => controller.discard()}>Edit email</Btn>
                {view.canRepeat && <Btn variant="primary" disabled={working || !sameContent}
                  title={!sameContent ? "The email changed; review it again instead." : undefined}
                  onClick={() => void controller.review(draft, view.id)}>Try again</Btn>}
              </>
            )}
            {(view.state === "unknown" || view.state === "sending" || (view.state === "accepted" && view.effectsPending)) && (
              <Btn size="sm" disabled={working} onClick={() => void controller.check()}>{phase.kind === "checking" ? "Checking…" : "Check status"}</Btn>
            )}
            {view.state === "unknown" && <a className="text-[12.5px] font-semibold text-primary underline underline-offset-2" href={GMAIL_SENT_URL} target="_blank" rel="noreferrer">Open in Gmail</a>}
            {view.state === "accepted" && view.gmailThreadId && (
              <a className="text-[12.5px] font-semibold text-primary underline underline-offset-2" href={gmailThreadUrl(view.gmailThreadId)} target="_blank" rel="noreferrer">Open in Gmail</a>
            )}
            {view.state === "accepted" && !view.effectsPending && view.canRepeat && (confirmCopy ? (
              <span className="flex items-center gap-2 text-[12.5px]">
                Send the same email again to {view.recipient}?
                <Btn size="sm" disabled={working} onClick={() => { setConfirmCopy(false); void controller.review(draft, view.id); }}>Prepare another copy</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setConfirmCopy(false)}>Cancel</Btn>
              </span>
            ) : <Btn size="sm" variant="ghost" onClick={() => setConfirmCopy(true)}>Send another copy</Btn>)}
          </div>
        </>
      )}
    </div>
  );
}
