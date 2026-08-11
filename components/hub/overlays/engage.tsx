"use client";

import { useEffect, useState } from "react";

import { listActiveTemplatesAction } from "@/app/(app)/templates/actions";
import type { EmailTemplate } from "@/lib/repositories/templates/email-template.entity";
import { I, type IconName } from "../icons";
import { usePersona } from "../persona";
import { Avatar } from "../primitives";
import { ClientPicker, DrawerField, type PickedClient } from "./client-picker";
import { Drawer } from "./drawer";
import { useOverlays, type EngageContact } from "./overlay-provider";
import { EmailForm, type EmailTarget } from "./send-email";

/**
 * Engage drawer — the shared human-in-the-loop **email** composer opened from anywhere
 * WITHOUT an open Contact Profile (design engage.jsx; on the profile the same
 * fields render inline as the Email tab, via the same `EmailForm`). Until a provider is
 * connected, email actions create a communications row + timeline entry only.
 *
 * Calls are deliberately not here — see `./log-call.tsx`. This drawer is now a thin wrapper
 * around `EmailForm` (`./send-email.tsx`), the same shape `LogCallModal` uses around
 * `LogCallForm`: resolve the contact (via the shared `ClientPicker`, not a hand-rolled copy),
 * then hand off to the one shared form.
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
  const overlays = useOverlays();
  const persona = usePersona();

  const [contact, setContact] = useState<EngageContact | null>(initialContact ?? null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  useEffect(() => {
    listActiveTemplatesAction().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const pickContact = (c: PickedClient) => {
    setContact({ clientId: c.id, name: c.name, email: c.email });
  };

  const target: EmailTarget | null = contact
    ? {
        clientId: contact.clientId!,
        name: contact.name,
        email: contact.email,
        product: contact.product,
        premium: contact.premium,
        externalContactId: contact.externalContactId,
      }
    : null;

  return (
    <Drawer icon={cfg.icon} title={action.replace(/^Send /, "Log ")} sub={cfg.sub} onClose={onClose}>
      <div className="mb-4 flex gap-2.5 rounded-md border border-brand/25 bg-brand-soft p-3.5 text-[12.5px] leading-relaxed text-foreground">
        <I.command size={15} className="mt-0.5 shrink-0 text-brand" />
        <div>
          <b>Human-in-the-loop.</b> Review the draft, then click <b>Log email</b>. Emails and attachments are recorded only and are not delivered. The touch is logged to{" "}
          {contact ? contact.name + "’s" : "the contact’s"} timeline.
        </div>
      </div>

      {!contact && (
        <DrawerField label="Recipient" required className="mb-4">
          <ClientPicker value={null} onPick={pickContact} onClear={() => setContact(null)} placeholder="Search a lead or client…" />
        </DrawerField>
      )}
      {contact && (
        <div className="mb-4 flex items-center gap-2.5 rounded-md border border-border-soft bg-surface-2 px-3.5 py-2.5">
          <Avatar name={contact.name} size={30} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-[650]">{contact.name}</div>
            <div className="truncate text-[11.5px] text-subtle">
              Merge: {contact.name.split(" ")[0]} · {contact.product ?? "your plan"} · {persona.userName}
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

      {target && (
        <EmailForm
          target={target}
          templates={templates}
          initialTemplate={cfg.tpl}
          onSent={(advance, sent) => {
            overlays.toast("Email logged", `“${sent.template || "Email"}” recorded for ${target.name}; nothing was delivered.`);
            onSent?.();
            if (advance) overlays.openAdvanceLead(advance);
            else onClose();
          }}
        />
      )}
    </Drawer>
  );
}
