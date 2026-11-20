import { isSelectProduct, type SelectVariant } from "./select-variant";

/**
 * The Pacific Cross proposal portal's Plan option for a Select lead: the variant and the room
 * tier in one label ("STANDARD WARD", "PLUS PRIVATE 2M"), matching the portal's dropdown. The
 * lead stores the two halves separately (`selectVariant`, `coverageTier`).
 */
const SELECT_TIERS: Record<string, string> = {
  "Ward": "WARD",
  "Semi-Private": "S-PRIVATE",
  "Private 2M": "PRIVATE 2M",
  "Private 3M": "PRIVATE 3M",
  "Private 5M": "PRIVATE 5M",
};
const PLUS_ONLY: Record<string, true> = { "Private 3M": true, "Private 5M": true };

export type PortalPlan = { value: string; problem: null } | { value: null; problem: string };

export function portalPlanFor(
  product: string | null | undefined,
  variant: SelectVariant | null | undefined,
  tier: string | null | undefined,
): PortalPlan {
  if (!isSelectProduct(product)) {
    // Blue Royale's portal wording is unconfirmed; offer the stored tier as-is.
    return tier ? { value: tier, problem: null } : { value: null, problem: "Set the coverage tier on the lead." };
  }
  if (!variant && !tier) return { value: null, problem: "Set the Select variant and coverage tier on the lead." };
  if (!variant) return { value: null, problem: "Set the Select variant (Standard or Plus) on the lead." };
  if (!tier || !Object.hasOwn(SELECT_TIERS, tier)) return { value: null, problem: "Set the coverage tier on the lead." };
  if (variant === "Select Standard" && Object.hasOwn(PLUS_ONLY, tier)) return { value: null, problem: `${tier} is Select Plus only.` };
  return { value: `${variant === "Select Plus" ? "PLUS" : "STANDARD"} ${SELECT_TIERS[tier]}`, problem: null };
}

/** Surname particles that stay with the last name ("Maria de la Cruz" → "de la Cruz"). */
const PARTICLES: Record<string, true> = {
  de: true, del: true, dela: true, della: true, delos: true, los: true, la: true, las: true, le: true,
  san: true, santa: true, santo: true, "sta.": true, "sto.": true, van: true, von: true, da: true, di: true, du: true, y: true,
};

/**
 * Split a stored full name into the portal's First / Last name fields. Dependents keep only a
 * full name, so this is a best guess: the last word, plus any surname particles before it.
 */
export function splitFullName(fullName: string): { first: string; last: string } {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { first: words[0] ?? "", last: "" };
  let start = words.length - 1;
  while (start > 1 && Object.hasOwn(PARTICLES, words[start - 1].toLowerCase())) start--;
  return { first: words.slice(0, start).join(" "), last: words.slice(start).join(" ") };
}
