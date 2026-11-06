/** Derived from persisted facts; later carrier/payment/policy progress survives new requirements. */
export const APPLICATION_WORKFLOW_STEPS = [
  { n: 1, label: "Requirements" },
  { n: 2, label: "Medical review" },
  { n: 3, label: "Email Pacific Cross" },
  { n: 4, label: "Pacific Cross reply" },
  { n: 5, label: "Payment" },
  { n: 6, label: "Log policy copy" },
] as const;

export type WorkflowStepNumber = 1 | 2 | 3 | 4 | 5 | 6;
export interface WorkflowFacts {
  outstanding: number;
  medicalReviewRequired: boolean;
  medicalReviewCleared: boolean;
  submitted: boolean;
  proposalOnFile: boolean;
  paymentStatus: string | null;
  policyLinked: boolean;
}
export interface WorkflowProgress {
  done: Record<WorkflowStepNumber, boolean>;
  /** Seven is terminal; the modal displays the completed policy step. */
  current: WorkflowStepNumber | 7;
}

export function workflowProgress(facts: WorkflowFacts): WorkflowProgress {
  const billingOnFile = facts.proposalOnFile || facts.paymentStatus !== null;
  const medicalDone = !facts.medicalReviewRequired || facts.medicalReviewCleared;
  const done: Record<WorkflowStepNumber, boolean> = {
    1: facts.outstanding === 0,
    2: medicalDone,
    3: facts.submitted,
    4: facts.submitted && billingOnFile && facts.outstanding === 0,
    5: facts.paymentStatus === "Verified",
    6: facts.policyLinked,
  };
  const current = facts.policyLinked ? 7
    : facts.paymentStatus === "Verified" ? 6
      : facts.submitted ? (billingOnFile && facts.outstanding === 0 ? 5 : 4)
        : facts.outstanding > 0 ? 1
          : !medicalDone ? 2 : 3;
  return { done, current };
}

export const isStepUnlocked = (progress: WorkflowProgress, n: WorkflowStepNumber) => n <= progress.current;
