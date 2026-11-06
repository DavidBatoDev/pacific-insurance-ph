"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { registerUploadedPdf } from "@/lib/documents/uploaded-pdf";
import { getApplicationsRepository } from "@/lib/repositories/applications";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getPaymentsRepository } from "@/lib/repositories/payments";
import { getPoliciesRepository, type NewPolicy, type Policy, type PolicyUpdate } from "@/lib/repositories/policies";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { validateCatalogSelection } from "@/lib/products/catalog-selection";
import { isSelectVariant } from "@/lib/products/select-variant";

/** Product picker options (products + versions + plan options) for the drawers. */
export interface ProductOption {
  productVersionId: string;
  productName: string;
  productCategory: string | null;
  planOptions: {
    id: string; name: string; coverageTier: string | null; planFamily: string | null;
    limitBasis: string | null; maximumCoverage: number | null; coverageCurrency: string | null;
  }[];
}

export async function listProductOptionsAction(): Promise<ProductOption[]> {
  await getActor();
  const { data, error } = await getSupabaseAdmin()
    .from("product_versions")
    .select("id, status, product:products (name, category, status), plan_options (id, plan_name, coverage_tier, plan_family, limit_basis, maximum_coverage, coverage_currency, status)")
    .eq("status", "Active")
    .order("id");
  if (error) return [];
  return (data ?? [])
    .filter((v) => v.product?.status === "Active")
    .map((v) => ({
      productVersionId: v.id,
      productName: (v.product as { name: string } | null)?.name ?? "—",
      productCategory: (v.product as { category: string | null } | null)?.category ?? null,
      planOptions: (v.plan_options ?? []).filter((p) => p.status === "Active").map((p) => ({
        id: p.id,
        name: p.plan_name,
        coverageTier: p.coverage_tier,
        planFamily: p.plan_family,
        limitBasis: p.limit_basis,
        maximumCoverage: p.maximum_coverage,
        coverageCurrency: p.coverage_currency,
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
  input: NewPolicy & { selectVariant?: string | null },
  pdf?: UploadedPolicyPdf | null,
  options?: { applicationId?: string | null },
): Promise<ActionResult<Policy>> {
  const actor = await getActor();
  if (!input.clientId) return { ok: false, error: "A client is required." };

  try {
    await validateCatalogSelection({ ...input, completing: true });
    // Logged from the application workflow: the policy closes out that application.
    const application = options?.applicationId ? await getApplicationsRepository().findById(options.applicationId) : null;
    if (options?.applicationId) {
      if (!application || application.clientId !== input.clientId) return { ok: false, error: "That application doesn’t belong to this client." };
      if (application.policyId) return { ok: false, error: "A policy is already logged for this application." };
    }
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
    // Application policies retain their billed application payment. A standalone policy has no
    // other collection source, so open one now even when the premium still needs to be recorded.
    if (!application) {
      const payment = await getPaymentsRepository().create({
        clientId: created.clientId,
        policyId: created.id,
        amount: created.premiumAmount,
        status: "Awaiting",
        notes: "Premium due for logged policy copy",
      });
      await recordActivity({
        scopeType: "client",
        scopeId: input.clientId,
        activityType: "payment.awaiting",
        summary: `Awaiting payment created — ${created.referenceNo ?? created.policyNumber ?? "policy"}${payment.amount != null ? ` · ₱${payment.amount.toLocaleString("en-PH")}` : ""}`,
        actorId: actor.id,
      });
      await recordAudit({
        actorId: actor.id,
        action: "create",
        tableName: "payments",
        recordId: payment.id,
        newValue: { policy_id: created.id, amount: payment.amount, status: payment.status } as unknown as Json,
      });
    }

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
    if (application) await convertApplicationToPolicy(application.id, created, actor.id);
    revalidatePath("/policies");
    revalidatePath("/renewals");
    revalidatePath("/dashboard");
    revalidatePath("/applications");
    revalidatePath(`/clients/${input.clientId}`);
    revalidatePath("/payments");
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to log the policy copy." };
  }
}

/**
 * The application's last hand-off: link the new policy to the application, carry the verified
 * payment's OR onto it, and convert the client to a Policyholder (decided 2026-10-07 — on Log
 * policy copy, not on payment).
 */
async function convertApplicationToPolicy(applicationId: string, policy: Policy, actorId: string) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const applications = getApplicationsRepository();
  await applications.update(applicationId, { policyId: policy.id, policyIssuedDate: today });

  const payment = (await getPaymentsRepository().listByApplication(applicationId)).filter((row) => row.status === "Verified").at(-1);
  if (payment) {
    await getPaymentsRepository().update(payment.id, { policyId: policy.id });
    if (payment.orNumber) await getSupabaseAdmin().from("policies").update({ or_number: payment.orNumber }).eq("id", policy.id);
  }

  const client = await getClientsRepository().findById(policy.clientId);
  if (client && client.lifecycleStage !== "Policyholder") {
    await getClientsRepository().update(client.id, { lifecycleStage: "Policyholder" });
    await recordAudit({
      actorId, action: "convert_to_policyholder", tableName: "clients", recordId: client.id,
      previousValue: { lifecycle_stage: client.lifecycleStage }, newValue: { lifecycle_stage: "Policyholder", policy_id: policy.id, application_id: applicationId },
    });
  }
  await recordActivity({
    scopeType: "client", scopeId: policy.clientId, actorId,
    activityType: "client.converted",
    summary: `Policy issued — ${client?.fullName ?? "client"} is now a policyholder (${policy.policyNumber ?? policy.referenceNo ?? "policy"})`,
  });
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
export async function updatePolicyAction(id: string, input: PolicyUpdate & { selectVariant?: string | null }): Promise<ActionResult<Policy>> {
  const actor = await getActor();
  try {
    const repo = getPoliciesRepository();
    const before = await repo.findById(id);
    if (!before) return { ok: false, error: "This policy could not be found." };
    const productChanged = input.productVersionId !== undefined && input.productVersionId !== before.productVersionId;
    const planChanged = input.planOptionId !== undefined && input.planOptionId !== before.planOptionId;
    const variantChanged = input.selectVariant !== undefined &&
      (input.selectVariant || null) !== (isSelectVariant(before.planFamily) ? before.planFamily : null);
    // Historical unresolved/inactive selections survive unrelated edits; a new selection never does.
    if (productChanged || planChanged || variantChanged) {
      await validateCatalogSelection({
        productVersionId: input.productVersionId === undefined ? before.productVersionId : input.productVersionId,
        planOptionId: input.planOptionId === undefined ? before.planOptionId : input.planOptionId,
        selectVariant: input.selectVariant,
        completing: true,
      });
    }

    const changed = (Object.keys(input) as (keyof PolicyUpdate)[]).filter(
      (key) => key !== ("selectVariant" as string) && input[key] !== undefined && (input[key] ?? null) !== ((before as unknown as Record<string, unknown>)[key] ?? null),
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
    revalidatePath("/renewals");
    revalidatePath("/dashboard");
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
