"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { listProposalContactsAction, requestProposalAction } from "@/app/(app)/clients/engage-actions";
import type { ExternalContact } from "@/lib/repositories/external-contacts/external-contact.entity";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { addBusinessDays, HMO_PROPOSAL_TURNAROUND_BUSINESS_DAYS } from "../lead-config";
import { Btn, Field, INPUT } from "../primitives";
import { ClientPicker, type PickedClient } from "./client-picker";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";

/**
 * Request Proposal — its own modal (modals.md §14), never the Email composer.
 * Sets proposal_status=Requested, logs a note + follow-up task. Saving never
 * sends email: with "Also email Pacific Cross" it then opens a populated email
 * to the chosen contact for review and an explicit Send. Opened with a client
 * from the contact profile, or with a picker from the Leads quick-actions bar.
 */
export function RequestProposalModal({
  clientId,
  clientName,
  onClose,
  onDone,
}: {
  clientId?: string;
  clientName?: string;
  onClose: () => void;
  onDone?: (proposalStatus: string) => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<PickedClient | null>(
    clientId && clientName ? { id: clientId, name: clientName } : null,
  );
  const [note, setNote] = useState("");
  const [follow, setFollow] = useState(() => addBusinessDays(HMO_PROPOSAL_TURNAROUND_BUSINESS_DAYS));
  const [alsoEmail, setAlsoEmail] = useState(false);
  const [carrierContactId, setCarrierContactId] = useState("");
  const [contacts, setContacts] = useState<ExternalContact[]>([]);
  useEffect(() => { listProposalContactsAction().then(setContacts).catch(() => setContacts([])); }, []);

  const confirm = () => {
    if (!picked) return;
    startTransition(async () => {
      const res = await requestProposalAction({
        clientId: picked.id,
        note,
        followUpDate: follow || null,
        emailContactId: alsoEmail ? carrierContactId || null : null,
      });
      if (res.ok) {
        overlays.toast("Proposal requested", `Note + follow-up task added for ${picked.name}.`);
        onDone?.("Requested");
        router.refresh();
        onClose();
        const draft = res.data.emailDraft;
        if (draft) {
          // A separate, reviewed send: an email failure never re-runs the request above.
          overlays.openEngage(
            "Request Proposal Email",
            { clientId: picked.id, name: picked.name, email: draft.recipient, externalContactId: draft.externalContactId ?? null },
            undefined,
            draft,
          );
        }
      } else {
        overlays.toast("Couldn’t request proposal", res.error);
      }
    });
  };

  return (
    <Modal onClose={onClose} maxWidth={460}>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[10px] bg-brand-soft text-brand-hover">
          <I.fileText size={20} />
        </div>
        <h3 className="text-[16px] font-bold tracking-[-0.01em]">Request proposal</h3>
      </div>

      {!(clientId && clientName) && (
        <Field label="Lead / client" required className="mb-3.5">
          <ClientPicker
            value={picked}
            onPick={setPicked}
            onClear={() => setPicked(null)}
            placeholder="Search the lead this proposal is for…"
          />
        </Field>
      )}

      <Field label="Proposal request note" required>
        <textarea
          className="min-h-[110px] w-full rounded-md border border-border-strong bg-card px-3 py-2 text-[13px] outline-none focus:border-brand"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What to request from the carrier (product, coverage, budget)…"
        />
      </Field>
      <Field label="Follow-up date" className="mt-3.5">
        <input className={INPUT} type="date" value={follow} onChange={(e) => setFollow(e.target.value)} />
      </Field>

      <button
        onClick={() => setAlsoEmail(!alsoEmail)}
        className={cn(
          "mt-4 flex w-full items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-left text-[13px] font-[550] transition-colors",
          alsoEmail ? "border-brand bg-brand-soft" : "border-border-strong text-muted-foreground hover:bg-hover",
        )}
      >
        <span className={cn("grid size-[18px] place-items-center rounded-md border-[1.6px]", alsoEmail ? "border-brand bg-brand text-white" : "border-border-strong text-transparent")}>
          {alsoEmail && <I.check size={13} />}
        </span>
        Also email Pacific Cross (review and send next)
      </button>
      {alsoEmail && (
        <Field label="Pacific Cross contact" className="mt-3">
          <select className={INPUT} value={carrierContactId} onChange={(e) => setCarrierContactId(e.target.value)}>
            <option value="">Choose a New Business contact…</option>
            {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} · {contact.role ?? contact.department} · {contact.email}</option>)}
          </select>
          <p className="mt-1.5 text-[11.5px] text-subtle">
            {contacts.length
              ? "Requests are sent only to active New Business contacts. Your request note becomes the email body; you review it before sending."
              : "No active New Business contact with an email address. Add one under Contacts to email Pacific Cross."}
          </p>
        </Field>
      )}

      <div className="mt-5 flex items-center justify-end gap-2.5">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={pending || !note.trim() || !picked || (alsoEmail && !carrierContactId)} onClick={confirm}>
          {pending ? "Requesting…" : "Request proposal"}
        </Btn>
      </div>
    </Modal>
  );
}
