"use client";

import { useEffect, useState, useTransition } from "react";

import { getSubmissionDraftAction, submitToPacificCrossAction, type SubmissionDraft } from "@/app/(app)/submissions/actions";
import { RequirementStatusDot } from "@/components/hub/requirement-status";
import { fmtDate } from "@/lib/format";
import { emailClipboardText, type SubmissionKind } from "@/lib/submissions/submission-email";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { AREA, Btn, Field, INPUT, SEL } from "../primitives";
import { useOverlays } from "./overlay-provider";

/**
 * The finalizing step after a requirements checklist: compose the email to Pacific Cross, download
 * every checklist file as one ZIP, then record the submission. Nothing is delivered from here (R1)
 * — Eman copies the email into her own mailbox, attaches the ZIP and sends it herself.
 */
export function SubmissionStep({
  kind,
  id,
  onBack,
  onSubmitted,
  embedded = false,
  backLabel = "Back to checklist",
}: {
  kind: SubmissionKind;
  id: string;
  onBack: () => void;
  onSubmitted: (submittedDate: string) => void;
  /** Inside the application workflow: no own heading or scroll area, footer pinned to the bottom. */
  embedded?: boolean;
  backLabel?: string;
}) {
  const overlays = useOverlays();
  const [draft, setDraft] = useState<SubmissionDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contactId, setContactId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getSubmissionDraftAction(kind, id).then((result) => {
      if (!active) return;
      if (!result.ok) return setError(result.error);
      setDraft(result.data);
      setContactId(result.data.defaultContactId ?? "");
      setSubject(result.data.subject);
      setBody(result.data.body);
    });
    return () => { active = false; };
  }, [kind, id]);

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-[13px] text-muted-foreground">{error}</p>
        <Btn className="mt-4" onClick={onBack}>{backLabel}</Btn>
      </div>
    );
  }
  if (!draft) return <div className="grid min-h-52 place-items-center text-[13px] text-muted-foreground">Preparing the submission…</div>;

  const contact = draft.contacts.find((candidate) => candidate.id === contactId) ?? null;
  const fileCount = draft.items.reduce((count, item) => count + item.documents.length, 0);
  const withoutFile = draft.items.filter((item) => !item.documents.length).length;
  const blocked = draft.outstanding > 0;

  const copy = () => {
    void navigator.clipboard
      .writeText(emailClipboardText(contact?.email ?? "", subject, body))
      .then(() => overlays.toast("Email copied", "Paste it into a new message in your mailbox."))
      .catch(() => overlays.toast("Couldn’t copy", "Your browser blocked clipboard access — select the text and copy it instead."));
  };

  const submit = () =>
    startTransition(async () => {
      const result = await submitToPacificCrossAction(kind, id, { contactId, subject, body }).catch(
        (failure: unknown) => ({ ok: false as const, error: failure instanceof Error ? failure.message : "The request didn’t reach the server." }),
      );
      if (!result.ok) return overlays.toast("Couldn’t record the submission", result.error);
      overlays.toast("Marked as sent", `Logged to ${contact?.email ?? "Pacific Cross"} — nothing was sent from the CRM.`);
      onSubmitted(result.data.submittedDate);
    });

  return (
    <div className={cn(embedded && "flex flex-1 flex-col")}>
      {!embedded && (
        <>
          <div className="flex items-center gap-2 text-brand-hover"><I.send size={16} /><span className="text-[11px] font-bold uppercase tracking-[.09em]">Submit to Pacific Cross</span></div>
          <h3 className="mt-1 text-[17px] font-bold tracking-[-.015em]">{draft.clientName}</h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground">{draft.referenceNo ?? (kind === "application" ? "Application" : "Claim")}</p>
        </>
      )}

      {draft.submittedDate && (
        <div className="mt-3 rounded-md border border-blue-border bg-blue-soft/50 px-3 py-2 text-[12px]">
          Already submitted on {fmtDate(draft.submittedDate)}. Submitting again logs another email and keeps the original date.
        </div>
      )}
      {blocked && (
        <div className="mt-3 rounded-md border border-red-border bg-red-soft/50 px-3 py-2 text-[12px]">
          {draft.outstanding} required item{draft.outstanding === 1 ? " is" : "s are"} still outstanding — go back to the checklist first.
        </div>
      )}

      <div className={cn("space-y-3", embedded ? "mt-3" : "mt-4 max-h-[52vh] overflow-y-auto pr-1")}>
        <Field label="To" hint={contact ? `${contact.name}${contact.department ? ` · ${contact.department}` : ""}` : undefined}>
          {draft.contacts.length ? (
            <select aria-label="Recipient" className={cn(SEL, "w-full")} value={contactId} onChange={(event) => setContactId(event.target.value)}>
              {draft.contacts.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.email} — {candidate.name}</option>)}
            </select>
          ) : (
            <p className="text-[12.5px] text-red">No active Pacific Cross {kind === "application" ? "New Business" : "Claims"} contact. Add one under Officer contacts.</p>
          )}
        </Field>
        <Field label="Subject">
          <input aria-label="Subject" className={INPUT} value={subject} onChange={(event) => setSubject(event.target.value)} />
        </Field>
        <Field label="Message">
          <textarea aria-label="Message" className={cn(AREA, "text-[13px]")} rows={11} value={body} onChange={(event) => setBody(event.target.value)} />
        </Field>

        <div className="rounded-md border border-border-soft bg-surface-2 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[12px] font-semibold">Attachments</div>
              <div className="text-[11.5px] text-muted-foreground">
                {fileCount} file{fileCount === 1 ? "" : "s"} from the checklist{withoutFile ? ` · ${withoutFile} item${withoutFile === 1 ? "" : "s"} without an uploaded file` : ""}
              </div>
            </div>
            {fileCount ? (
              <a
                href={`/api/submissions/${kind}/${id}/zip`}
                download
                className="inline-flex h-[30px] items-center gap-1.5 rounded-sm border border-border-strong bg-card px-2.5 text-[12.5px] font-semibold hover:bg-hover"
              >
                <I.download size={13} /> Download all (ZIP)
              </a>
            ) : (
              <Btn size="sm" disabled title="Upload files on the checklist first"><I.download size={13} /> Download all (ZIP)</Btn>
            )}
          </div>
          <ul className="mt-2 space-y-1.5">
            {draft.items.map((item) => (
              <li key={item.requirementId} className="flex items-start gap-2 text-[12px]">
                <RequirementStatusDot status={item.status} className="size-5 [&_svg]:size-[11px]" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{item.documentName}{item.appliesTo ? ` — ${item.appliesTo}` : ""}</div>
                  {item.documents.length ? (
                    <div className="truncate text-[11.5px] text-muted-foreground">{item.documents.map((document) => document.name).join(", ")}</div>
                  ) : (
                    <div className="text-[11.5px] text-amber">No file uploaded — attach it yourself or send it later</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[11.5px] text-subtle">
          Nothing is sent from the CRM yet. Copy the email into your mailbox, attach the ZIP, send it, then mark it as submitted here.
        </p>
      </div>

      {embedded && <div aria-hidden className="min-h-6 flex-1" />}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 border-t border-border-soft",
          embedded ? "sticky -bottom-6 -mx-6 -mb-6 bg-surface-2 px-5 py-3.5" : "mt-5 pt-4",
        )}
      >
        <Btn onClick={onBack} disabled={pending}>← {backLabel}</Btn>
        <div className="flex gap-2">
          <Btn onClick={copy}><I.copy size={14} /> Copy email text</Btn>
          <Btn variant="primary" disabled={pending || blocked || !contact || !subject.trim() || !body.trim()} onClick={submit}>
            <I.check size={14} /> Mark as sent
          </Btn>
        </div>
      </div>
    </div>
  );
}
