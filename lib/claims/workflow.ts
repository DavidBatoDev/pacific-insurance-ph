/**
 * The claim workflow: Claim details → Requirements → Email Pacific Cross. Like the application
 * workflow, progress is derived from the records, so the modal opens where the work is.
 */

export const CLAIM_WORKFLOW_STEPS = [
  { n: 1, label: "Claim details" },
  { n: 2, label: "Requirements" },
  { n: 3, label: "Email Pacific Cross" },
] as const;

export type ClaimStepNumber = 1 | 2 | 3;

export interface ClaimWorkflowFacts {
  /** The claim has been filed (a record exists). */
  claimExists: boolean;
  /** Checklist rows on the claim; zero means the checklist was never generated. */
  requirementCount: number;
  /** The claim type has a checklist template (Travel and unknown legacy types have none). */
  checklistAvailable: boolean;
  /** Required checklist items still Pending or Incomplete. */
  outstanding: number;
  /** At least one submission email has been logged to Pacific Cross. */
  submitted: boolean;
}

export interface ClaimWorkflowProgress {
  done: Record<ClaimStepNumber, boolean>;
  /** The step to open on; 4 once the claim has gone to Pacific Cross. */
  current: ClaimStepNumber | 4;
}

export function claimWorkflowProgress(facts: ClaimWorkflowFacts): ClaimWorkflowProgress {
  // A checklist that was never generated is not "all documents in": the step still has work
  // (Generate checklist). Types without a template have nothing to generate, so they pass.
  const checklistReady = facts.requirementCount > 0 || !facts.checklistAvailable;
  const done: Record<ClaimStepNumber, boolean> = {
    1: facts.claimExists,
    2: facts.claimExists && checklistReady && facts.outstanding === 0,
    3: facts.claimExists && facts.submitted,
  };
  // Later steps win, as in the application workflow.
  const furthest = ([3, 2, 1] as const).find((n) => done[n]) ?? 0;
  return { done, current: Math.min(furthest + 1, 4) as ClaimStepNumber | 4 };
}

export const isClaimStepUnlocked = (progress: ClaimWorkflowProgress, n: ClaimStepNumber) => n <= progress.current;
