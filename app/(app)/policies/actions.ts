"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { getPoliciesRepository, type NewPolicy, type Policy } from "@/lib/repositories/policies";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

/** Product picker options (products + versions + plan options) for the drawers. */
export interface ProductOption {
  productVersionId: string;
  productName: string;
  planOptions: { id: string; name: string }[];
}

export async function listProductOptionsAction(): Promise<ProductOption[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("product_versions")
    .select("id, status, product:products (name), plan_options (id, plan_name)")
    .eq("status", "Active")
    .order("id");
  if (error) return [];
  return (data ?? [])
    .map((v) => ({
      productVersionId: v.id,
      productName: (v.product as { name: string } | null)?.name ?? "—",
      planOptions: ((v.plan_options ?? []) as { id: string; plan_name: string }[]).map((p) => ({
        id: p.id,
        name: p.plan_name,
      })),
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

/** Issue Policy (modals.md §4) — manually encode a policy for a contact. */
export async function issuePolicyAction(input: NewPolicy): Promise<ActionResult<Policy>> {
  const actor = await getActor();
  if (!input.clientId) return { ok: false, error: "A client is required." };

  try {
    const created = await getPoliciesRepository().create({
      ...input,
      status: input.status ?? "Active",
    });
    await recordActivity({
      scopeType: "client",
      scopeId: input.clientId,
      activityType: "policy.issued",
      summary: `Policy issued — ${created.referenceNo ?? created.policyNumber ?? "new policy"} (${created.productName ?? "product"})`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "create",
      tableName: "policies",
      recordId: created.id,
      newValue: created as unknown as Json,
    });
    revalidatePath("/policies");
    revalidatePath(`/clients/${input.clientId}`);
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to issue policy." };
  }
}
