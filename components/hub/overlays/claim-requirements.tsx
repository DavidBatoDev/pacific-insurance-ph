"use client";

import { ClaimWorkflowModal } from "./claim-workflow";

/**
 * Claim requirements overlay (TO-BE-UPDATE-PLAN.md G8, H7c), opened from the claims list. It is
 * the claim workflow for an existing claim, opening on the step its records have reached.
 */
export function ClaimRequirementsModal({ claimId, onClose }: { claimId: string; onClose: () => void }) {
  return <ClaimWorkflowModal claimId={claimId} onClose={onClose} />;
}
