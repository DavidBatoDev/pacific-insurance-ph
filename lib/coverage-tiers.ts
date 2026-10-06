/**
 * Discovery coverage tiers, per product (TO-BE-UPDATE-PLAN.md H1a, decision DH3, 2026-10-06).
 *
 * Each value is exactly a catalog `plan_options.coverage_tier` string (migration 0037), so a tier
 * captured on a lead feeds `uniquePlanPreferenceMatch` and can pre-select the plan in the wizard.
 * Keep this in step with the catalog and the carrier brochures:
 * - Select: Ward, Semi-Private and Private 2M exist in both Select Plus and Select Standard;
 *   Private 3M and 5M are Select Plus only.
 * - Blue Royale has no room tiers. Its tier is the plan (A / B / C = USD 500k / 1M / 2M); the room
 *   is a daily limit inside each plan (Blue Royale Brochure 2025, p. 3).
 * Group HMO tiers are a separate vocabulary and are deliberately not here (DH4).
 */
export interface CoverageTierGroup {
  product: string;
  tiers: readonly string[];
  note?: string;
}

export const COVERAGE_TIER_GROUPS: readonly CoverageTierGroup[] = [
  {
    product: "Select",
    tiers: ["Ward", "Semi-Private", "Private 2M", "Private 3M", "Private 5M"],
    note: "Private 3M / 5M: Select Plus only",
  },
  { product: "Blue Royale", tiers: ["Plan A", "Plan B", "Plan C"] },
];

/** The tier groups to offer for a product interest: that product's group, or all of them. */
export function coverageTierGroupsFor(productInterest: string | null | undefined): readonly CoverageTierGroup[] {
  const interest = productInterest?.trim().toLowerCase();
  const match = interest ? COVERAGE_TIER_GROUPS.find((group) => group.product.toLowerCase() === interest) : undefined;
  return match ? [match] : COVERAGE_TIER_GROUPS;
}
