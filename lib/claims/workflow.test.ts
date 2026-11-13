import { describe, expect, it } from "vitest";

import { claimWorkflowProgress, isClaimStepUnlocked, type ClaimWorkflowFacts } from "./workflow";

const filed: ClaimWorkflowFacts = { claimExists: true, requirementCount: 14, checklistAvailable: true, outstanding: 0, submitted: false };

describe("claimWorkflowProgress", () => {
  it("starts on claim details for a new claim, with later steps locked", () => {
    const progress = claimWorkflowProgress({ ...filed, claimExists: false, requirementCount: 0 });
    expect(progress.current).toBe(1);
    expect(isClaimStepUnlocked(progress, 2)).toBe(false);
  });

  it("walks requirements, then the email", () => {
    expect(claimWorkflowProgress({ ...filed, outstanding: 3 }).current).toBe(2);
    expect(claimWorkflowProgress(filed).current).toBe(3);
    expect(claimWorkflowProgress({ ...filed, submitted: true }).current).toBe(4);
  });

  it("keeps a submitted claim on its last step even if an item reopens", () => {
    expect(claimWorkflowProgress({ ...filed, outstanding: 1, submitted: true }).current).toBe(4);
  });

  it("opens on requirements when the checklist was never generated", () => {
    const progress = claimWorkflowProgress({ ...filed, requirementCount: 0 });
    expect(progress.done[2]).toBe(false);
    expect(progress.current).toBe(2);
    expect(isClaimStepUnlocked(progress, 3)).toBe(false);
  });

  it("lets a type without a checklist template (Travel) reach the email step", () => {
    const progress = claimWorkflowProgress({ ...filed, requirementCount: 0, checklistAvailable: false });
    expect(progress.done[2]).toBe(true);
    expect(progress.current).toBe(3);
  });
});
