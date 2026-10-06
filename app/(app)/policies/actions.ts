"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { registerUploadedPdf } from "@/lib/documents/uploaded-pdf";
import { getPoliciesRepository, type NewPolicy, type Policy, type PolicyUpdate } from "@/lib/repositories/policies";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

/** Product picker options (products + versions + plan options) for the drawers. */
export interface ProductOption {
  productVersionId: string;
  productName: string;
  productCategory: string | null;
  planOptions: { id: string; name: string; coverageTier: string | null }[];
}

export async function listProductOptionsAction(): Promise<ProductOption[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("product_versions")
    .select("id, status, product:products (name, category), plan_options (id, plan_name, coverage_tier)")
    .eq("status", "Active")
    .order("id");
  if (error) return [];
  return (data ?? [])
    .map((v) => ({
      productVersionId: v.id,
      productName: (v.product as { name: string } | null)?.name ?? "—",
      productCategory: (v.product as { category: string | null } | null)?.category ?? null,
      planOptions: ((v.plan_options ?? []) as { id: string; plan_name: string; coverage_tier: string | null }[]).map((p) => ({
        id: p.id,
        name: p.plan_name,
        coverageTier: p.coverage_tier,
      })),
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

/** The carrier's policy PDF, already uploaded to storage by `PdfUpload`. */
export interface UploadedPolicyPdf {
  path: string;
  fileName: string;
}

const POLICY_COPY_DOCUMENT_TYPE = "Policy Copy";

/**
 * Log policy copy (modals.md §4; TO-BE-UPDATE-PLAN.md H4a). Pacific Cross issues the policy to
 * the policyholder; the agency files its copy here. The PDF is optional so the details can be
 * logged before the password-free copy is ready; it can be attached later from the profile.
 */
export async function issuePolicyAction(
  input: NewPolicy,
  pdf?: UploadedPolicyPdf | null,
): Promise<ActionResult<Policy>> {
  const actor = await getActor();
  if (!input.clientId) return { ok: false, error: "A client is required." };

  try {
    const created = await getPoliciesRepository().create({
      ...input,
      status: input.status ?? "Active",
    });
    // Activity type stays `policy.issued` so existing timeline rows keep reading the same way.
    await recordActivity({
      scopeType: "client",
      scopeId: input.clientId,
      activityType: "policy.issued",
      summary: `Policy copy logged — ${created.policyNumber ?? created.referenceNo ?? "new policy"} (${created.productName ?? "product"})`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "create",
      tableName: "policies",
      recordId: created.id,
      newValue: created as unknown as Json,
    });
    if (pdf) {
      await registerUploadedPdf({
        path: pdf.path,
        name: pdf.fileName,
        clientId: input.clientId,
        policyId: created.id,
        documentType: POLICY_COPY_DOCUMENT_TYPE,
        actorId: actor.id,
      });
      revalidatePath("/documents");
    }
    revalidatePath("/policies");
    revalidatePath(`/clients/${input.clientId}`);
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to log the policy copy." };
  }
}

const POLICY_FIELD_LABELS: Partial<Record<keyof PolicyUpdate, string>> = {
  policyNumber: "policy number",
  productVersionId: "product",
  planOptionId: "plan",
  paymentMode: "payment mode",
  premiumAmount: "premium",
  effectiveDate: "effective date",
  expiryDate: "expiry date",
  renewalDate: "renewal date",
  status: "status",
  notes: "notes",
};

/** Edit a policy from the contact profile (TO-BE-UPDATE-PLAN.md H1c) — e.g. a corrected policy number. */
export async function updatePolicyAction(id: string, input: PolicyUpdate): Promise<ActionResult<Policy>> {
  const actor = await getActor();
  try {
    const repo = getPoliciesRepository();
    const before = await repo.findById(id);
    if (!before) return { ok: false, error: "This policy could not be found." };

    const changed = (Object.keys(input) as (keyof PolicyUpdate)[]).filter(
      (key) => input[key] !== undefined && (input[key] ?? null) !== ((before as unknown as Record<string, unknown>)[key] ?? null),
    );
    if (changed.length === 0) return { ok: true, data: before };

    const updated = await repo.update(id, Object.fromEntries(changed.map((key) => [key, input[key]])) as PolicyUpdate);
    await recordActivity({
      scopeType: "client",
      scopeId: before.clientId,
      activityType: "policy.updated",
      summary: `Policy ${updated.policyNumber ?? updated.referenceNo ?? ""} updated — ${changed.map((key) => POLICY_FIELD_LABELS[key] ?? key).join(", ")}`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "update",
      tableName: "policies",
      recordId: id,
      previousValue: before as unknown as Json,
      newValue: updated as unknown as Json,
    });
    revalidatePath("/policies");
    revalidatePath(`/clients/${before.clientId}`);
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update the policy." };
  }
}

/** Attach the carrier's policy PDF to an already-logged policy (H4a "attach later"). */
export async function attachPolicyPdfAction(policyId: string, path: string, fileName: string): Promise<ActionResult<null>> {
  const actor = await getActor();
  try {
    const policy = await getPoliciesRepository().findById(policyId);
    if (!policy) return { ok: false, error: "This policy could not be found." };
    await registerUploadedPdf({
      path,
      name: fileName,
      clientId: policy.clientId,
      policyId,
      documentType: POLICY_COPY_DOCUMENT_TYPE,
      actorId: actor.id,
    });
    await recordActivity({
      scopeType: "client",
      scopeId: policy.clientId,
      activityType: "document.uploaded",
      summary: `Policy copy attached — ${policy.policyNumber ?? policy.referenceNo ?? "policy"}`,
      actorId: actor.id,
    });
    revalidatePath("/policies");
    revalidatePath("/documents");
    revalidatePath(`/clients/${policy.clientId}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to attach the policy PDF." };
  }
}
