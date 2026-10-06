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
import {
  CLAIM_TYPES,
  INTERIM_CHECKLIST_TYPES,
  checklistForClaimType,
  type ClaimType,
} from "@/lib/repositories/claim-requirements/claim-requirement.entity";
import { CLAIM_SUBMISSION_MODES } from "@/lib/db-enums";
import { getPoliciesRepository } from "@/lib/repositories/policies";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

export interface ClaimPolicyOption {
  id: string;
  policyNumber: string | null;
  referenceNo: string | null;
  productName: string | null;
  productCategory: string | null;
  status: string;
}

/** A contact's policies, for the File Claim drawer's policy picker (DH14 eligibility is applied client-side). */
export async function listClientPoliciesAction(clientId: string): Promise<ClaimPolicyOption[]> {
  await getActor();
  const policies = await getPoliciesRepository().listByClient(clientId);
  return policies.map((p) => ({
    id: p.id,
    policyNumber: p.policyNumber,
    referenceNo: p.referenceNo,
    productName: p.productName,
    productCategory: p.productCategory,
    status: p.status,
  }));
}

/**
 * File Claim (modals.md §6) -- creates a claim linked to client + policy, then generates the
 * checklist its type maps to (H7c). Checklist generation is non-fatal: the claim is already
 * filed, so a failure comes back as `warning` and staff can use "Generate checklist" later.
 */
export async function fileClaimAction(
  input: NewClaim,
): Promise<ActionResult<{ claim: Claim; requirements: ClaimRequirement[]; warning?: string }>> {
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

    let requirements: ClaimRequirement[] = [];
    let warning: string | undefined;
    try {
      const generated = await generateForClaim(created, actor.id, checklistForClaimType(created.claimType));
      if (generated.ok) requirements = generated.data;
      else warning = `Claim filed, but the checklist wasn’t generated: ${generated.error}`;
    } catch (e) {
      warning = `Claim filed, but the checklist wasn’t generated: ${e instanceof Error ? e.message : "unknown error"}`;
    }

    revalidatePath("/claims");
    revalidatePath(`/clients/${input.clientId}`);
    return { ok: true, data: { claim: created, requirements, warning } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to file claim." };
  }
}

const fmtShortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

/** Edits how/when the client's claim arrived (H7f), from the claim requirements modal. */
export async function updateClaimIntakeAction(
  claimId: string,
  input: { submissionMode?: string | null; documentsReceivedDate?: string | null },
): Promise<ActionResult<Claim>> {
  const actor = await getActor();
  try {
    if (input.submissionMode && !(CLAIM_SUBMISSION_MODES as readonly string[]).includes(input.submissionMode)) {
      return { ok: false, error: "Unknown submission mode." };
    }
    if (input.documentsReceivedDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.documentsReceivedDate)) {
      return { ok: false, error: "Documents received must be a valid date." };
    }
    const claim = await getClaimsRepository().findById(claimId);
    if (!claim) return { ok: false, error: "This claim could not be found." };

    const updated = await getClaimsRepository().update(claimId, {
      submissionMode: input.submissionMode === undefined ? undefined : input.submissionMode || null,
      documentsReceivedDate: input.documentsReceivedDate === undefined ? undefined : input.documentsReceivedDate || null,
    });
    const parts = [
      updated.submissionMode,
      updated.documentsReceivedDate ? `received ${fmtShortDate(updated.documentsReceivedDate)}` : null,
    ].filter(Boolean);
    await recordActivity({
      scopeType: "client",
      scopeId: claim.clientId,
      actorId: actor.id,
      activityType: "claim.updated",
      summary: `Claim intake updated — ${parts.join(", ") || "cleared"}`,
    });
    await recordAudit({
      actorId: actor.id,
      action: "update",
      tableName: "claims",
      recordId: claimId,
      previousValue: { submission_mode: claim.submissionMode, documents_received_date: claim.documentsReceivedDate } as unknown as Json,
      newValue: { submission_mode: updated.submissionMode, documents_received_date: updated.documentsReceivedDate } as unknown as Json,
    });
    revalidatePath("/claims");
    revalidatePath(`/clients/${claim.clientId}`);
    return { ok: true, data: updated };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update the claim intake." };
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
 * required_document_templates / required_document_items pattern. A claim that already has
 * a checklist is left untouched, so a repeat call is harmless. Throws on DB errors.
 */
async function generateForClaim(
  claim: Claim,
  actorId: string,
  checklistType: ClaimChecklistType | null,
): Promise<ActionResult<ClaimRequirement[]>> {
  if (!checklistType) return { ok: true, data: [] };

  const repo = getClaimRequirementsRepository();
  const existing = await repo.listByClaim(claim.id);
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
      claimId: claim.id,
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
    actorId,
  });
  await recordAudit({
    actorId,
    action: "create",
    tableName: "claim_requirements",
    recordId: claim.id,
    newValue: { checklistType, count: created.length } as unknown as Json,
  });
  return { ok: true, data: created };
}

