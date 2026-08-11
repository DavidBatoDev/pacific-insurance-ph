"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { sendEmailAction } from "@/app/(app)/clients/engage-actions";
import { searchClientsForPalette, type PaletteClientHit } from "@/app/(app)/search/actions";
import { listActiveTemplatesAction } from "@/app/(app)/templates/actions";
import type { EmailTemplate } from "@/lib/repositories/templates/email-template.entity";
import { fillTemplate, pesoMerge, type MergeContext } from "@/lib/templates/merge";
import { I, type IconName } from "../icons";
import { usePersona } from "../persona";
import { Avatar, Btn } from "../primitives";
import { Drawer } from "./drawer";
import { useOverlays, type EngageContact } from "./overlay-provider";
import { LibraryAttachmentPicker, templateNeedsLibraryAttachment } from "./library-attachment-picker";

/**
 * Engage drawer — the shared human-in-the-loop **email** composer opened from anywhere
 * WITHOUT an open Contact Profile (design engage.jsx; on the profile the same
 * fields render inline as the Email tab). Until a provider is connected,
 * email actions create a communications row + timeline entry only.
 *
 * Calls are deliberately not here. `Log Call` is a structured discovery form with no recipient,
 * template or body (`../overlays/log-call.tsx`, ../docs/web/lead-workflow.md §4); it used to be
 * two of this drawer's actions, which meant the board's call form silently dropped the four
 * discovery fields the templated composer has no place for.
 */

interface ActionCfg {
  tpl?: string;
  icon: IconName;
  sub: string;
}

export const ENGAGE_ACTIONS: Record<string, ActionCfg> = {
  "Send Email": { tpl: "New inquiry response", icon: "mail", sub: "Compose from a template and log the intended email." },
  "Send Brochure": { tpl: "Send brochure", icon: "mail", sub: "Choose the approved plan brochure and log the intended email." },
  "Send Intake / Application Form": { tpl: "Send application form", icon: "fileText", sub: "Choose the approved application form and log the intended email." },
  "Send Intake Form": { tpl: "Send application form", icon: "fileText", sub: "Choose the approved application form and log the intended email." },
  "Send Payment Instruction": { tpl: "Payment instruction", icon: "peso", sub: "Log the intended payment-options email." },
  "Send Renewal Notice": { tpl: "Renewal reminder", icon: "refresh", sub: "Log the intended renewal-notice email." },
  "Send Proposal": { tpl: "Proposal / Quote Delivery", icon: "send", sub: "Log the intended proposal email; no delivery occurs." },
  "Request Commission Voucher": { tpl: "Commission Voucher Request", icon: "mail", sub: "Email the Pacific Cross commission contact to request the voucher." },
  "Log Commission Follow-Up": { tpl: "Commission Follow-Up", icon: "mail", sub: "Chase a commission voucher that hasn't arrived yet." },
};

const INPUT =
  "h-9 w-full rounded-md border border-border-strong bg-card px-3 text-[13.5px] outline-none transition-colors focus:border-brand focus:ring-[3px] focus:ring-brand/20";

