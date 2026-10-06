"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  generateClaimRequirementsAction,
  getClaimRequirementsAction,
  type ClaimRequirementsPayload,
} from "@/app/(app)/claims/actions";
import { checklistForClaimType } from "@/lib/repositories/claim-requirements/claim-requirement.entity";
import { I } from "../icons";
import { Btn, StatusBadge } from "../primitives";
import { ClaimRequirementsPanel } from "./claim-requirements-panel";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";

/**
 * Claim requirements overlay (TO-BE-UPDATE-PLAN.md G8, H7c). The checklist body lives in
 * ClaimRequirementsPanel (shared with the File Claim drawer). New claims get their checklist
 * at filing time; this modal's "Generate checklist" is only a fallback for older claims.
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
  const checklistType = checklistForClaimType(payload?.claim.claimType ?? null);

  const generate = () =>
    startTransition(async () => {
      const result = await generateClaimRequirementsAction(claimId);
      if (!result.ok) return overlays.toast("Couldn’t generate checklist", result.error);
      setPayload((current) => current && { ...current, requirements: result.data });
      router.refresh();
      overlays.toast("Checklist generated", `${result.data.length} requirement${result.data.length === 1 ? "" : "s"} added from the ${checklistType} NOC checklist.`);
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

          {requirements.length === 0 && (
            <div className="mt-5 rounded-md border border-dashed border-border-strong px-4 py-8 text-center">
              <p className="text-[13px] font-semibold">No checklist generated yet</p>
              {checklistType ? (
                <>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">This {payload.claim.claimType} claim uses the {checklistType} NOC checklist.</p>
                  <div className="mt-4 flex justify-center">
                    <Btn variant="primary" disabled={pending} onClick={generate}><I.clipboard size={14} /> Generate checklist</Btn>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {payload.claim.claimType === "Travel"
                    ? "Travel claims: nothing to generate — work from the TravelSafe NOC form directly."
                    : "This claim’s type has no checklist template. Pick a claim type below."}
                </p>
              )}
            </div>
          )}

          <div className="mt-4">
            <ClaimRequirementsPanel
              claimId={claimId}
              clientId={payload.claim.clientId}
              claimType={payload.claim.claimType}
              requirements={requirements}
              onChange={(next, nextType) =>
                setPayload((current) => current && { ...current, requirements: next, claim: nextType ? { ...current.claim, claimType: nextType } : current.claim })
              }
            />
          </div>
        </div>
      )}
      {!loading && (
        <div className="mt-5 flex items-center justify-end border-t border-border-soft pt-4"><Btn onClick={onClose}>Close</Btn></div>
      )}
    </Modal>
  );
}
