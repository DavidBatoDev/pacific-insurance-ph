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

  return (
    <>
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
      <Field label="Subject" required className="mt-3.5">
        <input className={INPUT} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Message" className="mt-3.5">
        <textarea
          className="min-h-[150px] w-full rounded-md border border-border-strong bg-card px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-brand"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>
      {canAttachLibrary && (
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
      )}

      <div className="mt-5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">
          <I.mail size={13} /> Preview
        </div>
        <div className="rounded-md border border-border-soft bg-surface-2 p-4">
          <div className="mb-2.5 text-[11.5px] text-subtle">
            <div>From: Pacific Insurance PH &lt;{SENDER_MAILBOX}&gt;</div>
            <div>To: {recipient || target.name}</div>
          </div>
          <div className="text-[13.5px] font-[650]">{subject}</div>
          <div className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground">{body}</div>
        </div>
      </div>

      {needsRequired && !requiredLibraryDocumentId && (
        <div className="mt-3.5 flex gap-2.5 rounded-md border border-red-border bg-red-soft p-3.5 text-[12.5px] leading-relaxed text-red">
          <I.alertTri size={16} className="mt-0.5 shrink-0" />
          <div>
            <b>Carrier attachment required.</b> Select an approved asset above, or choose a template
            that doesn&apos;t need one.
          </div>
        </div>
      )}

      <EmailSendControls draft={draft} ready={ready} onSent={handleSent} />
    </>
  );
}
