"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  changeClaimTypeAction,
  updateClaimRequirementRequiredAction,
  updateClaimRequirementStatusAction,
  getClaimRequirementsAction,
} from "@/app/(app)/claims/actions";
import {
  CLAIM_TYPES,
  CLAIM_REQUIREMENT_STATUSES,
  INTERIM_CHECKLIST_TYPES,
  type ClaimRequirement,
  type ClaimRequirementStatus,
} from "@/lib/repositories/claim-requirements/claim-requirement.entity";
import { cn } from "@/lib/utils";
import { RequirementStatusDot, requirementRowTone } from "@/components/hub/requirement-status";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { Btn, INPUT } from "../primitives";
import { useOverlays } from "./overlay-provider";

/**
 * The live claim checklist (progress, per-item status / required toggle / upload, and the
 * "Change claim type" control), shared by the claim requirements modal and the File Claim
 * drawer (H7c). The parent owns the requirements state; `onChange` reports edits, and a
 * claim-type change also reports the new type.
 */
export function ClaimRequirementsPanel({
  claimId,
  clientId,
  claimType,
  requirements,
  onChange,
}: {
  claimId: string;
  clientId: string;
  claimType: string | null;
  requirements: ClaimRequirement[];
  onChange: (
    requirements: ClaimRequirement[] | ((prev: ClaimRequirement[]) => ClaimRequirement[]),
    claimType?: string,
  ) => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [nextType, setNextType] = useState<string>(
    (CLAIM_TYPES as readonly string[]).includes(claimType ?? "") ? (claimType as string) : CLAIM_TYPES[0],
  );

  const required = requirements.filter((item) => item.isRequired);
  const complete = required.filter((item) => item.status === "Verified").length;
  const outstanding = required.filter((item) => item.status === "Pending" || item.status === "Incomplete");
  const progress = required.length ? Math.round((complete / required.length) * 100) : 0;
  // A mis-chosen claim type can be undone only before any document work has started.
  const canChangeType = requirements.every((item) => item.status === "Pending");
  // An upload marks its row Received on the server; reload so the row (and the type lock) reflect it.
  const reloadAfterUpload = () => {
    void getClaimRequirementsAction(claimId).then((result) => {
      if (result.ok) onChange(result.data.requirements);
    });
  };
  const replace = (updated: ClaimRequirement) =>
    onChange((prev) => prev.map((requirement) => (requirement.id === updated.id ? updated : requirement)));

  // Optimistic: show the new status at once, save in the background, and restore the previous
  // status only if the save fails and no newer pick for that row has superseded it. All updates
  // are functional and touch only their own row, so a revert can't clobber another row.
  const latestStatusPick = useRef<Record<string, number>>({});
  const update = async (item: ClaimRequirement, status: ClaimRequirementStatus) => {
    const pick = (latestStatusPick.current[item.id] ?? 0) + 1;
    latestStatusPick.current[item.id] = pick;
    replace({ ...item, status });
    const result = await updateClaimRequirementStatusAction(claimId, item.id, status);
    if (!result.ok) {
      if (latestStatusPick.current[item.id] === pick) replace(item);
      return overlays.toast("Couldn’t update requirement", result.error);
    }
    router.refresh();
  };

  const toggleRequired = (item: ClaimRequirement) =>
    startTransition(async () => {
      const result = await updateClaimRequirementRequiredAction(claimId, item.id, !item.isRequired);
      if (!result.ok) return overlays.toast("Couldn’t update requirement", result.error);
      replace(result.data);
      router.refresh();
    });

  const changeType = () =>
    startTransition(async () => {
      const result = await changeClaimTypeAction(claimId, nextType);
      if (!result.ok) return overlays.toast("Couldn’t change the claim type", result.error);
      onChange(result.data.requirements, result.data.claim.claimType ?? nextType);
      router.refresh();
      overlays.toast(
        "Claim type changed",
        result.data.warning ?? `Now ${nextType} — ${result.data.requirements.length} checklist item${result.data.requirements.length === 1 ? "" : "s"}.`,
      );
    });

  return (
    <div>
      {requirements.length > 0 && (
        <>
          <div className="rounded-md border border-border-soft bg-surface-2 px-4 py-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold">Verified package</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">{complete} of {required.length} required documents verified</div>
              </div>
              <div className="text-[17px] font-bold tabular-nums text-brand-hover">{progress}%</div>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border-soft"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress}%` }} /></div>
          </div>

          <div className="mt-4 max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {requirements.map((item) => (
              <div key={item.id} className={cn("rounded-md border px-3 py-2.5", requirementRowTone(item.status))}>
                <div className="flex items-center gap-3">
                  <RequirementStatusDot status={item.status} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">{item.documentName}{!item.isRequired && <span className="ml-1.5 font-normal text-muted-foreground">Optional</span>}</div>
                    {(item.appliesTo || item.notes) && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{item.appliesTo ?? item.notes}</div>}
                    <label className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><input type="checkbox" checked={item.isRequired} disabled={pending} onChange={() => toggleRequired(item)} /> Count as required</label>
                  </div>
                  <select aria-label={`Status for ${item.documentName}`} value={item.status} onChange={(event) => void update(item, event.target.value as ClaimRequirementStatus)} className="h-8 rounded-md border border-border-strong bg-card px-2 text-[12px] font-semibold outline-none focus:border-brand disabled:opacity-60">
                    {CLAIM_REQUIREMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </div>
                <div className="mt-2 pl-10"><DocumentUploadForm clientId={clientId} claimId={claimId} requirementId={item.id} onUploaded={reloadAfterUpload} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className={cn("flex flex-wrap items-center justify-between gap-3", requirements.length > 0 && "mt-5 border-t border-border-soft pt-4")}>
        <div className="text-[11.5px] text-muted-foreground">
          {!canChangeType
            ? "Claim type locked — documents already received"
            : requirements.length === 0
              ? "No checklist for this claim"
              : outstanding.length
                ? `${outstanding.length} required item${outstanding.length === 1 ? "" : "s"} still need attention`
                : "No required documents are outstanding"}
        </div>
        {canChangeType && (
          <div className="flex items-center gap-2">
            <select
              aria-label="New claim type"
              className={cn(INPUT, "h-8 w-auto py-0 text-[12px]")}
              value={nextType}
              disabled={pending}
              onChange={(e) => setNextType(e.target.value)}
            >
              {CLAIM_TYPES.map((t) => (
                <option key={t} value={t}>{t}{INTERIM_CHECKLIST_TYPES.includes(t) ? " (interim checklist)" : ""}</option>
              ))}
            </select>
            <Btn variant="ghost" disabled={pending || nextType === claimType} onClick={changeType}>Change claim type</Btn>
          </div>
        )}
      </div>
    </div>
  );
}
