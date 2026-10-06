"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  fileClaimAction,
  listClientPoliciesAction,
  previewClaimChecklistAction,
  type ClaimPolicyOption,
} from "@/app/(app)/claims/actions";
import type { Claim } from "@/lib/repositories/claims";
import {
  CLAIM_TYPES,
  INTERIM_CHECKLIST_TYPES,
  type ClaimRequirement,
  type ClaimType,
} from "@/lib/repositories/claim-requirements/claim-requirement.entity";
import { I } from "../icons";
import { Btn, Field, INPUT } from "../primitives";
import { ClaimRequirementsPanel } from "./claim-requirements-panel";
import { ClientPicker, type PickedClient } from "./client-picker";
import { Drawer } from "./drawer";
import { useOverlays } from "./overlay-provider";

type Preview = Awaited<ReturnType<typeof previewClaimChecklistAction>>;

const policyLabel = (p: ClaimPolicyOption) => p.policyNumber ?? p.referenceNo ?? p.id.slice(0, 8);

/** DH14: a policy is eligible when it is live (Active/Pending) and its category fits the claim type. */
function eligiblePolicies(policies: ClaimPolicyOption[], claimType: string) {
  const travel = claimType === "Travel";
  return policies.filter(
    (p) =>
      (p.status === "Active" || p.status === "Pending") &&
      (travel ? p.productCategory === "Travel Insurance" : p.productCategory !== "Travel Insurance"),
  );
}

/**
 * File Claim drawer (modals.md §6, H7a-c). The claim type decides the requirements checklist;
 * once filed, the drawer switches to the live checklist so documents can be uploaded at once.
 */
