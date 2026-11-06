import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { catalogSelectionProblem, type CatalogSelectionInput, type SelectionVersion, type SelectionPlan } from "./selection-rules";

/** Resolve catalog authority before any contact, application or policy mutation. */
export async function validateCatalogSelection(input: CatalogSelectionInput) {
  let version: SelectionVersion | null = null;
  let plan: SelectionPlan | null = null;
  if (input.productVersionId) {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("product_versions")
      .select("id, status, product:products (name, category, status)")
      .eq("id", input.productVersionId).maybeSingle();
    if (error) throw new Error(error.message);
    version = data;
    if (input.planOptionId) {
      const { data: selectedPlan, error: planError } = await db.from("plan_options")
        .select("id, product_version_id, plan_family, status")
        .eq("id", input.planOptionId).maybeSingle();
      if (planError) throw new Error(planError.message);
      plan = selectedPlan;
    }
  }
  const problem = catalogSelectionProblem(input, version, plan);
  if (problem) throw new Error(problem);
  return version?.product ? { productName: version.product.name, productCategory: version.product.category, plan } : null;
}
