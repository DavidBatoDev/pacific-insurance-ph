import { describe, expect, it } from "vitest";
import { isProposalAccepted, proposalChipLabel, proposalStatusLine } from "./lead-config";

describe("isProposalAccepted", () => {
  it("counts a sent or answered proposal once the lead has moved past Proposal", () => {
    expect(isProposalAccepted("Sent", null, "Product Selected")).toBe(true);
    expect(isProposalAccepted("Decision", "Awaiting Decision", "Application Started")).toBe(true);
    expect(isProposalAccepted("Received", null, "Product Selected")).toBe(true);
  });

  it("does not count while still at Proposal, before a quote exists, or after a decline", () => {
    expect(isProposalAccepted("Sent", null, "Proposal")).toBe(false);
    expect(isProposalAccepted("Requested", null, "Product Selected")).toBe(false);
    expect(isProposalAccepted("Decision", "Declined", "Product Selected")).toBe(false);
    expect(isProposalAccepted(null, null, "Product Selected")).toBe(false);
  });

  it("drives the chip and the tracking line", () => {
    expect(proposalChipLabel("Sent", null, "Product Selected")).toBe("Accepted");
    expect(proposalChipLabel("Decision", "Negotiating", "Proposal")).toBe("Negotiating");
    expect(proposalStatusLine("Sent", null, "Blue Royale", true)).toBe("Client accepted — Blue Royale quote.");
  });
});
