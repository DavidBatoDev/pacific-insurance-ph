"use client";

import { useEffect, useState } from "react";

import { getSubmissionDraftAction, type SubmissionDraft } from "@/app/(app)/submissions/actions";
import { EmailSendControls } from "@/components/email/email-send-controls";
import { RecentEmailSends } from "@/components/email/recent-email-sends";
import { RequirementStatusDot } from "@/components/hub/requirement-status";
import type { EmailDraftSeed, EmailOrigin } from "@/lib/communications/outbound-email.types";
import { fmtDate } from "@/lib/format";
import { emailClipboardText, type SubmissionKind } from "@/lib/submissions/submission-email";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { AREA, Btn, Field, INPUT, SEL } from "../primitives";
import { useOverlays } from "./overlay-provider";

/**
 * The finalizing step after a requirements checklist: compose the email to Pacific Cross, review
 * the exact package (every checklist original attached by the server), then send it through Gmail
 * from the agency mailbox. The record moves to its submitted status only after Gmail accepts it.
 * Download ZIP and Copy email text are conveniences with no effect on the workflow.
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
  /** Gmail accepted the submission and its workflow update (status/date) completed. */
  onSubmitted: () => void;
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
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    let active = true;
    getSubmissionDraftAction(kind, id).then((result) => {
      if (!active) return;
      if (!result.ok) return setError(result.error);
      setDraft(result.data);
      setContactId(result.data.defaultContactId ?? "");
      setSubject(result.data.subject);
      setBody(result.data.body);
    }).catch(() => { if (active) setError("The submission could not be prepared. Reload and try again."); });
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
  const blockedReason = draft.outstanding.length
    ? `Still outstanding on the checklist: ${draft.outstanding.join(", ")}.`
    : draft.withoutFile.length
      ? `Upload the file for: ${draft.withoutFile.join(", ")}. Every required item is sent as an attachment.`
      : !contact
        ? "Pick a Pacific Cross contact to send to."
        : null;
  const emailDraft: EmailDraftSeed = {
    origin: { type: "submission", kind, id, contactId },
    recipient: contact?.email ?? "",
    externalContactId: contact?.id,
    subject,
    body,
    // The server attaches exactly the checklist originals; browser selections are ignored.
    documentIds: [],
  };
  const isThisSubmission = (origin: EmailOrigin) => origin.type === "submission" && origin.kind === kind && origin.id === id;

  const copy = () => {
    void navigator.clipboard
      .writeText(emailClipboardText(contact?.email ?? "", subject, body))
      .then(() => overlays.toast("Email copied", "Copied for reference only — sending it elsewhere does not mark the submission."))
      .catch(() => overlays.toast("Couldn’t copy", "Your browser blocked clipboard access — select the text and copy it instead."));
  };

  const submitted = () => {
    setSentCount((count) => count + 1);
    overlays.toast("Sent to Pacific Cross", "Accepted by Gmail. Delivery and reading are not confirmed.");
    onSubmitted();
  };

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
          Already submitted on {fmtDate(draft.submittedDate)}. Sending again emails Pacific Cross another copy and keeps the original date.
        </div>
      )}
      {draft.outstanding.length > 0 && (
        <div role="alert" className="mt-3 rounded-md border border-red-border bg-red-soft/50 px-3 py-2 text-[12px]">
          Still outstanding — go back to the checklist first: {draft.outstanding.join(", ")}.
        </div>
      )}
      {!draft.outstanding.length && draft.withoutFile.length > 0 && (
        <div role="alert" className="mt-3 rounded-md border border-red-border bg-red-soft/50 px-3 py-2 text-[12px]">
          Required items without an uploaded file: {draft.withoutFile.join(", ")}. Upload each file on the checklist before sending.
        </div>
      )}

      <div className={cn("space-y-3", embedded ? "mt-3" : "mt-4 max-h-[52vh] overflow-y-auto pr-1")}>
        <RecentEmailSends
          clientId={draft.clientId}
          matches={isThisSubmission}
          title="Earlier sends of this submission"
          refreshKey={sentCount}
          onSettled={onSubmitted}
        />
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
                {fileCount} file{fileCount === 1 ? "" : "s"} from the checklist, each attached to the email. Review shows the exact names and sizes.
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
                    <div className="text-[11.5px] text-red">No file uploaded — required before sending</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <EmailSendControls
          draft={emailDraft}
          ready={Boolean(contact && subject.trim() && body.trim())}
          blockedReason={blockedReason}
          reviewLabel="Review submission"
          sendLabel="Send to Pacific Cross"
          onSent={submitted}
        />
      </div>

      {embedded && <div aria-hidden className="min-h-6 flex-1" />}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 border-t border-border-soft",
          embedded ? "sticky -bottom-6 -mx-6 -mb-6 bg-surface-2 px-5 py-3.5" : "mt-5 pt-4",
        )}
      >
        <Btn onClick={onBack}>← {backLabel}</Btn>
        <Btn onClick={copy}><I.copy size={14} /> Copy email text</Btn>
      </div>
    </div>
  );
}
