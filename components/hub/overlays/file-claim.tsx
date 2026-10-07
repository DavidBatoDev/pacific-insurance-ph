"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  fileClaimAction,
  listClientPoliciesAction,
  previewClaimChecklistAction,
  type ClaimPolicyOption,
} from "@/app/(app)/claims/actions";
import { CLAIM_SUBMISSION_MODES } from "@/lib/db-enums";
import type { Claim } from "@/lib/repositories/claims";
import {
  CLAIM_TYPES,
  INTERIM_CHECKLIST_TYPES,
  type ClaimRequirement,
  type ClaimType,
} from "@/lib/repositories/claim-requirements/claim-requirement.entity";
import { Field, INPUT } from "../primitives";
import { ClaimWorkflowModal } from "./claim-workflow";
import { ClientPicker, type PickedClient } from "./client-picker";
import { useOverlays } from "./overlay-provider";
import { Section } from "./wizard/steps-1";
import type { SectionState } from "./wizard/wizard-data";

type Preview = Awaited<ReturnType<typeof previewClaimChecklistAction>>;

/** Today as YYYY-MM-DD in the local timezone. */
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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
 * File Claim form (modals.md §6, H7a-c), step 1 of the claim workflow. Grouped like the New
 * Application wizard; the claim type decides the requirements checklist, previewed before filing.
 */
export function useFileClaimForm(onFiled: (filed: { claim: Claim; requirements: ClaimRequirement[] }) => void) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();

  const [client, setClient] = useState<PickedClient | null>(null);
  const [policies, setPolicies] = useState<ClaimPolicyOption[]>([]);
  const [chosenPolicyId, setChosenPolicyId] = useState("");
  const [claimType, setClaimType] = useState<string>("IP");
  const [incident, setIncident] = useState("");
  const [submissionMode, setSubmissionMode] = useState("");
  const [receivedDate, setReceivedDate] = useState(todayLocal);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<{ type: string; data: Preview } | null>(null);

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
  const canSave = !!client && !pending;
  const missing = client ? [] : ["claimant"];
  const submitLabel = pending ? "Filing…" : "File claim";

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
        submissionMode: submissionMode || undefined,
        documentsReceivedDate: receivedDate || undefined,
      });
      if (res.ok) {
        const { claim, requirements, warning } = res.data;
        overlays.toast("Claim filed", `${claim.referenceNo ?? "Claim"} — ${client.name} · status ${claim.status}.`);
        if (warning) overlays.toast("Checklist not generated", warning);
        router.refresh();
        onFiled({ claim, requirements });
      } else {
        overlays.toast("Couldn’t file claim", res.error);
      }
    });
  };

  const claimantState: SectionState = client
    ? { status: "done", label: policyId ? "Policy linked" : "Unlinked policy" }
    : { status: "todo", label: "1 needed" };
  const claimState: SectionState = incident && amount
    ? { status: "done", label: "Complete" }
    : { status: "todo", label: `${[incident, amount].filter(Boolean).length + 1} of 3 filled` };
  const intakeState: SectionState = submissionMode && receivedDate
    ? { status: "done", label: "Complete" }
    : { status: "todo", label: submissionMode ? "Date missing" : "How it arrived?" };

  const fields = (
    <>
      <Section title="Claimant & policy" state={claimantState}>
        <Field label="Claimant" required>
          <ClientPicker value={client} onPick={setClient} onClear={() => setClient(null)} />
        </Field>
        <Field label="Policy" className="mt-4">
          {!client ? (
            <p className="text-[12.5px] text-muted-foreground">Pick the claimant to see their policies.</p>
          ) : eligible.length === 1 ? (
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
      </Section>

      <Section title="Claim" state={claimState}>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Claim type" required hint={isInterim ? "Interim checklist — pending Eman" : undefined}>
            <select aria-label="Claim type" className={INPUT} value={claimType} onChange={(e) => setClaimType(e.target.value)}>
              {CLAIM_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Incident date">
            <input aria-label="Incident date" className={INPUT} type="date" value={incident} onChange={(e) => setIncident(e.target.value)} />
          </Field>
          <Field label="Amount claimed (₱)">
            <input aria-label="Amount claimed" className={INPUT} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9,]/g, ""))} placeholder="0" />
          </Field>
        </div>
      </Section>

      <Section title="Intake" state={intakeState}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="How it arrived">
            <select aria-label="How it arrived" className={INPUT} value={submissionMode} onChange={(e) => setSubmissionMode(e.target.value)}>
              <option value="">—</option>
              {CLAIM_SUBMISSION_MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Documents received">
            <input aria-label="Documents received" className={INPUT} type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section
        title="Requirements checklist"
        state={
          claimType === "Travel" || !currentPreview
            ? undefined
            : { status: "done", label: `${currentPreview.checklistType ?? ""} · ${currentPreview.items.length} item${currentPreview.items.length === 1 ? "" : "s"}` }
        }
      >
        {claimType === "Travel" ? (
          <p className="text-[12px] text-muted-foreground">Travel claims have no generated checklist — work from the TravelSafe NOC form.</p>
        ) : !currentPreview ? (
          <p className="text-[12px] text-muted-foreground">Loading…</p>
        ) : currentPreview.items.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No checklist template is configured for this type.</p>
        ) : (
          <>
            <p className="mb-2 text-[12px] text-muted-foreground">Created with the claim — you collect these on the next step.</p>
            <ul className="max-h-40 space-y-0.5 overflow-y-auto pr-1 text-[12px]">
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
          </>
        )}
      </Section>

      <Section title="Notes">
        <textarea
          aria-label="Claim notes"
          className="min-h-[80px] w-full rounded-md border border-border-strong bg-card px-3 py-2 text-[13px] outline-none focus:border-brand"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Incident context, hospital, documents expected…"
        />
      </Section>
    </>
  );

  return { fields, missing, canSave, pending, save, submitLabel };
}

/** "File claim" from the Claims page: the claim workflow, starting on a new claim. */
export function FileClaimDrawer({ onClose }: { onClose: () => void }) {
  return <ClaimWorkflowModal onClose={onClose} />;
}