export function EngageDrawer({
  action,
  contact: initialContact,
  onSent,
  onClose,
}: {
  action: string;
  contact?: EngageContact;
  onSent?: () => void;
  onClose: () => void;
}) {
  const cfg = ENGAGE_ACTIONS[action] ?? ENGAGE_ACTIONS["Send Email"];
  const router = useRouter();
  const overlays = useOverlays();
  const persona = usePersona();
  const [pending, startTransition] = useTransition();

  const [contact, setContact] = useState<EngageContact | null>(initialContact ?? null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [tpl, setTpl] = useState(cfg.tpl ?? "");
  const [recipient, setRecipient] = useState(initialContact?.email ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [libraryDocumentId, setLibraryDocumentId] = useState("");
  const seededRef = useRef(false);

  const ctx = useMemo<MergeContext>(
    () => ({
      first_name: contact?.name.split(" ")[0],
      product: contact?.product ?? undefined,
      premium: pesoMerge(contact?.premium),
      agent: persona.userName,
    }),
    [contact, persona.userName],
  );

  useEffect(() => {
    listActiveTemplatesAction().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  // Seed subject/body once templates + contact are available.
  useEffect(() => {
    if (seededRef.current || !contact || templates.length === 0) return;
    const t = templates.find((x) => x.name === tpl);
    if (t) {
      seededRef.current = true;
      setSubject(fillTemplate(t.subject, ctx));
      setBody(fillTemplate(t.body, ctx));
    }
  }, [templates, contact, tpl, ctx]);

  const applyTemplate = (name: string) => {
    setTpl(name);
    setLibraryDocumentId("");
    const t = templates.find((x) => x.name === name);
    if (t) {
      setSubject(fillTemplate(t.subject, ctx));
      setBody(fillTemplate(t.body, ctx));
    }
  };

  const pickContact = (r: PaletteClientHit) => {
    const next: EngageContact = { clientId: r.id, name: r.name, email: r.email };
    setContact(next);
    setRecipient(r.email ?? "");
    seededRef.current = false;
  };

  const canSend = !!contact?.clientId && !pending && !!recipient.trim() && !!subject.trim();
  const canComplete = canSend && (!templateNeedsLibraryAttachment(tpl) || !!libraryDocumentId);

  const send = () => {
    if (!contact?.clientId) return;
    startTransition(async () => {
      const res = await sendEmailAction({
        clientId: contact.clientId!,
        recipient,
        subject,
        body,
        templateName: tpl || null,
        externalContactId: contact.externalContactId ?? null,
        libraryDocumentIds: libraryDocumentId ? [libraryDocumentId] : [],
      });
      if (res.ok) {
        overlays.toast(
          "Email logged",
          `“${tpl || "Email"}” recorded for ${contact.name}; nothing was delivered.`,
        );
        router.refresh();
        onSent?.();
        if (res.data.advance) {
          overlays.openAdvanceLead(res.data.advance);
        } else {
          onClose();
        }
      } else {
        overlays.toast("Couldn’t complete the action", res.error);
      }
    });
  };

  return (
    <Drawer
      icon={cfg.icon}
      title={action.replace(/^Send /, "Log ")}
      sub={cfg.sub}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!canComplete} onClick={send}>
            <I.send size={15} /> {pending ? "Logging…" : "Log email"}
          </Btn>
        </>
      }
    >
      <div className="mb-4 flex gap-2.5 rounded-md border border-brand/25 bg-brand-soft p-3.5 text-[12.5px] leading-relaxed text-foreground">
        <I.command size={15} className="mt-0.5 shrink-0 text-brand" />
        <div>
          <b>Human-in-the-loop.</b> Review the draft, then click <b>Log email</b>. Emails and attachments are recorded only and are not delivered. The touch is logged to{" "}
          {contact ? contact.name + "’s" : "the contact’s"} timeline.
        </div>
      </div>

      {!contact && <RecipientPicker onPick={pickContact} />}
      {contact && (
        <div className="mb-4 flex items-center gap-2.5 rounded-md border border-border-soft bg-surface-2 px-3.5 py-2.5">
          <Avatar name={contact.name} size={30} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-[650]">{contact.name}</div>
            <div className="truncate text-[11.5px] text-subtle">
              Merge: {ctx.first_name ?? "—"} · {ctx.product ?? "your plan"} · {persona.userName}
            </div>
          </div>
          {!initialContact && (
            <button
              onClick={() => setContact(null)}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-hover"
            >
              <I.plus size={15} className="rotate-45" />
            </button>
          )}
        </div>
      )}

      {contact && (
        <>
          <div className="grid grid-cols-2 gap-4">
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
          <Field label="Subject" required className="mt-4">
            <input className={INPUT} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message" className="mt-4">
            <textarea
              className="min-h-[170px] w-full rounded-md border border-border-strong bg-card px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-brand"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          <LibraryAttachmentPicker clientId={contact.clientId!} templateName={tpl} value={libraryDocumentId} onChange={setLibraryDocumentId} />

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
                  <div className="text-[11.5px] text-subtle">To: {recipient || contact.name}</div>
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
        </>
      )}

    </Drawer>
  );
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
        {label} {required && <span className="text-red">*</span>}
      </label>
      {children}
    </div>
  );
}

function RecipientPicker({ onPick }: { onPick: (c: PaletteClientHit) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PaletteClientHit[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const mySeq = ++seq.current;
    const t = setTimeout(() => {
      searchClientsForPalette(term)
        .then((rows) => {
          if (seq.current === mySeq) setResults(rows.slice(0, 6));
        })
        .catch(() => setResults([]));
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
        Recipient <span className="text-red">*</span>
      </label>
      <div className="flex h-[38px] items-center gap-2.5 rounded-md border border-border-strong bg-card px-3 text-muted-foreground focus-within:border-brand">
        <I.search size={16} />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a lead or client…"
          className="flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-subtle"
        />
      </div>
      {results.map((r) => (
        <button
          key={r.id}
          onClick={() => onPick(r)}
          className="mt-1.5 flex w-full items-center gap-2.5 rounded-md border border-border-soft px-3 py-2 text-left transition-colors hover:bg-hover"
        >
          <Avatar name={r.name} size={30} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-[600]">{r.name}</div>
            <div className="truncate text-[11.5px] text-subtle">
              {[r.email, r.clientType].filter(Boolean).join(" · ")}
            </div>
          </div>
          <I.plus size={16} className="text-subtle" />
        </button>
      ))}
    </div>
  );
}
