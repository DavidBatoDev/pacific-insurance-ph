import { isSelectProduct, isSelectVariant } from "./select-variant";

export interface CatalogSelectionInput {
  productVersionId?: string | null;
  planOptionId?: string | null;
  selectVariant?: unknown;
  completing: boolean;
  requireHealthPlan?: boolean;
}
export interface SelectionVersion {
  id: string;
  status: string;
  product: { name: string; category: string | null; status: string } | null;
}
export interface SelectionPlan {
  id: string;
  product_version_id: string;
  plan_family: string | null;
  status: string;
}

/** Validate resolved catalog records, not browser-supplied product names or categories. */
export function catalogSelectionProblem(
  input: CatalogSelectionInput, version: SelectionVersion | null, plan: SelectionPlan | null,
): string | null {
  if (input.selectVariant != null && input.selectVariant !== "" && !isSelectVariant(input.selectVariant)) {
    return "Choose Select Plus or Select Standard.";
  }
  if (!input.productVersionId) {
    if (input.planOptionId || input.selectVariant) return "Choose a product before its variant or plan.";
    return input.completing ? "Choose a product." : null;
  }
  if (!version || version.id !== input.productVersionId || version.status !== "Active" || !version.product || version.product.status !== "Active") {
    return "Choose an active product version.";
  }
  const select = isSelectProduct(version.product.name);
  if (!select && input.selectVariant) return "A Select variant cannot be used with another product.";
  if (select && input.completing && !isSelectVariant(input.selectVariant)) return "Choose Select Plus or Select Standard.";
  const health = version.product.category === "Primary Medical" || version.product.category === "Second-Layer Medical";
  if (!input.planOptionId) {
    return input.completing && (select || (input.requireHealthPlan && health)) ? "Choose a matching active plan." : null;
  }
  if (!plan || plan.id !== input.planOptionId || plan.status !== "Active" || plan.product_version_id !== version.id) {
    return "The selected plan does not belong to this active product version.";
  }
  if (select && (!isSelectVariant(input.selectVariant) || plan.plan_family !== input.selectVariant)) {
    return "Choose an active plan matching the selected Select variant.";
  }
  return null;
}
