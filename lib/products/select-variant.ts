export const SELECT_VARIANTS = ["Select Plus", "Select Standard"] as const;
export type SelectVariant = (typeof SELECT_VARIANTS)[number];
export type SelectLimitBasis = "Aggregate, annual reset" | "Per illness, depleting";

export function isSelectVariant(value: unknown): value is SelectVariant {
  return value === "Select Plus" || value === "Select Standard";
}

const normalized = (value: string | null | undefined) => value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";

/** Exact legacy product-interest values only, never a room tier or substring. */
export function selectVariantFromInterest(value: string | null | undefined): SelectVariant | null {
  const name = normalized(value);
  return SELECT_VARIANTS.find((variant) => normalized(variant) === name) ?? null;
}

export function isSelectProduct(value: string | null | undefined): boolean {
  return normalized(value) === "select" || selectVariantFromInterest(value) !== null;
}

export function selectLimitBasis(variant: SelectVariant): SelectLimitBasis {
  return variant === "Select Plus" ? "Aggregate, annual reset" : "Per illness, depleting";
}

export interface PlanLimitDetails {
  maximumCoverage: number | null;
  coverageCurrency: string | null;
  limitBasis: string | null;
}

/** Selected catalog amount is authoritative; historical omissions are never guessed. */
export function planLimitDescription(plan: PlanLimitDetails | null | undefined): string {
  const amount = plan?.maximumCoverage != null && plan.coverageCurrency
    ? `${plan.coverageCurrency} ${plan.maximumCoverage.toLocaleString("en-PH")}`
    : "Not recorded";
  return `${amount} · ${plan?.limitBasis ?? "Not recorded"}`;
}

export function plansForSelectVariant<T extends { planFamily: string | null }>(
  plans: T[], productName: string | null | undefined, variant: string | null | undefined,
): T[] {
  return isSelectProduct(productName) ? plans.filter((plan) => isSelectVariant(variant) && plan.planFamily === variant) : plans;
}

/** Upgrade old drafts from their exact selected plan before considering exact legacy interest. */
export function resumeSelectVariant(input: {
  productName: string; savedVariant?: unknown; planFamily?: string | null; legacyProductInterest?: string | null;
}): SelectVariant | "" {
  if (!isSelectProduct(input.productName)) return "";
  if (isSelectVariant(input.savedVariant)) return input.savedVariant;
  if (isSelectVariant(input.planFamily)) return input.planFamily;
  return selectVariantFromInterest(input.legacyProductInterest) ?? "";
}
