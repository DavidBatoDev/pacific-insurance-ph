import { describe, expect, it } from "vitest";

import { claimWorkflowProgress, isClaimStepUnlocked } from "./workflow";

describe("claimWorkflowProgress", () => {
  it("starts on claim details for a new claim, with later steps locked", () => {
    const progress = claimWorkflowProgress({ claimExists: false, outstanding: 0, submitted: false });
    expect(progress.current).toBe(1);
    expect(isClaimStepUnlocked(progress, 2)).toBe(false);
  });

  it("walks requirements, then the email", () => {
    expect(claimWorkflowProgress({ claimExists: true, outstanding: 3, submitted: false }).current).toBe(2);
    expect(claimWorkflowProgress({ claimExists: true, outstanding: 0, submitted: false }).current).toBe(3);
    expect(claimWorkflowProgress({ claimExists: true, outstanding: 0, submitted: true }).current).toBe(4);
  });

  it("keeps a submitted claim on its last step even if an item reopens", () => {
    expect(claimWorkflowProgress({ claimExists: true, outstanding: 1, submitted: true }).current).toBe(4);
  });
});
