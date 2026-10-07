import { describe, expect, it } from "vitest";

import { isStepUnlocked, workflowProgress } from "./workflow";

const facts = { outstanding: 0, submitted: false, proposalOnFile: false, paymentStatus: null, policyLinked: false };
const sent = { ...facts, submitted: true };

describe("workflowProgress", () => {
  it("walks the five steps in order", () => {
    expect(workflowProgress({ ...facts, outstanding: 2 }).current).toBe(1);
    expect(workflowProgress(facts).current).toBe(2);
    expect(workflowProgress(sent).current).toBe(3);
    expect(workflowProgress({ ...sent, proposalOnFile: true }).current).toBe(4);
    expect(workflowProgress({ ...sent, proposalOnFile: true, paymentStatus: "Awaiting" }).current).toBe(4);
    expect(workflowProgress({ ...sent, proposalOnFile: true, paymentStatus: "Verified" }).current).toBe(5);
    expect(workflowProgress({ ...sent, proposalOnFile: true, paymentStatus: "Verified", policyLinked: true }).current).toBe(6);
  });

  it("waits on the reply step while Pacific Cross's requests are with the client", () => {
    const progress = workflowProgress({ ...sent, proposalOnFile: true, outstanding: 1 });
    expect(progress.current).toBe(3);
    expect(progress.done[1]).toBe(false);
    expect(progress.done[3]).toBe(false);
  });

  it("treats an already-recorded billed amount as the billing being in hand", () => {
    expect(workflowProgress({ ...sent, paymentStatus: "Awaiting" }).current).toBe(4);
  });

  it("does not fall back once a later step is done", () => {
    expect(workflowProgress({ ...sent, outstanding: 1, paymentStatus: "Verified" }).current).toBe(5);
  });

  it("locks steps beyond the current one", () => {
    const progress = workflowProgress(sent);
    expect(isStepUnlocked(progress, 3)).toBe(true);
    expect(isStepUnlocked(progress, 4)).toBe(false);
  });
});
