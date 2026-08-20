"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  generateClaimRequirementsAction,
  getClaimRequirementsAction,
  updateClaimRequirementRequiredAction,
  updateClaimRequirementStatusAction,
  type ClaimRequirementsPayload,
} from "@/app/(app)/claims/actions";
import {
  CLAIM_CHECKLIST_TYPES,
  CLAIM_REQUIREMENT_STATUSES,
  type ClaimChecklistType,
  type ClaimRequirement,
  type ClaimRequirementStatus,
} from "@/lib/repositories/claim-requirements/claim-requirement.entity";
import { cn } from "@/lib/utils";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { I } from "../icons";
import { Btn, StatusBadge } from "../primitives";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";

const statusTone: Record<ClaimRequirementStatus, string> = {
  Pending: "border-border-soft bg-card",
  Received: "border-blue-border bg-blue-soft/50",
  Incomplete: "border-red-border bg-red-soft/50",
  Verified: "border-green-border bg-green-soft/50",
};

/**
 * Claim requirements overlay (TO-BE-UPDATE-PLAN.md Phase G, item G8).
 *
 * A deliberate clone of ApplicationRequirementsModal, not a generalisation of it.
 * Applications snapshot their checklist at creation time via the wizard, so that
 * modal only ever *displays* an already-populated list. Claims have no wizard --
 * there is no moment to snapshot at -- so this modal also owns an explicit
 * "generate checklist" step with a type choice (In-Patient / Out-Patient) that the
 * application modal has no equivalent of. Folding that into one shared component
 * would mean a payload type wide enough for both domains and a permanent branch
 * for the generate-vs-display lifecycles, for a payoff of a handful of shared
 * lines (a status-tone map, a progress bar). Two small focused files stay cheaper
 * to read than one component carrying two lifecycles.
 */
