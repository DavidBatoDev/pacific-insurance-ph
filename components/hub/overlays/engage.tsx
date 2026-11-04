"use client";

import { useEffect, useState } from "react";

import { listActiveTemplatesAction } from "@/app/(app)/templates/actions";
import type { EmailDraftSeed, EmailSendView } from "@/lib/communications/outbound-email.types";
import type { EmailTemplate } from "@/lib/repositories/templates/email-template.entity";
import { I, type IconName } from "../icons";
import { Avatar, Field } from "../primitives";
import { ClientPicker, type PickedClient } from "./client-picker";
import { Drawer } from "./drawer";
import { useOverlays, type EngageContact } from "./overlay-provider";
import { EmailForm, type EmailTarget } from "./send-email";

/**
 * Engage drawer — the shared human-in-the-loop **email** composer opened from anywhere
 * WITHOUT an open Contact Profile (on the profile the same
 * fields render inline as the Email tab, via the same `EmailForm`). Emails are sent from the
 * agency Gmail mailbox only after staff review the final message and click Send.
 *
 * Calls are deliberately not here — see `./log-call.tsx`. This drawer is now a thin wrapper
 * around `EmailForm` (`./send-email.tsx`), the same shape `LogCallModal` uses around
 * `LogCallForm`: resolve the contact (via the shared `ClientPicker`, not a hand-rolled copy),
 * then hand off to the one shared form.
 */

interface ActionCfg {
  tpl?: string;
  icon: IconName;
  sub?: string;
}

export const ENGAGE_ACTIONS: Record<string, ActionCfg> = {
  "Send Email": { tpl: "New inquiry response", icon: "mail" },
  "Send Payment Instruction": { tpl: "Payment instruction", icon: "peso" },
  "Send Renewal Notice": { tpl: "Renewal reminder", icon: "refresh" },
  "Send Proposal": { tpl: "Proposal / Quote Delivery", icon: "send", sub: "Review the proposal email, then send it from the agency Gmail mailbox." },
  "Request Commission Voucher": { tpl: "Commission Voucher Request", icon: "mail" },
  "Log Commission Follow-Up": { tpl: "Commission Follow-Up", icon: "mail" },
  "Request Proposal Email": { icon: "send", sub: "Review the proposal request, then send it to Pacific Cross." },
};

export function EngageDrawer({
  action,
  contact: initialContact,
  initialDraft,
  onSent,
  onClose,
}: {
  action: string;
  contact?: EngageContact;
  initialDraft?: EmailDraftSeed;
  /** Fires only once Gmail accepted the email and its workflow update completed. */
  onSent?: (view: EmailSendView) => void;
  onClose: () => void;
}) {
  const cfg = ENGAGE_ACTIONS[action] ?? ENGAGE_ACTIONS["Send Email"];
  const overlays = useOverlays();

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
        record: contact.record,
      }
    : null;

  return (
    <Drawer icon={cfg.icon} title={action.replace(/^Log /, "Send ")} sub={cfg.sub} onClose={onClose}>
      <div className="mb-4 flex gap-2.5 rounded-md border border-brand/25 bg-brand-soft p-3.5 text-[12.5px] leading-relaxed text-foreground">
        <I.command size={15} className="mt-0.5 shrink-0 text-brand" />
        <div>Nothing is sent until you review the final email and click Send. Sent means Gmail accepted it; delivery and reading are not confirmed.</div>
      </div>

      {!contact && (
        <Field label="Recipient" required className="mb-4">
          <ClientPicker value={null} onPick={pickContact} onClear={() => setContact(null)} placeholder="Search a lead or client…" />
        </Field>
      )}
      {contact && (
        <div className="mb-4 flex items-center gap-2.5 rounded-md border border-border-soft bg-surface-2 px-3.5 py-2.5">
          <Avatar name={contact.name} size={30} />
          <div className="min-w-0 flex-1 text-[13px] font-[650]">{contact.name}</div>
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
          initialDraft={initialDraft}
          onSent={(view) => {
            overlays.toast("Email sent", `Accepted by Gmail for ${view.recipient}. Delivery and reading are not confirmed.`);
            // Close first: the provider holds one overlay, so a caller opening the next workflow must win.
            if (view.advance) overlays.openAdvanceLead(view.advance);
            else onClose();
            onSent?.(view);
          }}
        />
      )}
    </Drawer>
  );
}
