import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Linked-record counts per product (policies + applications + travel requests
 * via product_versions). Drives the Products screen's delete guardrails:
 * a product with linked records can only be deactivated.
 */
export async function getProductUsageCounts(): Promise<Record<string, number>> {
  const supabase = getSupabaseAdmin();
  const { data: versions, error } = await supabase
    .from("product_versions")
    .select("id, product_id");
  if (error || !versions) return {};

  const versionToProduct = new Map(versions.map((v) => [v.id, v.product_id]));

  const usage: Record<string, number> = {};
  const bump = (versionId: string | null) => {
    if (!versionId) return;
    const productId = versionToProduct.get(versionId);
    if (productId) usage[productId] = (usage[productId] ?? 0) + 1;
  };

  const [policies, applications, travel] = await Promise.all([
    supabase.from("policies").select("product_version_id"),
    supabase.from("applications").select("product_version_id"),
    supabase.from("travel_requests").select("product_version_id"),
  ]);
  for (const row of policies.data ?? []) bump(row.product_version_id);
  for (const row of applications.data ?? []) bump(row.product_version_id);
  for (const row of travel.data ?? []) bump(row.product_version_id);

  return usage;
}
