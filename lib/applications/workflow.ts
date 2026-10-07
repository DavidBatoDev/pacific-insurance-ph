/**
 * The application workflow after the wizard: Requirements → Email Pacific Cross → Pacific Cross
 * reply → Payment → Log policy copy. Progress is derived from the records themselves (no stored
 * step), so the modal always opens where the work actually is.
 */

export const APPLICATION_WORKFLOW_STEPS = [
  { n: 1, label: "Requirements" },
  { n: 2, label: "Email Pacific Cross" },
  { n: 3, label: "Pacific Cross reply" },
  { n: 4, label: "Payment" },
  { n: 5, label: "Log policy copy" },
] as const;

export type WorkflowStepNumber = 1 | 2 | 3 | 4 | 5;

export interface WorkflowFacts {
  /** Required checklist items still Pending or Incomplete. */
  outstanding: number;
  /** At least one submission email has been logged to Pacific Cross. */
  submitted: boolean;
  /** Pacific Cross's illustrative proposal (the final billing) is on file. */
  proposalOnFile: boolean;
  /** Status of the application's latest payment, if any (a payment means the billing is known). */
  paymentStatus: string | null;
  /** A policy has been logged from this application. */
  policyLinked: boolean;
}

export interface WorkflowProgress {
  done: Record<WorkflowStepNumber, boolean>;
  /** The step to open on: the one after the furthest completed step; 6 once everything is done. */
  current: WorkflowStepNumber | 6;
}

export function workflowProgress(facts: WorkflowFacts): WorkflowProgress {
  const done: Record<WorkflowStepNumber, boolean> = {
    1: facts.outstanding === 0,
    2: facts.submitted,
    // Pacific Cross has answered with the billing, and nothing it asked for is still with the client.
    // A billed amount already recorded (payment created) counts as the billing being in hand.
    3: facts.submitted && (facts.proposalOnFile || facts.paymentStatus !== null) && facts.outstanding === 0,
    4: facts.paymentStatus === "Verified",
    5: facts.policyLinked,
  };
  // Later steps win: an item Pacific Cross asks for after submission keeps the workflow on its
  // reply step (waiting on the client) instead of dragging it back to the checklist.
  const furthest = ([5, 4, 3, 2, 1] as const).find((n) => done[n]) ?? 0;
  return { done, current: Math.min(furthest + 1, 6) as WorkflowStepNumber | 6 };
}

/** A step can be opened once every step before it has been reached. */
export const isStepUnlocked = (progress: WorkflowProgress, n: WorkflowStepNumber) => n <= progress.current;
