"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { sendEmailAction, type LeadAdvanceSuggestion } from "@/app/(app)/clients/engage-actions";
import type { EmailTemplate } from "@/lib/repositories/templates/email-template.entity";
import { fillTemplate, pesoMerge, type MergeContext } from "@/lib/templates/merge";
import { I } from "../icons";
import { usePersona } from "../persona";
import { Avatar, Btn, Field, INPUT } from "../primitives";
import { LibraryAttachmentPicker, templateNeedsLibraryAttachment } from "./library-attachment-picker";
import { useOverlays } from "./overlay-provider";

/**
 * The shared, templated email composer. Two containers, one form, same split as
 * `../overlays/log-call.tsx`: the Contact Profile composer tab renders {@link EmailForm} inline,
 * everywhere else it's the body of `EngageDrawer` (`./engage.tsx`).
 *
 * Unlike `Log Call`, email genuinely needs a recipient/template/body — this IS the templated
 * composer the call form explicitly isn't. Reconciles the two payload shapes that used to diverge:
 * an internal client (never has `externalContactId`) and an external carrier/commission contact
 * (`engage.tsx`'s callers, which do).
 */

/** Who the email is to, plus the merge-field context (product/premium) and send target. */
export interface EmailTarget {
  clientId: string;
  name: string;
  email?: string | null;
  product?: string | null;
  premium?: number | null;
  externalContactId?: string | null;
}

export function EmailForm({
  target,
  templates,
  initialTemplate,
  onSent,
}: {
  target: EmailTarget;
  templates: EmailTemplate[];
  /** Preset so a nurture chip / an Engage action opens with its template preselected. */
  initialTemplate?: string;
  /**
   * Fired after a successful log. Carries what was actually sent so the caller can toast with its
   * own copy — the two containers word the confirmation slightly differently, so that stays their
   * call rather than being baked in here.
   */
  onSent: (advance: LeadAdvanceSuggestion | undefined, sent: { template: string; subject: string }) => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const persona = usePersona();
  const [pending, startTransition] = useTransition();

  const [tpl, setTpl] = useState(initialTemplate ?? "");
  const [recipient, setRecipient] = useState(target.email ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [libraryDocumentId, setLibraryDocumentId] = useState("");
  // Guards the seed below so it only ever fires once per mount — needed because a caller
  // (EngageDrawer) may still be fetching `templates` when this mounts, so the initial template
  // can't always be seeded synchronously from a useState initializer.
  const [seeded, setSeeded] = useState(false);

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
    setLibraryDocumentId("");
    const t = templates.find((x) => x.name === name);
    if (t) {
      setSubject(fillTemplate(t.subject, ctx));
      setBody(fillTemplate(t.body, ctx));
    }
  };

  const canSend = !pending && !!recipient.trim() && !!subject.trim();
  const canComplete = canSend && (!templateNeedsLibraryAttachment(tpl) || !!libraryDocumentId);

  const submit = () =>
    startTransition(async () => {
      const res = await sendEmailAction({
        clientId: target.clientId,
        recipient,
        subject,
        body,
        templateName: tpl || null,
        externalContactId: target.externalContactId ?? null,
        libraryDocumentIds: libraryDocumentId ? [libraryDocumentId] : [],
      });
      if (!res.ok) return overlays.toast("Couldn’t log email", res.error);
      router.refresh();
      onSent(res.data.advance, { template: tpl, subject });
    });

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
          <input className={INPUT} type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="name@email.com" />
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
      <LibraryAttachmentPicker clientId={target.clientId} templateName={tpl} value={libraryDocumentId} onChange={setLibraryDocumentId} />

      <div className="mt-5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">
          <I.mail size={13} /> Preview
        </div>
        <div className="rounded-md border border-border-soft bg-surface-2 p-4">
          <div className="mb-2.5 flex items-center gap-2.5">
            <Avatar name={persona.userName} size={34} />
            <div>
              <div className="text-[13px] font-[650]">
                {persona.userName} <span className="font-normal text-subtle">· Pacific Insurance PH</span>
              </div>
              <div className="text-[11.5px] text-subtle">To: {recipient || target.name}</div>
            </div>
          </div>
          <div className="text-[13.5px] font-[650]">
            {subject || <span className="font-normal text-faint">No subject yet — pick a template above</span>}
          </div>
          <div className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground">
            {body || <span className="text-faint">Message body will appear here.</span>}
          </div>
        </div>
      </div>

      {templateNeedsLibraryAttachment(tpl) && !libraryDocumentId && (
        <div className="mt-3.5 flex gap-2.5 rounded-md border border-red-border bg-red-soft p-3.5 text-[12.5px] leading-relaxed text-red">
          <I.alertTri size={16} className="mt-0.5 shrink-0" />
          <div>
            <b>Carrier attachment required.</b> Select an approved asset above, or choose a template
            that doesn&apos;t need one.
          </div>
        </div>
      )}

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <span className="text-[11.5px] text-faint">
          Logged only — neither the email nor selected attachments are delivered. Actor: {persona.userName}.
        </span>
        <Btn variant="primary" disabled={!canComplete} onClick={submit}>
          <I.send size={15} /> {pending ? "Logging…" : "Log email"}
        </Btn>
      </div>
    </>
  );
}
