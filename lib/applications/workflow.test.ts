import { describe, expect, it } from "vitest";
import { APPLICATION_WORKFLOW_STEPS, isStepUnlocked, workflowProgress } from "./workflow";

const facts = { outstanding: 0, medicalReviewRequired: false, medicalReviewCleared: false, submitted: false, proposalOnFile: false, paymentStatus: null, policyLinked: false };
const sent = { ...facts, submitted: true };

describe("workflowProgress", () => {
  it("walks all six fixed steps with terminal seven", () => {
    expect(APPLICATION_WORKFLOW_STEPS.map((step) => step.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(workflowProgress({ ...facts, outstanding: 2 }).current).toBe(1);
    expect(workflowProgress({ ...facts, medicalReviewRequired: true }).current).toBe(2);
    expect(workflowProgress({ ...facts, medicalReviewRequired: true, medicalReviewCleared: true }).current).toBe(3);
    expect(workflowProgress(sent).current).toBe(4);
    expect(workflowProgress({ ...sent, proposalOnFile: true }).current).toBe(5);
    expect(workflowProgress({ ...sent, paymentStatus: "Awaiting" }).current).toBe(5);
    expect(workflowProgress({ ...sent, paymentStatus: "Verified" }).current).toBe(6);
    expect(workflowProgress({ ...sent, paymentStatus: "Verified", policyLinked: true }).current).toBe(7);
  });

  it("never lets auto-completed not-required medical review skip outstanding requirements", () => {
    const progress = workflowProgress({ ...facts, outstanding: 1 });
    expect(progress.done[2]).toBe(true);
    expect(progress.current).toBe(1);
    expect(isStepUnlocked(progress, 2)).toBe(false);
    expect(isStepUnlocked(progress, 3)).toBe(false);
  });

  it("skips medical only once requirements are in and review is not required", () => {
    expect(workflowProgress(facts).current).toBe(3);
    const pending = workflowProgress({ ...facts, medicalReviewRequired: true });
    expect(pending.done[2]).toBe(false);
    expect(isStepUnlocked(pending, 3)).toBe(false);
  });

  it("waits on reply while extra carrier requirements are outstanding", () => {
    const progress = workflowProgress({ ...sent, proposalOnFile: true, outstanding: 1 });
    expect(progress.current).toBe(4);
    expect(progress.done[1]).toBe(false);
    expect(progress.done[4]).toBe(false);
  });

  it("preserves later record precedence despite invalidated review or new requirements", () => {
    const pending = { ...sent, medicalReviewRequired: true, outstanding: 1 };
    expect(workflowProgress(pending).current).toBe(4);
    expect(workflowProgress({ ...pending, paymentStatus: "Verified" }).current).toBe(6);
    const issued = workflowProgress({ ...pending, policyLinked: true });
    expect(issued.current).toBe(7);
    expect(issued.done[2]).toBe(false);
  });

  it("locks only future steps and derives done markers independently", () => {
    const progress = workflowProgress(sent);
    expect(isStepUnlocked(progress, 4)).toBe(true);
    expect(isStepUnlocked(progress, 5)).toBe(false);
    expect(progress.done[3]).toBe(true);
    expect(progress.done[4]).toBe(false);
  });
});