/**
 * Generates a claim's checklist. With no `checklistType` it is derived from the claim's type
 * (H7a/DH13); a type with no template (Travel, unknown) returns ok with no rows.
 */
export async function generateClaimRequirementsAction(
  claimId: string,
  checklistType?: ClaimChecklistType,
): Promise<ActionResult<ClaimRequirement[]>> {
  const actor = await getActor();
  try {
    const claim = await getClaimsRepository().findById(claimId);
    if (!claim) return { ok: false, error: "This claim could not be found." };
    const result = await generateForClaim(claim, actor.id, checklistType ?? checklistForClaimType(claim.claimType));
    if (result.ok && result.data.length > 0) {
      revalidatePath("/claims");
      revalidatePath(`/clients/${claim.clientId}`);
    }
    return result;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to generate the checklist." };
  }
}

/** Items the checklist for a claim type would contain, for the File Claim drawer's preview. */
export async function previewClaimChecklistAction(claimType: string): Promise<{
  checklistType: ClaimChecklistType | null;
  interim: boolean;
  items: { documentName: string; isRequired: boolean; appliesTo: string | null }[];
}> {
  await getActor();
  const checklistType = checklistForClaimType(claimType);
  const interim = INTERIM_CHECKLIST_TYPES.includes(claimType as ClaimType);
  if (!checklistType) return { checklistType: null, interim, items: [] };

  const db = getSupabaseAdmin();
  const { data: template } = await db
    .from("required_document_templates")
    .select("id")
    .eq("template_name", CLAIM_CHECKLIST_TEMPLATE_NAME[checklistType])
    .eq("status", "Active")
    .maybeSingle();
  if (!template) return { checklistType, interim, items: [] };
  const { data: items } = await db
    .from("required_document_items")
    .select("document_name, is_required, applies_to")
    .eq("requirement_template_id", template.id)
    .order("sort_order");
  return {
    checklistType,
    interim,
    items: (items ?? []).map((i) => ({ documentName: i.document_name, isRequired: i.is_required, appliesTo: i.applies_to })),
  };
}

/**
 * Changes a claim's type and regenerates its checklist (H7c). Same rule as the old reset:
 * only while every item is still Pending, so no document work is thrown away.
 */
export async function changeClaimTypeAction(
  claimId: string,
  claimType: string,
): Promise<ActionResult<{ claim: Claim; requirements: ClaimRequirement[]; warning?: string }>> {
  const actor = await getActor();
  try {
    if (!(CLAIM_TYPES as readonly string[]).includes(claimType)) return { ok: false, error: "Unknown claim type." };
    const claim = await getClaimsRepository().findById(claimId);
    if (!claim) return { ok: false, error: "This claim could not be found." };

    const repo = getClaimRequirementsRepository();
    const existing = await repo.listByClaim(claimId);
    const started = existing.filter((item) => item.status !== "Pending");
    if (started.length > 0) {
      return {
        ok: false,
        error: `${started.length} item${started.length === 1 ? " is" : "s are"} already past Pending — the claim type can’t be changed now.`,
      };
    }

    await repo.deletePendingByClaim(claimId);
    const remaining = await repo.listByClaim(claimId);
    if (remaining.length > 0) {
      return { ok: false, error: "Some checklist items changed while clearing, so the claim type was kept." };
    }

    const updated = await getClaimsRepository().update(claimId, { claimType });
    await recordActivity({
      scopeType: "client",
      scopeId: claim.clientId,
      activityType: "claim.type_changed",
      summary: `Claim type changed for ${claim.referenceNo ?? "claim"}: ${claim.claimType ?? "none"} → ${claimType}`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "update",
      tableName: "claims",
      recordId: claimId,
      previousValue: { claim_type: claim.claimType, checklist_items: existing.length } as unknown as Json,
      newValue: { claim_type: claimType } as unknown as Json,
    });

    let requirements: ClaimRequirement[] = [];
    let warning: string | undefined;
    try {
      const generated = await generateForClaim(updated, actor.id, checklistForClaimType(claimType));
      if (generated.ok) requirements = generated.data;
      else warning = `Type changed, but the checklist wasn’t generated: ${generated.error}`;
    } catch (e) {
      warning = `Type changed, but the checklist wasn’t generated: ${e instanceof Error ? e.message : "unknown error"}`;
    }
    revalidatePath("/claims");
    revalidatePath(`/clients/${claim.clientId}`);
    return { ok: true, data: { claim: updated, requirements, warning } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to change the claim type." };
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
