"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { listOptionalLibraryDocumentsAction } from "@/app/(app)/clients/engage-actions";
import { EmailAttachmentChoices } from "@/components/email/email-attachment-choices";
import { EmailSendControls } from "@/components/email/email-send-controls";
import {
  SENDER_MAILBOX,
  type EmailDraftSeed, type EmailOrigin, type EmailRecordKind, type EmailSendView,
} from "@/lib/communications/outbound-email.types";
import type { EmailTemplate } from "@/lib/repositories/templates/email-template.entity";
import { fillTemplate, pesoMerge, type MergeContext } from "@/lib/templates/merge";
import { I } from "../icons";
import { usePersona } from "../persona";
import { cn } from "@/lib/utils";
import { Field, INPUT } from "../primitives";
import { LibraryAttachmentPicker, templateNeedsLibraryAttachment } from "./library-attachment-picker";
import { OptionalLibraryAttachments } from "./optional-library-attachments";

/**
 * The shared, templated email composer. Two containers, one form, same split as
 * `../overlays/log-call.tsx`: the Contact Profile composer tab renders {@link EmailForm} inline,
 * everywhere else it's the body of `EngageDrawer` (`./engage.tsx`).
 *
 * Unlike `Log Call`, email genuinely needs a recipient/template/body — this IS the templated
 * composer the call form explicitly isn't. Reconciles the two payload shapes that used to diverge:
 * an internal client (never has `externalContactId`) and an external carrier/commission contact
 * (`engage.tsx`'s callers, which do). Sending goes through the shared review → send control:
 * nothing is sent until staff review the final email and click Send.
 */

/** Who the email is to, plus the merge-field context (product/premium) and send target. */
export interface EmailTarget {
  clientId: string;
  name: string;
  email?: string | null;
  product?: string | null;
  premium?: number | null;
  externalContactId?: string | null;
  /** Known record this email is about; bound into the contact origin. */
  record?: { kind: EmailRecordKind; id: string } | null;
}

