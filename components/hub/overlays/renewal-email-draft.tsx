"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  dismissRenewalEmailDraftAction,
  getRenewalEmailDraftAction,
  saveRenewalEmailDraftAction,
} from "@/app/(app)/renewals/automation-actions";
import { EmailSendControls } from "@/components/email/email-send-controls";
import type { EmailSendPhase } from "@/components/email/email-send-controller";
import { RecentEmailSends } from "@/components/email/recent-email-sends";
import type { EmailDraftSeed } from "@/lib/communications/outbound-email.types";
import type { RenewalEmailDraft } from "@/lib/repositories/renewal-automation/renewal-automation.entity";
import { Btn, Field, INPUT } from "../primitives";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";

/** Save/Dismiss stay available only while no send is prepared or awaiting its outcome. */
function draftChangeAllowed(phase: EmailSendPhase): boolean {
  if (phase.kind === "idle") return true;
  if (phase.kind === "lost") return phase.step === "prepare";
  return phase.kind === "view" && phase.view.state === "failed";
}

export function RenewalEmailDraftModal({ draftId, onClose }: { draftId: string; onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [draft, setDraft] = useState<RenewalEmailDraft | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState<"save" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<EmailSendPhase>({ kind: "idle" });
  // Remounting restores the active intent from the server with the draft's current revision.
  const [controlsKey, setControlsKey] = useState(0);
  const [sendsKey, setSendsKey] = useState(0);
  // Guard Escape/backdrop synchronously, including before the pending render commits.
  const mutating = useRef(false);
  const revisionRefreshedFor = useRef<string | null>(null);
  const revisionRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await getRenewalEmailDraftAction(draftId);
        if (!active) return;
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setDraft(result.data);
        setRecipientEmail(result.data.recipientEmail ?? "");
        setSubject(result.data.subject);
        setBody(result.data.body);
        setError(null);
      } catch {
        if (active) setError("Couldn't load this draft. Check your connection and retry.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [draftId, reload]);

  // Claiming a send binds it to the draft, which moves the draft's revision. After a rejected send,
  // pick up that revision (content is unchanged) so Try again is checked against the current draft.
  useEffect(() => { revisionRef.current = draft?.updatedAt ?? null; }, [draft]);
  useEffect(() => {
    if (phase.kind !== "view" || phase.view.state !== "failed" || revisionRefreshedFor.current === phase.view.id) return;
    revisionRefreshedFor.current = phase.view.id;
    let active = true;
    void getRenewalEmailDraftAction(draftId).then((result) => {
      if (!active || !result.ok || result.data.updatedAt === revisionRef.current) return;
      setDraft(result.data);
      setControlsKey((value) => value + 1);
    }).catch(() => {});
    return () => { active = false; };
  }, [phase, draftId]);

  const close = () => { if (!mutating.current) onClose(); };
  const reloadDraft = () => {
    if (mutating.current) return;
    setLoading(true);
    setError(null);
    setReload((value) => value + 1);
  };
  const editable = draft?.status === "Draft";
  const changeAllowed = draftChangeAllowed(phase);
  const disabled = loading || !!pending || !editable;
  const complete = !!recipientEmail.trim() && !!subject.trim() && !!body.trim();
  const dirty = !!draft && (recipientEmail.trim() !== (draft.recipientEmail ?? "") || subject.trim() !== draft.subject || body !== draft.body);

  const seed = useMemo<EmailDraftSeed | null>(() => draft && {
    origin: { type: "renewal_draft", id: draft.id, updatedAt: draft.updatedAt },
    recipient: recipientEmail.trim(),
    subject: subject.trim(),
    body,
    ...(draft.externalContactId ? { externalContactId: draft.externalContactId } : {}),
  }, [draft, recipientEmail, subject, body]);

  const onPhaseChange = useCallback((next: EmailSendPhase) => setPhase(next), []);
  const onSent = useCallback(() => {
    overlays.toast("Email sent", "Accepted by Gmail. Delivery and reading are not confirmed. The linked task is complete.");
    setSendsKey((value) => value + 1);
    setLoading(true);
    setError(null);
    setReload((value) => value + 1);
    router.refresh();
  }, [overlays, router]);

  const mutate = async (operation: "save" | "dismiss") => {
    if (!draft || !editable || loading || !changeAllowed || mutating.current) return;
    mutating.current = true;
    setPending(operation);
    setError(null);
    try {
      const result = operation === "dismiss"
        ? await dismissRenewalEmailDraftAction(draft.id, draft.updatedAt)
        : await saveRenewalEmailDraftAction(draft.id, { recipientEmail, subject, body, updatedAt: draft.updatedAt });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft(result.data);
      setRecipientEmail(result.data.recipientEmail ?? "");
      setSubject(result.data.subject);
      setBody(result.data.body);
      overlays.toast(
        operation === "save" ? "Draft saved" : "Draft dismissed",
        operation === "dismiss" ? "The generated task is cancelled. No email was sent." : "Nothing is sent until you review and send it.",
      );
      router.refresh();
    } catch {
      setError("Couldn't confirm the change. Check your connection. Reload the draft to check its saved state before trying again.");
    } finally {
      mutating.current = false;
      setPending(null);
    }
  };

  return (
    <Modal onClose={close} maxWidth={640} footer={
      <>
        <Btn onClick={close} disabled={!!pending}>Close</Btn>
        {draft && editable && (
          <>
            <Btn onClick={() => void mutate("dismiss")} disabled={disabled || !changeAllowed}>
              {pending === "dismiss" ? "Dismissing…" : "Dismiss draft"}
            </Btn>
            <Btn onClick={() => void mutate("save")} disabled={disabled || !changeAllowed || !complete || !dirty}>
              {pending === "save" ? "Saving…" : "Save draft"}
            </Btn>
          </>
        )}
      </>
    }>
      <h3 className="text-[16px] font-bold tracking-[-0.01em]">Renewal email draft</h3>
      {editable && (
        <p className="mt-3 rounded-md border border-border-soft bg-surface-2 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
          Review the email, then send it from admin@pacificinsuranceph.com. Sending completes the linked task once Gmail accepts it; it does not advance the renewal.
        </p>
      )}
      {loading && <p role="status" className="mt-4 text-[13px] text-muted-foreground">Loading draft…</p>}
      {!loading && draft && (
        <>
          <p className="my-4 text-[13px] text-muted-foreground">{draft.ruleName} · {draft.status === "Logged" ? "Logged only" : draft.status}</p>
          <div className="space-y-4">
            <Field label="To email" required={editable} hint={!recipientEmail && editable ? "Add a recipient email before saving or sending." : undefined}>
              <input type="email" aria-label="To email" required={editable} className={INPUT} value={recipientEmail} disabled={disabled} onChange={(event) => setRecipientEmail(event.target.value)} />
            </Field>
            <Field label="Subject" required={editable}>
              <input aria-label="Subject" required={editable} className={INPUT} value={subject} disabled={disabled} onChange={(event) => setSubject(event.target.value)} />
            </Field>
            <Field label="Body" required={editable}>
              <textarea aria-label="Body" required={editable} className={`${INPUT} min-h-[220px] resize-y py-2`} value={body} disabled={disabled} onChange={(event) => setBody(event.target.value)} />
            </Field>
          </div>
          {editable && seed && (
            <EmailSendControls
              key={controlsKey}
              draft={seed}
              ready={complete && !loading && !pending}
              blockedReason={dirty ? "Save your edits before reviewing — the review sends the saved draft." : null}
              sendLabel="Send email"
              onSent={onSent}
              onPhaseChange={onPhaseChange}
            />
          )}
          {draft.status === "Dismissed" && <p className="mt-4 text-[13px] text-muted-foreground">Dismissal reason: {draft.dismissalReason ?? "No reason recorded."}</p>}
          {draft.status === "Sent" && <p className="mt-4 text-[13px] text-muted-foreground">Sent — accepted by Gmail from admin@pacificinsuranceph.com. Delivery and reading are not confirmed. The email is recorded in the client timeline.</p>}
          {draft.status === "Logged" && <p className="mt-4 text-[13px] text-muted-foreground">Logged only — this email was not sent by the CRM.</p>}
          {editable && <p className="mt-4 text-[12px] text-subtle">Dismiss draft cancels the generated task without sending an email. Completing the task checkbox separately does not send an email.</p>}
          <div className="mt-4">
            <RecentEmailSends
              clientId={draft.clientId}
              matches={(origin) => origin.type === "renewal_draft" && origin.id === draft.id}
              title="Emails sent from this draft"
              refreshKey={`${sendsKey}:${draft.updatedAt}`}
            />
          </div>
        </>
      )}
      {error && (
        <div className="mt-4 space-y-2">
          <p role="alert" className="text-[13px] text-red">{error}</p>
          {draft && <p className="text-[12px] text-muted-foreground">Your edits are still here. If the draft changed elsewhere, reload before continuing. Reload discards your local edits.</p>}
          <Btn size="sm" disabled={loading || !!pending} onClick={reloadDraft}>{draft ? "Reload draft" : "Retry loading"}</Btn>
        </div>
      )}
    </Modal>
  );
}
