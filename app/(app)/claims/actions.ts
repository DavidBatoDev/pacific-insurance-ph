"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { getClaimsRepository, type Claim, type NewClaim } from "@/lib/repositories/claims";
import {
  getClaimRequirementsRepository,
  type ClaimRequirement,
  type ClaimRequirementStatus,
  type ClaimChecklistType,
} from "@/lib/repositories/claim-requirements";
import { getPoliciesRepository } from "@/lib/repositories/policies";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

/** A contact's policies, for the File Claim drawer's policy picker. */
export async function listClientPoliciesAction(
  clientId: string,
): Promise<{ id: string; label: string }[]> {
  const policies = await getPoliciesRepository().listByClient(clientId);
  return policies.map((p) => ({
    id: p.id,
    label: [p.referenceNo, p.productName].filter(Boolean).join(" · ") || p.id.slice(0, 8),
  }));
}

/** File Claim (modals.md §6) — creates a claim linked to client + policy. */
export async function fileClaimAction(input: NewClaim): Promise<ActionResult<Claim>> {
  const actor = await getActor();
  if (!input.clientId) return { ok: false, error: "A claimant is required." };

  try {
    const created = await getClaimsRepository().create({
      ...input,
      status: input.status ?? "Documents Pending",
    });
    await recordActivity({
      scopeType: "client",
      scopeId: input.clientId,
      activityType: "claim.filed",
      summary: `Claim filed — ${created.referenceNo ?? "new claim"} (${created.claimType ?? "claim"})`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "create",
      tableName: "claims",
      recordId: created.id,
      newValue: created as unknown as Json,
    });
    revalidatePath("/claims");
    revalidatePath(`/clients/${input.clientId}`);
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to file claim." };
  }
}

export interface ClaimRequirementsPayload {
  claim: Claim;
  requirements: ClaimRequirement[];
}

const CLAIM_CHECKLIST_TEMPLATE_NAME: Record<ClaimChecklistType, string> = {
  "In-Patient": "Medical NOC — In-Patient Claim",
  "Out-Patient": "Medical NOC — Out-Patient Claim",
};

/** Requirements checklist for one claim, for the claim requirements overlay. */
export async function getClaimRequirementsAction(claimId: string): Promise<ActionResult<ClaimRequirementsPayload>> {
  await getActor();
  try {
    const claim = await getClaimsRepository().findById(claimId);
    if (!claim) return { ok: false, error: "This claim could not be found." };
    const requirements = await getClaimRequirementsRepository().listByClaim(claimId);
    return { ok: true, data: { claim, requirements } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to load claim requirements." };
  }
}

/**
 * Copies the configured checklist template into an immutable per-claim instance --
 * same template/instance split as `snapshotApplicationRequirements`'s template branch
 * (app/(app)/applications/wizard-actions.ts), built on the C4 configurable
 * required_document_templates / required_document_items pattern rather than a
 * hardcoded list. Unlike applications, claims have no wizard to snapshot at creation
 * time, so generation is an explicit staff action; a claim that already has a
 * checklist is left untouched rather than erroring, so a repeat click is harmless.
 */
export async function generateClaimRequirementsAction(
  claimId: string,
  checklistType: ClaimChecklistType,
): Promise<ActionResult<ClaimRequirement[]>> {
  const actor = await getActor();
  try {
    const claim = await getClaimsRepository().findById(claimId);
    if (!claim) return { ok: false, error: "This claim could not be found." };

    const repo = getClaimRequirementsRepository();
    const existing = await repo.listByClaim(claimId);
    if (existing.length > 0) return { ok: true, data: existing };

    const db = getSupabaseAdmin();
    const { data: template, error: templateError } = await db
      .from("required_document_templates")
      .select("id")
      .eq("template_name", CLAIM_CHECKLIST_TEMPLATE_NAME[checklistType])
      .eq("status", "Active")
      .maybeSingle();
    if (templateError) throw new Error(templateError.message);
    if (!template) return { ok: false, error: `No "${checklistType}" checklist template is configured.` };

    const { data: items, error: itemsError } = await db
      .from("required_document_items")
      .select("id, document_name, is_required, applies_to, notes, sort_order")
      .eq("requirement_template_id", template.id)
      .order("sort_order");
    if (itemsError) throw new Error(itemsError.message);
    if (!items?.length) return { ok: false, error: `The "${checklistType}" checklist template has no items configured.` };

    const created = await repo.createMany(
      items.map((item) => ({
        claimId,
        requiredDocumentItemId: item.id,
        documentName: item.document_name,
        isRequired: item.is_required,
        appliesTo: item.applies_to,
        notes: item.notes,
        sortOrder: item.sort_order,
      })),
    );

    await recordActivity({
      scopeType: "client",
      scopeId: claim.clientId,
      activityType: "claim.requirements_generated",
      summary: `${checklistType} checklist generated for ${claim.referenceNo ?? "claim"} (${created.length} item${created.length === 1 ? "" : "s"})`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "create",
      tableName: "claim_requirements",
      recordId: claimId,
      newValue: { checklistType, count: created.length } as unknown as Json,
    });
    revalidatePath("/claims");
    revalidatePath(`/clients/${claim.clientId}`);
    return { ok: true, data: created };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to generate the checklist." };
  }
}

export async function updateClaimRequirementStatusAction(
  claimId: string,
  requirementId: string,
  status: ClaimRequirementStatus,
): Promise<ActionResult<ClaimRequirement>> {
  const actor = await getActor();
  try {
    const claim = await getClaimsRepository().findById(claimId);
    if (!claim) return { ok: false, error: "This claim could not be found." };
    const repo = getClaimRequirementsRepository();
    const current = (await repo.listByClaim(claimId)).find((item) => item.id === requirementId);
    if (!current) return { ok: false, error: "That requirement does not belong to this claim." };
    const updated = await repo.updateStatus(requirementId, status);
    await recordActivity({
      scopeType: "client", scopeId: claim.clientId, actorId: actor.id,
      activityType: "claim.requirement_updated",
      summary: `${updated.documentName} marked ${updated.status} for ${claim.referenceNo ?? "claim"}`,
    });
    await recordAudit({
      actorId: actor.id, action: "update_status", tableName: "claim_requirements", recordId: updated.id,
      previousValue: { status: current.status }, newValue: { status: updated.status },
    });
    revalidatePath("/claims");
    revalidatePath(`/clients/${claim.clientId}`);
    return { ok: true, data: updated };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update the requirement." };
  }
}

export async function updateClaimRequirementRequiredAction(
  claimId: string,
  requirementId: string,
  isRequired: boolean,
): Promise<ActionResult<ClaimRequirement>> {
  const actor = await getActor();
  try {
    const claim = await getClaimsRepository().findById(claimId);
    if (!claim) return { ok: false, error: "This claim could not be found." };
    const repo = getClaimRequirementsRepository();
    const current = (await repo.listByClaim(claimId)).find((item) => item.id === requirementId);
    if (!current) return { ok: false, error: "That requirement does not belong to this claim." };
    const updated = await repo.updateRequired(requirementId, isRequired);
    await recordAudit({
      actorId: actor.id, action: "update_required", tableName: "claim_requirements", recordId: updated.id,
      previousValue: { is_required: current.isRequired }, newValue: { is_required: updated.isRequired },
    });
    revalidatePath("/claims");
    revalidatePath(`/clients/${claim.clientId}`);
    return { ok: true, data: updated };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update the requirement." };
  }
}
