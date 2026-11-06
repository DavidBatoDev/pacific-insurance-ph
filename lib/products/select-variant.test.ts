import { describe, expect, it } from "vitest";
import { discoveryGaps } from "@/components/hub/lead-config";
import { uniquePlanPreferenceMatch } from "@/components/hub/overlays/wizard/wizard-data";
import {
  isSelectProduct, isSelectVariant, planLimitDescription, plansForSelectVariant,
  resumeSelectVariant, SELECT_VARIANTS, selectLimitBasis, selectVariantFromInterest,
} from "./select-variant";

const plans = [
  { id: "plus-ward", name: "Plus Ward", coverageTier: "Ward", planFamily: "Select Plus", maximumCoverage: 1_000_000, coverageCurrency: "PHP", limitBasis: "Aggregate, annual reset" },
  { id: "standard-ward", name: "Standard Ward", coverageTier: "Ward", planFamily: "Select Standard", maximumCoverage: 1_000_000, coverageCurrency: "PHP", limitBasis: "Per illness, depleting" },
  { id: "plus-private-5m", name: "Plus Private 5M", coverageTier: "Private", planFamily: "Select Plus", maximumCoverage: 5_000_000, coverageCurrency: "PHP", limitBasis: "Aggregate, annual reset" },
];

describe("Select product and variant contracts", () => {
  it("recognizes only exact normalized product/legacy interest names", () => {
    expect(isSelectProduct("  SELECT  ")).toBe(true);
    expect(selectVariantFromInterest(" select   STANDARD ")).toBe("Select Standard");
    for (const name of ["Select Plus Private", "Please select", "Selectivity", "Ward", "Blue Royale"]) {
      expect(isSelectProduct(name)).toBe(false);
      expect(selectVariantFromInterest(name)).toBeNull();
    }
    expect(isSelectVariant("select plus")).toBe(false);
    expect(isSelectVariant("Select Plus ")).toBe(false);
  });
  it("keeps the two canonical limit meanings independent of amount", () => {
    expect(SELECT_VARIANTS.map(selectLimitBasis)).toEqual(["Aggregate, annual reset", "Per illness, depleting"]);
    expect(planLimitDescription(plans[2])).toBe("PHP 5,000,000 · Aggregate, annual reset");
    expect(planLimitDescription(plans[1])).toBe("PHP 1,000,000 · Per illness, depleting");
    expect(planLimitDescription(null)).toBe("Not recorded · Not recorded");
    expect(planLimitDescription({ maximumCoverage: 5_000_000, coverageCurrency: null, limitBasis: null })).toBe("Not recorded · Not recorded");
  });
  it("never uses a room preference to select between the two families", () => {
    expect(plansForSelectVariant(plans, "Select", "")).toEqual([]);
    expect(uniquePlanPreferenceMatch("Ward", plans)).toBeNull();
    const plus = plansForSelectVariant(plans, "Select", "Select Plus");
    expect(uniquePlanPreferenceMatch("Ward", plus)?.id).toBe("plus-ward");
    expect(plansForSelectVariant(plans, "Select", "Select Standard").some((plan) => plan.id === "plus-private-5m")).toBe(false);
    expect(plansForSelectVariant(plans, "Blue Royale", "")).toBe(plans);
  });
  it("upgrades old drafts only from exact plan family or exact legacy product interest", () => {
    expect(resumeSelectVariant({ productName: "Select", planFamily: "Select Plus" })).toBe("Select Plus");
    expect(resumeSelectVariant({ productName: "Select", legacyProductInterest: "Select Standard" })).toBe("Select Standard");
    expect(resumeSelectVariant({ productName: "Select", legacyProductInterest: "Select" })).toBe("");
    expect(resumeSelectVariant({ productName: "Select", planFamily: "Ward", legacyProductInterest: "Select Ward" })).toBe("");
    expect(resumeSelectVariant({ productName: "Select", savedVariant: "Select Standard", planFamily: "Select Plus" })).toBe("Select Standard");
    expect(resumeSelectVariant({ productName: "TravelSafe", savedVariant: "Select Plus", planFamily: "Select Plus" })).toBe("");
  });
  it("requires the explicit variant for Select discovery, not for unrelated products", () => {
    const discovery = { productInterest: "Select", coverageTier: "Ward", estPremium: 50_000, familySize: 1 };
    expect(discoveryGaps(discovery)).toEqual(["Select variant"]);
    expect(discoveryGaps({ ...discovery, selectVariant: "Select Plus" })).toEqual([]);
    expect(discoveryGaps({ ...discovery, productInterest: "Blue Royale" })).toEqual([]);
    expect(discoveryGaps({ ...discovery, productInterest: "Select Standard" })).toEqual([]);
  });
});
