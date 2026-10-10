"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  dismissRenewalEmailDraftAction,
  getRenewalEmailDraftAction,
  logRenewalEmailDraftAction,
  saveRenewalEmailDraftAction,
} from "@/app/(app)/renewals/automation-actions";
import type { RenewalEmailDraft } from "@/lib/repositories/renewal-automation/renewal-automation.entity";
import { Btn, Field, INPUT } from "../primitives";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";

export function RenewalEmailDraftModal({ draftId, onClose }: { draftId: string; onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [draft, setDraft] = useState<RenewalEmailDraft | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState<"save" | "log" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guard Escape/backdrop synchronously, including before the pending render commits.
  const mutating = useRef(false);

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

  const close = () => { if (!mutating.current) onClose(); };
  const reloadDraft = () => {
    if (mutating.current) return;
    setLoading(true);
    setError(null);
    setReload((value) => value + 1);
  };
  const editable = draft?.status === "Draft";
  const disabled = loading || !!pending || !editable;
  const complete = !!recipientEmail.trim() && !!subject.trim() && !!body.trim();

  const mutate = async (operation: "save" | "log" | "dismiss") => {
    if (!draft || !editable || loading || mutating.current) return;
    mutating.current = true;
    setPending(operation);
    setError(null);
    try {
      const edits = { recipientEmail, subject, body, updatedAt: draft.updatedAt };
      const result = operation === "dismiss"
        ? await dismissRenewalEmailDraftAction(draft.id, draft.updatedAt)
        : operation === "log"
          ? await logRenewalEmailDraftAction(draft.id, edits)
          : await saveRenewalEmailDraftAction(draft.id, edits);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft(result.data);
      setRecipientEmail(result.data.recipientEmail ?? "");
      setSubject(result.data.subject);
      setBody(result.data.body);
      overlays.toast(
        operation === "save" ? "Draft saved" : operation === "log" ? "Email logged" : "Draft dismissed",
        operation === "log" ? "No email delivered. The linked task is complete." : operation === "dismiss" ? "The generated task is cancelled. No email delivered." : "No email delivered.",
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
            <Btn onClick={() => void mutate("dismiss")} disabled={disabled}>
              {pending === "dismiss" ? "Dismissing…" : "Dismiss draft"}
            </Btn>
            <Btn onClick={() => void mutate("save")} disabled={disabled || !complete}>
              {pending === "save" ? "Saving…" : "Save draft"}
            </Btn>
            <Btn variant="primary" onClick={() => void mutate("log")} disabled={disabled || !complete}>
              {pending === "log" ? "Logging…" : "Log email"}
            </Btn>
          </>
        )}
      </>
    }>
      <h3 className="text-[16px] font-bold tracking-[-0.01em]">Renewal email draft</h3>
      <div className="mt-3 rounded-md border border-amber-border bg-amber-soft p-3 text-[12.5px] leading-relaxed text-amber">
        No email is delivered. Log email records the intended outbound communication and completes its linked task. It does not send an email or advance the renewal.
      </div>
      {loading && <p role="status" className="mt-4 text-[13px] text-muted-foreground">Loading draft…</p>}
      {!loading && draft && (
        <>
          <p className="my-4 text-[13px] text-muted-foreground">{draft.ruleName} · {draft.status}</p>
          <div className="space-y-4">
            <Field label="To email" required={editable} hint={!recipientEmail && editable ? "Add a recipient email before saving or logging." : undefined}>
              <input type="email" aria-label="To email" required={editable} className={INPUT} value={recipientEmail} disabled={disabled} onChange={(event) => setRecipientEmail(event.target.value)} />
            </Field>
            <Field label="Subject" required={editable}>
              <input aria-label="Subject" required={editable} className={INPUT} value={subject} disabled={disabled} onChange={(event) => setSubject(event.target.value)} />
            </Field>
            <Field label="Body" required={editable}>
              <textarea aria-label="Body" required={editable} className={`${INPUT} min-h-[220px] resize-y py-2`} value={body} disabled={disabled} onChange={(event) => setBody(event.target.value)} />
            </Field>
          </div>
          {draft.status === "Dismissed" && <p className="mt-4 text-[13px] text-muted-foreground">Dismissal reason: {draft.dismissalReason ?? "No reason recorded."}</p>}
          {draft.status === "Logged" && <p className="mt-4 text-[13px] text-muted-foreground">{draft.communicationId ? "The intended outbound communication is recorded in the client timeline." : "This draft is logged."} No email was delivered.</p>}
          {editable && <p className="mt-4 text-[12px] text-subtle">Dismiss draft cancels the generated task without logging an email. Completing the task checkbox separately does not log an email.</p>}
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
