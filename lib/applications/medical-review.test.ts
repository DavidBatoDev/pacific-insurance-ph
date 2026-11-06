import { describe, expect, it } from "vitest";
import { medicalReviewRequired, medicalReviewStatus } from "./medical-review";

const allNo = { productName: "Select", principalPreExistingStatus: "No", dependents: [] };
const yes = { ...allNo, principalPreExistingStatus: "Yes" };
const cleared = { medicalClass: "Principal: assessment recorded by staff", clearedAt: "2026-11-06T10:00:00Z", clearedBy: "staff-id" };

describe("internal medical review eligibility", () => {
  it.each(["Select", "Blue Royale", "FlexiShield", "  blue   royale  "])("requires review for exact individual health product %s", (productName) => {
    expect(medicalReviewRequired({ ...yes, productName })).toBe(true);
  });

  it.each(["BC Flexi", "TravelSafe", "Select Plus", "Select Standard", "Select custom", "Group Blue Royale", null])("never infers eligibility from %s", (productName) => {
    expect(medicalReviewRequired({ ...yes, productName })).toBe(false);
  });

  it.each(["No", "Unknown", "yes", " Yes ", null])("only persisted exact Yes triggers principal review, not %s", (principalPreExistingStatus) => {
    expect(medicalReviewRequired({ ...allNo, principalPreExistingStatus })).toBe(false);
  });

  it("includes dependent-only Yes without deduplicating people by their names", () => {
    expect(medicalReviewRequired({ ...allNo, dependents: [{ preExistingStatus: "Unknown" }, { preExistingStatus: "Yes" }, { preExistingStatus: "Yes" }] })).toBe(true);
    expect(medicalReviewRequired({ ...allNo, dependents: [{ preExistingStatus: "Unknown" }, { preExistingStatus: "No" }] })).toBe(false);
  });
});

describe("medical review display status", () => {
  it("is Not required regardless of historic clearance when eligibility no longer applies", () => {
    expect(medicalReviewStatus({ ...allNo, ...cleared })).toBe("Not required");
  });

  it("requires an assessment, real clearance timestamp and reviewer", () => {
    expect(medicalReviewStatus({ ...yes, ...cleared })).toBe("Cleared");
    expect(medicalReviewStatus({ ...yes, ...cleared, clearedAt: null })).toBe("Pending");
    expect(medicalReviewStatus({ ...yes, ...cleared, clearedBy: null })).toBe("Pending");
    expect(medicalReviewStatus({ ...yes, ...cleared, clearedAt: "invalid" })).toBe("Pending");
    expect(medicalReviewStatus({ ...yes, ...cleared, medicalClass: "  " })).toBe("Pending");
    expect(medicalReviewStatus({ ...yes, ...cleared, medicalClass: "x".repeat(501) })).toBe("Pending");
    expect(medicalReviewStatus({ ...yes, ...cleared, medicalClass: "x".repeat(500) })).toBe("Cleared");
  });
});