export function ClaimRequirementsModal({ claimId, onClose }: { claimId: string; onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [payload, setPayload] = useState<ClaimRequirementsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getClaimRequirementsAction(claimId).then((result) => {
      if (!active) return;
      if (result.ok) setPayload(result.data);
      else setError(result.error);
      setLoading(false);
    });
    return () => { active = false; };
  }, [claimId]);

  const requirements = payload?.requirements ?? [];
  const required = requirements.filter((item) => item.isRequired);
  const complete = required.filter((item) => item.status === "Verified").length;
  const outstanding = required.filter((item) => item.status === "Pending" || item.status === "Incomplete");
  const progress = required.length ? Math.round((complete / required.length) * 100) : 0;

  const generate = (checklistType: ClaimChecklistType) =>
    startTransition(async () => {
      const result = await generateClaimRequirementsAction(claimId, checklistType);
      if (!result.ok) return overlays.toast("Couldn’t generate checklist", result.error);
      setPayload((current) => current && { ...current, requirements: result.data });
      router.refresh();
      overlays.toast("Checklist generated", `${result.data.length} requirement${result.data.length === 1 ? "" : "s"} added from the ${checklistType} NOC checklist.`);
    });

  const update = (item: ClaimRequirement, status: ClaimRequirementStatus) =>
    startTransition(async () => {
      const result = await updateClaimRequirementStatusAction(claimId, item.id, status);
      if (!result.ok) return overlays.toast("Couldn’t update requirement", result.error);
      setPayload((current) => current && {
        ...current,
        requirements: current.requirements.map((requirement) => requirement.id === item.id ? result.data : requirement),
      });
      router.refresh();
      overlays.toast("Requirement updated", `${item.documentName} is now ${status}.`);
    });

  const toggleRequired = (item: ClaimRequirement) =>
    startTransition(async () => {
      const result = await updateClaimRequirementRequiredAction(claimId, item.id, !item.isRequired);
      if (!result.ok) return overlays.toast("Couldn’t update requirement", result.error);
      setPayload((current) => current && {
        ...current,
        requirements: current.requirements.map((requirement) => requirement.id === item.id ? result.data : requirement),
      });
      router.refresh();
    });

  return (
    <Modal onClose={onClose} maxWidth={660}>
      {loading ? (
        <div className="grid min-h-52 place-items-center text-[13px] text-muted-foreground">Loading requirements…</div>
      ) : error || !payload ? (
        <div className="py-8 text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-full bg-red-soft text-red"><I.alertTri size={20} /></div>
          <h3 className="mt-3 text-[16px] font-bold">Requirements unavailable</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">{error ?? "The claim could not be loaded."}</p>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-brand-hover"><I.clipboard size={17} /><span className="text-[11px] font-bold uppercase tracking-[.09em]">Claim requirements</span></div>
              <h3 className="mt-1 text-[17px] font-bold tracking-[-.015em]">{payload.claim.clientName ?? "Claimant"}</h3>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{payload.claim.referenceNo ?? "Claim"} · {payload.claim.claimType ?? "Unspecified type"}</p>
            </div>
            <StatusBadge status={payload.claim.status} />
          </div>

          {requirements.length === 0 ? (
            <div className="mt-5 rounded-md border border-dashed border-border-strong px-4 py-8 text-center">
              <p className="text-[13px] font-semibold">No checklist generated yet</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Generate the medical Notification of Claim&apos;s page-4 checklist for this claim. Travel
                claims carry their requirements inside the TravelSafe NOC form itself, so there is
                nothing to generate for those — work from the form directly.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                {CLAIM_CHECKLIST_TYPES.map((type) => (
                  <Btn key={type} variant="primary" disabled={pending} onClick={() => generate(type)}>
                    <I.clipboard size={14} /> Generate {type} checklist
                  </Btn>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="mt-5 rounded-md border border-border-soft bg-surface-2 px-4 py-3">
                <div className="flex items-end justify-between gap-3"><div><div className="text-[12px] font-semibold">Verified package</div><div className="mt-0.5 text-[11.5px] text-muted-foreground">{complete} of {required.length} required documents verified</div></div><div className="text-[17px] font-bold tabular-nums text-brand-hover">{progress}%</div></div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border-soft"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress}%` }} /></div>
              </div>

              <div className="mt-4 max-h-[340px] space-y-2 overflow-y-auto pr-1">
                {requirements.map((item) => (
                  <div key={item.id} className={cn("rounded-md border px-3 py-2.5", statusTone[item.status])}><div className="flex items-center gap-3">
                    <div className={cn("grid size-7 shrink-0 place-items-center rounded-full", item.status === "Verified" ? "bg-green text-white" : "bg-card text-muted-foreground")}><I.check size={14} /></div>
                    <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">{item.documentName}{!item.isRequired && <span className="ml-1.5 font-normal text-muted-foreground">Optional</span>}</div>{(item.appliesTo || item.notes) && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{item.appliesTo ?? item.notes}</div>}<label className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><input type="checkbox" checked={item.isRequired} disabled={pending} onChange={() => toggleRequired(item)} /> Count as required</label></div>
                    <select aria-label={`Status for ${item.documentName}`} disabled={pending} value={item.status} onChange={(event) => update(item, event.target.value as ClaimRequirementStatus)} className="h-8 rounded-md border border-border-strong bg-card px-2 text-[12px] font-semibold outline-none focus:border-brand disabled:opacity-60">
                      {CLAIM_REQUIREMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </div><div className="mt-2 pl-10"><DocumentUploadForm clientId={payload.claim.clientId} claimId={claimId} requirementId={item.id} /></div></div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {!loading && payload && requirements.length > 0 && <div className="mt-5 flex items-center justify-between border-t border-border-soft pt-4"><div className="text-[11.5px] text-muted-foreground">{outstanding.length ? `${outstanding.length} required item${outstanding.length === 1 ? "" : "s"} still need attention` : "No required documents are outstanding"}</div><Btn onClick={onClose}>Close</Btn></div>}
      {!loading && payload && requirements.length === 0 && <div className="mt-5 flex items-center justify-end border-t border-border-soft pt-4"><Btn onClick={onClose}>Close</Btn></div>}
    </Modal>
  );
}