export function EmailForm({
  target,
  templates,
  initialTemplate,
  initialDraft,
  onSent,
}: {
  target: EmailTarget;
  templates: EmailTemplate[];
  /** Preset so a nurture chip / an Engage action opens with its template preselected. */
  initialTemplate?: string;
  /**
   * Workflow-populated draft (origin, recipient, content, attachments). Empty subject and body
   * fall back to the template's merged copy.
   */
  initialDraft?: EmailDraftSeed;
  /**
   * Fired once Gmail accepted the email and its workflow update completed. Toast copy stays the
   * caller's; the lead-advance suggestion, if any, is `view.advance`.
   */
  onSent: (view: EmailSendView) => void;
}) {
  const router = useRouter();
  const persona = usePersona();
  const canAttachLibrary = persona.can("documentLibrary", "view");

  const origin = useMemo<EmailOrigin>(
    () => initialDraft?.origin
      ?? { type: "contact", clientId: target.clientId, ...(target.record ? { record: target.record } : {}) },
    [initialDraft?.origin, target.clientId, target.record],
  );
  const recipientLocked = origin.type === "proposal_request";
  const lockedDocumentIds = useMemo(
    () => (origin.type === "proposal_delivery" ? initialDraft?.documentIds ?? [] : []),
    [origin.type, initialDraft?.documentIds],
  );
  const externalContactId = initialDraft?.externalContactId ?? target.externalContactId ?? undefined;

  // A workflow draft keeps its own template (or none); the drawer's default applies only to fresh emails.
  const [tpl, setTpl] = useState(initialDraft ? initialDraft.templateName ?? "" : initialTemplate ?? "");
  const [recipient, setRecipient] = useState(initialDraft?.recipient ?? target.email ?? "");
  const [subject, setSubject] = useState(initialDraft?.subject ?? "");
  const [body, setBody] = useState(initialDraft?.body ?? "");
  // Named "required" so `grep requiredLibraryDocumentId` enumerates every read of
  // the mandatory gate. Optional attachments live in their own state and must
  // never appear in the ready check or the red banner below.
  const [requiredLibraryDocumentId, setRequiredLibraryDocumentId] = useState(initialDraft?.requiredLibraryDocumentId ?? "");
  const [optionalLibraryDocumentIds, setOptionalLibraryDocumentIds] = useState<string[]>(initialDraft?.optionalLibraryDocumentIds ?? []);
  const [documentIds, setDocumentIds] = useState<string[]>(initialDraft?.documentIds ?? []);
  const [emailAttachments, setEmailAttachments] = useState(initialDraft?.emailAttachments ?? []);
  // Guards the seed below so it only ever fires once per mount — needed because a caller
  // (EngageDrawer) may still be fetching `templates` when this mounts, so the initial template
  // can't always be seeded synchronously from a useState initializer. A workflow draft that
  // already carries its own copy is never overwritten.
  const [seeded, setSeeded] = useState(Boolean(initialDraft?.subject || initialDraft?.body));

  const ctx = useMemo<MergeContext>(
    () => ({
      first_name: target.name.split(" ")[0],
      product: target.product ?? undefined,
      premium: pesoMerge(target.premium),
      agent: persona.userName,
    }),
    [target.name, target.product, target.premium, persona.userName],
  );

  // Render-phase adjustment (not an effect): seed once the templates arrive.
  if (!seeded && templates.length > 0) {
    const t = templates.find((x) => x.name === tpl);
    if (t) {
      setSeeded(true);
      setSubject(fillTemplate(t.subject, ctx));
      setBody(fillTemplate(t.body, ctx));
    }
  }

  const applyTemplate = (name: string) => {
    setTpl(name);
    setRequiredLibraryDocumentId("");
    setOptionalLibraryDocumentIds([]);
    const t = templates.find((x) => x.name === name);
    if (t) {
      setSubject(fillTemplate(t.subject, ctx));
      setBody(fillTemplate(t.body, ctx));
    }
  };

  const loadOptional = useCallback(
    () => listOptionalLibraryDocumentsAction(target.clientId),
    [target.clientId],
  );

  const needsRequired = templateNeedsLibraryAttachment(tpl);
  const ready = !!recipient.trim() && !!subject.trim() && (!needsRequired || !!requiredLibraryDocumentId);

  const draft = useMemo<EmailDraftSeed>(
    () => ({
      origin,
      recipient,
      subject,
      body,
      ...(tpl ? { templateName: tpl } : {}),
      ...(externalContactId ? { externalContactId } : {}),
      ...(requiredLibraryDocumentId ? { requiredLibraryDocumentId } : {}),
      optionalLibraryDocumentIds,
      documentIds,
      emailAttachments,
    }),
    [origin, recipient, subject, body, tpl, externalContactId, requiredLibraryDocumentId, optionalLibraryDocumentIds, documentIds, emailAttachments],
  );

  const handleSent = useCallback((view: EmailSendView) => {
    router.refresh();
    onSent(view);
  }, [router, onSent]);

  const [pane, setPane] = useState<"write" | "preview">("write");
  const attachmentCount = (requiredLibraryDocumentId ? 1 : 0) + optionalLibraryDocumentIds.length + documentIds.length + emailAttachments.length;

  const headerFields = (
    <div className="grid grid-cols-2 gap-3.5">
      <Field label="Template" required>
        <select className={INPUT} value={tpl} onChange={(e) => applyTemplate(e.target.value)}>
          <option value="">Select…</option>
          {templates.map((t) => (
            <option key={t.id}>{t.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Recipient" required>
        <input className={INPUT} type="email" value={recipient} readOnly={recipientLocked}
          title={recipientLocked ? "Sent to the selected Pacific Cross contact." : undefined}
          onChange={(e) => setRecipient(e.target.value)} placeholder="name@email.com" />
      </Field>
    </div>
  );
  const subjectField = (
    <Field label="Subject" required className="mt-3.5">
      <input className={INPUT} value={subject} onChange={(e) => setSubject(e.target.value)} />
    </Field>
  );
  const messageArea = (rows = 150) => (
    <textarea
      aria-label="Message"
      className="w-full rounded-md border border-border-strong bg-card px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-brand"
      style={{ minHeight: rows }}
      value={body}
      onChange={(e) => setBody(e.target.value)}
    />
  );
  const attachments = canAttachLibrary ? (
    <>
      <LibraryAttachmentPicker clientId={target.clientId} templateName={tpl} value={requiredLibraryDocumentId} onChange={setRequiredLibraryDocumentId} />
      <OptionalLibraryAttachments
        load={loadOptional}
        value={optionalLibraryDocumentIds}
        onChange={setOptionalLibraryDocumentIds}
        exclude={requiredLibraryDocumentId || undefined}
        fixHref={`/clients/${target.clientId}/edit`}
      />
      <EmailAttachmentChoices
        clientId={target.clientId}
        documentIds={documentIds}
        onDocumentIds={setDocumentIds}
        emailAttachments={emailAttachments}
        onEmailAttachments={setEmailAttachments}
        lockedDocumentIds={lockedDocumentIds}
      />
    </>
  ) : null;
  // The preview reads as a real email: a white sheet with a firm border and a resting shadow.
  const previewSheet = (
    <div className="overflow-hidden rounded-lg border border-border-strong bg-card shadow-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-border-soft bg-surface-2 px-4 py-3 text-[12px]">
        <dt className="text-subtle">From</dt><dd className="break-all">Pacific Insurance PH &lt;{SENDER_MAILBOX}&gt;</dd>
        <dt className="text-subtle">To</dt><dd className="break-all font-semibold">{recipient || target.name}</dd>
        <dt className="text-subtle">Subject</dt><dd className="break-words font-semibold">{subject || <span className="font-normal text-subtle">(no subject)</span>}</dd>
        <dt className="text-subtle">Files</dt><dd>{attachmentCount ? `${attachmentCount} attached` : "None"}</dd>
      </dl>
      <div className="max-h-72 overflow-auto whitespace-pre-wrap px-4 py-3.5 text-[13px] leading-relaxed text-foreground">{body || <span className="text-subtle">No message yet.</span>}</div>
    </div>
  );
  const requiredAlert = needsRequired && !requiredLibraryDocumentId ? (
    <div className="mt-3.5 flex gap-2.5 rounded-md border border-red-border bg-red-soft p-3.5 text-[12.5px] leading-relaxed text-red">
      <I.alertTri size={16} className="mt-0.5 shrink-0" />
      <div>
        <b>Carrier attachment required.</b> Select an approved asset above, or choose a template
        that doesn&apos;t need one.
      </div>
    </div>
  ) : null;
  const sendControls = <EmailSendControls draft={draft} ready={ready} onSent={handleSent} />;

  // Write and Preview share one box, so the preview never adds a second long block to scroll past.
  return (
    <div>
      {headerFields}
      {subjectField}
      <div className="mt-3.5 overflow-hidden rounded-lg border border-border-strong">
        <div role="tablist" aria-label="Message" className="flex border-b border-border-soft bg-surface-2">
          {(["write", "preview"] as const).map((p) => (
            <button key={p} type="button" role="tab" aria-selected={pane === p} onClick={() => setPane(p)}
              className={cn("px-4 py-2 text-[12.5px] font-semibold transition-colors", pane === p ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {p === "write" ? "Write" : "Preview"}
            </button>
          ))}
          <span className="ml-auto self-center px-3 text-[11.5px] text-subtle">{attachmentCount ? `${attachmentCount} file${attachmentCount === 1 ? "" : "s"}` : "No files"}</span>
        </div>
        {pane === "write"
          ? <div className="p-2">{messageArea(170)}</div>
          : <div className="bg-surface-3 p-3">{previewSheet}</div>}
      </div>
      {attachments && (
        // Opens on its own when the template needs a carrier file, so the red notice below points at something visible.
        <details open={needsRequired && !requiredLibraryDocumentId ? true : undefined} className="group mt-3.5 rounded-md border border-border-soft">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[12.5px] font-semibold [&::-webkit-details-marker]:hidden">
            <I.chevRight size={14} className="transition-transform group-open:rotate-90" /> Attachments
            <span className="font-normal text-subtle">{attachmentCount ? `${attachmentCount} selected` : "None selected"}</span>
          </summary>
          <div className="border-t border-border-soft px-3.5 pb-3.5">{attachments}</div>
        </details>
      )}
      {requiredAlert}
      {sendControls}
    </div>
  );
}