export function FileClaimDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();

  const [client, setClient] = useState<PickedClient | null>(null);
  const [policies, setPolicies] = useState<ClaimPolicyOption[]>([]);
  const [chosenPolicyId, setChosenPolicyId] = useState("");
  const [claimType, setClaimType] = useState<string>("IP");
  const [incident, setIncident] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<{ type: string; data: Preview } | null>(null);
  const [filed, setFiled] = useState<{ claim: Claim; requirements: ClaimRequirement[] } | null>(null);

  // Render-phase adjustment: a different client invalidates the picked policy.
  const [prevClient, setPrevClient] = useState(client);
  if (prevClient !== client) {
    setPrevClient(client);
    setChosenPolicyId("");
    setPolicies([]);
  }

  useEffect(() => {
    if (!client) return;
    listClientPoliciesAction(client.id).then(setPolicies).catch(() => setPolicies([]));
  }, [client]);

  useEffect(() => {
    let active = true;
    previewClaimChecklistAction(claimType)
      .then((data) => active && setPreview({ type: claimType, data }))
      .catch(() => active && setPreview(null));
    return () => {
      active = false;
    };
  }, [claimType]);

  const eligible = useMemo(() => eligiblePolicies(policies, claimType), [policies, claimType]);
  // Exactly one fit -> locked to it (DH14); several -> the staff pick (if still eligible); none -> unlinked.
  const policyId =
    eligible.length === 1 ? eligible[0].id : eligible.some((p) => p.id === chosenPolicyId) ? chosenPolicyId : "";

  const isInterim = INTERIM_CHECKLIST_TYPES.includes(claimType as ClaimType);
  const currentPreview = preview?.type === claimType ? preview.data : null;
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
        const { claim, requirements, warning } = res.data;
        overlays.toast("Claim filed", `${claim.referenceNo ?? "Claim"} — ${client.name} · status ${claim.status}.`);
        if (warning) overlays.toast("Checklist not generated", warning);
        setFiled({ claim, requirements });
        router.refresh();
      } else {
        overlays.toast("Couldn’t file claim", res.error);
      }
    });
  };

  if (filed) {
    return (
      <Drawer
        icon="clipboard"
        title="File claim"
        onClose={onClose}
        footer={
          <Btn variant="primary" onClick={onClose}>
            Done
          </Btn>
        }
      >
        <div className="mb-4">
          <div className="text-[15px] font-bold">Claim filed — {filed.claim.referenceNo ?? "new claim"}</div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {client?.name} · {filed.claim.claimType ?? "claim"}
            {filed.claim.claimType === "Travel" && " · work from the TravelSafe NOC form"}
          </p>
        </div>
        <ClaimRequirementsPanel
          claimId={filed.claim.id}
          clientId={filed.claim.clientId}
          claimType={filed.claim.claimType}
          requirements={filed.requirements}
          onChange={(requirements, nextType) =>
            setFiled((current) =>
              current && {
                claim: nextType ? { ...current.claim, claimType: nextType } : current.claim,
                requirements,
              },
            )
          }
        />
      </Drawer>
    );
  }

  return (
    <Drawer
      icon="clipboard"
      title="File claim"
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
      <Field label="Claimant" required>
        <ClientPicker value={client} onPick={setClient} onClear={() => setClient(null)} />
      </Field>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field
          label="Claim type"
          required
          hint={isInterim ? "(interim checklist — pending Eman)" : undefined}
        >
          <select className={INPUT} value={claimType} onChange={(e) => setClaimType(e.target.value)}>
            {CLAIM_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Incident date">
          <input className={INPUT} type="date" value={incident} onChange={(e) => setIncident(e.target.value)} />
        </Field>
      </div>

      {client && (
        <Field label="Policy" className="mt-4">
          {eligible.length === 1 ? (
            <div className="flex h-9 items-center rounded-md border border-border-soft bg-surface-2 px-3 text-[13px]">
              {policyLabel(eligible[0])}
              {eligible[0].productName ? ` · ${eligible[0].productName}` : ""}
            </div>
          ) : eligible.length > 1 ? (
            <select className={INPUT} value={policyId} onChange={(e) => setChosenPolicyId(e.target.value)}>
              <option value="">None / not linked</option>
              {eligible.map((p) => (
                <option key={p.id} value={p.id}>
                  {[policyLabel(p), p.productName].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">No matching policy — the claim will be filed unlinked</p>
          )}
        </Field>
      )}

      <div className="mt-4 rounded-md border border-border-soft bg-surface-2 px-3 py-2.5">
        <div className="text-[12px] font-semibold">
          {claimType === "Travel"
            ? "Requirements checklist"
            : currentPreview
              ? `Requirements checklist — ${currentPreview.checklistType ?? ""} (${currentPreview.items.length} item${currentPreview.items.length === 1 ? "" : "s"})`
              : "Requirements checklist"}
        </div>
        {claimType === "Travel" ? (
          <p className="mt-1 text-[12px] text-muted-foreground">
            Travel claims have no generated checklist — work from the TravelSafe NOC form.
          </p>
        ) : !currentPreview ? (
          <p className="mt-1 text-[12px] text-muted-foreground">Loading…</p>
        ) : currentPreview.items.length === 0 ? (
          <p className="mt-1 text-[12px] text-muted-foreground">No checklist template is configured for this type.</p>
        ) : (
          <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto pr-1 text-[12px]">
            {currentPreview.items.map((item) => (
              <li key={item.documentName} className="flex gap-1.5">
                <span className="text-muted-foreground">•</span>
                <span>
                  {item.documentName}
                  {!item.isRequired && <span className="ml-1 text-muted-foreground">Optional</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Field label="Amount claimed (₱)" className="mt-4">
        <input className={INPUT} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9,]/g, ""))} placeholder="0" />
      </Field>

      <Field label="Notes" className="mt-4">
        <textarea
          className="min-h-[80px] w-full rounded-md border border-border-strong bg-card px-3 py-2 text-[13px] outline-none focus:border-brand"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Incident context, hospital, documents expected…"
        />
      </Field>
    </Drawer>
  );
}
