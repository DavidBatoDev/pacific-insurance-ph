"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { fileClaimAction, listClientPoliciesAction } from "@/app/(app)/claims/actions";
import { I } from "../icons";
import { Btn } from "../primitives";
import { ClientPicker, DRAWER_INPUT, DrawerField, type PickedClient } from "./client-picker";
import { Drawer } from "./drawer";
import { useOverlays } from "./overlay-provider";

/** File Claim drawer (modals.md §6) — creates a claim linked to client + policy. */
export function FileClaimDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();

  const [client, setClient] = useState<PickedClient | null>(null);
  const [policies, setPolicies] = useState<{ id: string; label: string }[]>([]);
  const [policyId, setPolicyId] = useState("");
  const [claimType, setClaimType] = useState("Hospitalization");
  const [incident, setIncident] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setPolicyId("");
    if (!client) {
      setPolicies([]);
      return;
    }
    listClientPoliciesAction(client.id).then(setPolicies).catch(() => setPolicies([]));
  }, [client]);

  const canSave = client && !pending;

  const save = () => {
    if (!client) return;
    startTransition(async () => {
      const res = await fileClaimAction({
        clientId: client.id,
        policyId: policyId || undefined,
        claimType,
        incidentDate: incident || undefined,
        amountClaimed: amount ? Number(amount.replace(/[^0-9]/g, "")) : undefined,
        notes: notes.trim() || undefined,
      });
      if (res.ok) {
        overlays.toast("Claim filed", `${res.data.referenceNo ?? "Claim"} — ${client.name} · status ${res.data.status}.`);
        router.refresh();
        onClose();
      } else {
        overlays.toast("Couldn’t file claim", res.error);
      }
    });
  };

  return (
    <Drawer
      icon="clipboard"
      title="File claim"
      sub="Creates a claim linked to the client and policy, starting at Documents Pending"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!canSave} onClick={save}>
            <I.clipboard size={15} /> {pending ? "Filing…" : "File claim"}
          </Btn>
        </>
      }
    >
      <DrawerField label="Claimant" required>
        <ClientPicker value={client} onPick={setClient} onClear={() => setClient(null)} />
      </DrawerField>

      {client && (
        <DrawerField label="Policy" hint={policies.length ? undefined : "No policies on file for this contact"} className="mt-4">
          <select className={DRAWER_INPUT} value={policyId} onChange={(e) => setPolicyId(e.target.value)} disabled={!policies.length}>
            <option value="">None / not linked</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </DrawerField>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4">
        <DrawerField label="Claim type" required>
          <select className={DRAWER_INPUT} value={claimType} onChange={(e) => setClaimType(e.target.value)}>
            {["Hospitalization", "Outpatient", "Reimbursement", "Emergency", "Other"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </DrawerField>
        <DrawerField label="Incident date">
          <input className={DRAWER_INPUT} type="date" value={incident} onChange={(e) => setIncident(e.target.value)} />
        </DrawerField>
      </div>

      <DrawerField label="Amount claimed (₱)" className="mt-4">
        <input className={DRAWER_INPUT} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9,]/g, ""))} placeholder="0" />
      </DrawerField>

      <DrawerField label="Notes" className="mt-4">
        <textarea
          className="min-h-[80px] w-full rounded-md border border-border-strong bg-card px-3 py-2 text-[13px] outline-none focus:border-brand"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Incident context, hospital, documents expected…"
        />
      </DrawerField>

      <div className="mt-4 flex gap-2.5 rounded-md border border-border-soft bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
        <I.clipboard size={15} className="mt-0.5 shrink-0" />
        <div>
          Creates a CLM- claim at <b>Documents Pending</b> and logs <b>Claim filed</b> to the
          contact&apos;s timeline. Request requirements from the claimant via the composer.
        </div>
      </div>
    </Drawer>
  );
}
