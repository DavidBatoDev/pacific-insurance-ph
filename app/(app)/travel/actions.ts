"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { assertRecordAccess } from "@/lib/auth/agent-scope";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toAppRole } from "@/lib/auth/permissions";
import { registerUploadedPdf } from "@/lib/documents/uploaded-pdf";
import {
  getTravelRepository,
  type NewTravelRequest,
  type TravelReferenceAttachment,
  type TravelReferenceCandidatePage,
  type TravelRequest,
  type TravelRequestUpdate,
} from "@/lib/repositories/travel";
import { RepositoryError } from "@/lib/repositories/types";
import { getRequirementAttachmentOriginal } from "@/lib/documents/requirement-attachments";
import { InboxReviewError } from "@/lib/gmail/review";
import { getCarrierWorkflowsRepository, type TravelerRecord, type TravelRequirementRecord } from "@/lib/repositories/carrier-workflows";
import { getDocumentLibraryRepository } from "@/lib/repositories/document-library";
import { getDocumentsRepository, type DocumentRecord } from "@/lib/repositories/documents";
import { getPaymentsRepository, type Payment } from "@/lib/repositories/payments";
import { getIntegrationSettingsRepository } from "@/lib/repositories/integration-settings";
import { resolveTravelPackReferences, TRAVEL_PACK_REFERENCE_SLOTS, type ResolvedTravelPackReference, type TravelPackReferenceKey } from "@/lib/travel/post-issuance-pack";
import type { Json } from "@/lib/supabase/types";

async function requireTravelPackStaff() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated.");
  if (user.status !== "Active" || toAppRole(user.role) === "agent")
    throw new Error("Only active Admin or Staff can file the post-issuance Travel pack.");
  return user;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PART_ID = /^(?:\d+(?:\.\d+)*)?$/;

class TravelReferenceInputError extends Error {}

function referenceSlot(value: unknown): TravelPackReferenceKey {
  const slot = TRAVEL_PACK_REFERENCE_SLOTS.find((candidate) => candidate.key === value);
  if (!slot) throw new TravelReferenceInputError("Choose a valid reference category.");
  return slot.key;
}

function referenceId(value: unknown, message: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new TravelReferenceInputError(message);
  return value;
}

/** Only fixed, reviewed messages reach the browser. */
function referenceActionError(error: unknown, fallback: string): string {
  return error instanceof TravelReferenceInputError || error instanceof RepositoryError || error instanceof InboxReviewError
    ? error.message
    : error instanceof Error && error.message.startsWith("Only active Admin or Staff") ? error.message : fallback;
}

/** New Travel Quote (modals.md §7) — creates a per-trip travel request. */
export async function createTravelQuoteAction(
  input: NewTravelRequest,
): Promise<ActionResult<TravelRequest>> {
  const actor = await getActor();
  if (!input.clientId) return { ok: false, error: "A traveler is required." };
  if (!input.destination?.trim()) return { ok: false, error: "Destination is required." };

  try {
    await assertRecordAccess("client", input.clientId);
    const created = await getTravelRepository().create({
      ...input,
      status: input.status ?? "Awaiting Payment",
    });
    await recordActivity({
      scopeType: "client",
      scopeId: input.clientId,
      activityType: "travel.quoted",
      summary: `Travel quote created — ${created.referenceNo ?? ""} ${created.destination ?? ""}`.trim(),
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "create",
      tableName: "travel_requests",
      recordId: created.id,
      newValue: created as unknown as Json,
    });
    revalidatePath("/travel");
    revalidatePath(`/clients/${input.clientId}`);
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create travel quote." };
  }
}

export interface TravelWorkflowPayload {
  travel: TravelRequest;
  travelers: TravelerRecord[];
  requirements: TravelRequirementRecord[];
  payments: Payment[];
  documents: DocumentRecord[];
  referenceDocuments: ResolvedTravelPackReference[];
  /** Supplementary references recorded from actual Inbox attachments, keyed by slot. */
  referenceAttachments: TravelReferenceAttachment[];
  canFilePostIssuance: boolean;
  portalUrl: string | null;
}

export async function getTravelWorkflowAction(id: string): Promise<ActionResult<TravelWorkflowPayload>> {
  try {
    const user = await getCurrentUser();
    if (!user || user.status !== "Active") return { ok: false, error: "Travel request not found." };
    await assertRecordAccess("travel", id);
    const travel = await getTravelRepository().findById(id);
    if (!travel) return { ok: false, error: "Travel request not found." };
    const workflows = getCarrierWorkflowsRepository();
    const today = new Date().toISOString().slice(0, 10);
    const [travelers, requirements, payments, documents, libraryDocuments, portal, referenceAttachments] = await Promise.all([
      workflows.listTravelers(id),
      workflows.listTravelRequirements(id),
      getPaymentsRepository().listByTravelRequest(id),
      getDocumentsRepository().listByTravelRequest(id),
      getDocumentLibraryRepository().listEligible({
        productName: "TravelSafe",
        documentTypes: ["Reference Document", "Claim Form"],
        ageBand: "All Ages",
        onDate: today,
      }),
      getIntegrationSettingsRepository().getTravelPortal(),
      getTravelRepository().listReferenceAttachments(user.id, id),
    ]);
    return {
      ok: true,
      data: {
        travel,
        travelers,
        requirements,
        payments,
        documents,
        referenceDocuments: resolveTravelPackReferences(libraryDocuments, today),
        referenceAttachments,
        canFilePostIssuance: toAppRole(user.role) !== "agent",
        portalUrl: portal?.portalUrl ?? null,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to load Travel workflow." };
  }
}

export async function updateTravelWorkflowAction(id: string, input: TravelRequestUpdate): Promise<ActionResult<TravelRequest>> {
  const actor = await getActor();
  try {
    await assertRecordAccess("travel", id);
    const previous = await getTravelRepository().findById(id);
    if (!previous) return { ok: false, error: "Travel request not found." };
    const policyNumber = input.policyNumber !== undefined ? input.policyNumber?.trim() : previous.policyNumber;
    if (input.portalProcessingStatus === "Issued" && !policyNumber)
      return { ok: false, error: "Enter the policy number the Travel portal issued before marking it Issued." };
    const updated = await getTravelRepository().update(id, input);
    await recordAudit({ actorId: actor.id, action: "update", tableName: "travel_requests", recordId: id, previousValue: previous as unknown as Json, newValue: updated as unknown as Json });
    revalidatePath("/travel");
    revalidatePath(`/clients/${updated.clientId}`);
    return { ok: true, data: updated };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update Travel workflow." };
  }
}

/**
 * Creates the trip's client collection when none exists (older trips, or ones created before the
 * premium was known). Returns the existing earliest collection otherwise; nothing else changes.
 */
export async function ensureTravelCollectionAction(travelRequestId: string): Promise<ActionResult<Payment>> {
  await getActor();
  try {
    if (typeof travelRequestId !== "string" || !UUID.test(travelRequestId)) return { ok: false, error: "Travel request not found." };
    await assertRecordAccess("travel", travelRequestId);
    if (!(await getTravelRepository().findById(travelRequestId))) return { ok: false, error: "Travel request not found." };
    const payment = await getPaymentsRepository().ensureTravelCollection(travelRequestId);
    revalidatePath("/payments");
    revalidatePath("/travel");
    if (payment.clientId) revalidatePath(`/clients/${payment.clientId}`);
    return { ok: true, data: payment };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn’t create the client collection." };
  }
}

/** Attach the policy PDF the Travel portal issued (uploaded to Storage by the browser). */
export async function recordTravelPolicyAction(
  travelRequestId: string,
  path: string,
  fileName: string,
): Promise<ActionResult<{ documentId: string; document: DocumentRecord; requirementId: string | null }>> {
  try {
    const actor = await requireTravelPackStaff();
    const travel = await getTravelRepository().findById(travelRequestId);
    if (!travel) return { ok: false, error: "Travel request not found." };
    const workflows = getCarrierWorkflowsRepository();
    const requirement = (await workflows.listTravelRequirements(travelRequestId))
      .find((item) => item.documentName === "Issued Travel policy") ?? null;
    const doc = await registerUploadedPdf({
      path,
      name: `Travel policy — ${travel.referenceNo ?? travelRequestId.slice(0, 8)} (${fileName})`,
      clientId: travel.clientId,
      travelRequestId,
      travelRequirementId: requirement?.id ?? null,
      documentType: "Travel Policy",
      actorId: actor.id,
    });
    if (requirement) await workflows.updateTravelRequirement(requirement.id, "Received");
    await recordActivity({
      scopeType: "client",
      scopeId: travel.clientId,
      activityType: "document.uploaded",
      summary: `Travel policy uploaded — ${travel.referenceNo ?? "travel request"}`,
      actorId: actor.id,
    });
    revalidatePath("/travel");
    revalidatePath(`/clients/${travel.clientId}`);
    revalidatePath("/documents");
    return { ok: true, data: { documentId: doc.id, document: doc, requirementId: requirement?.id ?? null } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn’t record the travel policy." };
  }
}

/** Attach the carrier's completed application copy after TravelSafe issues the policy. */
export async function recordTravelApplicationCopyAction(
  travelRequestId: string,
  path: string,
  fileName: string,
): Promise<ActionResult<DocumentRecord>> {
  try {
    const actor = await requireTravelPackStaff();
    const travel = await getTravelRepository().findById(travelRequestId);
    if (!travel) return { ok: false, error: "Travel request not found." };
    const doc = await registerUploadedPdf({
      path,
      name: `Travel application copy — ${travel.referenceNo ?? travelRequestId.slice(0, 8)} (${fileName})`,
      clientId: travel.clientId,
      travelRequestId,
      documentType: "Travel Application Copy",
      actorId: actor.id,
    });
    await recordActivity({
      scopeType: "client",
      scopeId: travel.clientId,
      activityType: "document.uploaded",
      summary: `Travel application copy uploaded — ${travel.referenceNo ?? "travel request"}`,
      actorId: actor.id,
    });
    revalidatePath("/travel");
    revalidatePath(`/clients/${travel.clientId}`);
    revalidatePath("/documents");
    return { ok: true, data: doc };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn’t record the travel application copy." };
  }
}

export async function updateTravelRequirementAction(travelRequestId: string, requirementId: string, status: TravelRequirementRecord["status"]): Promise<ActionResult<null>> {
  await getActor();
  try {
    await assertRecordAccess("travel", travelRequestId);
    const workflows = getCarrierWorkflowsRepository();
    const belongs = (await workflows.listTravelRequirements(travelRequestId)).some((item) => item.id === requirementId);
    if (!belongs) return { ok: false, error: "Travel requirement not found." };
    await workflows.updateTravelRequirement(requirementId, status);
    revalidatePath("/travel");
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update Travel requirement." };
  }
}

export async function listTravelReferenceCandidatesAction(
  travelRequestId: string,
  options?: { search?: string; offset?: number },
): Promise<ActionResult<TravelReferenceCandidatePage>> {
  try {
    const actor = await requireTravelPackStaff();
    const id = referenceId(travelRequestId, "Travel request not found.");
    const search = typeof options?.search === "string" ? options.search.trim() : "";
    const offset = options?.offset ?? 0;
    if (search.length > 200 || !Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_600)
      throw new TravelReferenceInputError("Choose a valid search or page.");
    return { ok: true, data: await getTravelRepository().listReferenceCandidates(actor.id, id, search, offset) };
  } catch (error) {
    return { ok: false, error: referenceActionError(error, "Email attachments could not be loaded. Retry to check available files.") };
  }
}

/**
 * Links an existing Inbox attachment part to one reference slot. Nothing is uploaded or copied,
 * and no checklist, payment, policy number or portal status changes.
 */
export async function recordTravelReferenceAttachmentAction(input: {
  travelRequestId: string;
  slot: TravelPackReferenceKey;
  messageId: string;
  partId: string;
  confirmClientLevel: boolean;
}): Promise<ActionResult<TravelReferenceAttachment[]>> {
  try {
    const actor = await requireTravelPackStaff();
    const travelRequestId = referenceId(input?.travelRequestId, "Travel request not found.");
    const messageId = referenceId(input?.messageId, "Choose a valid email attachment.");
    const slot = referenceSlot(input?.slot);
    if (typeof input.partId !== "string" || input.partId.length > 255 || !PART_ID.test(input.partId) || typeof input.confirmClientLevel !== "boolean")
      throw new TravelReferenceInputError("Choose a valid email attachment.");
    // Prove the actual original can be retrieved (stored copy first, otherwise Gmail) before
    // recording a link to it. The bytes are not stored again.
    try {
      await getRequirementAttachmentOriginal(messageId, input.partId);
    } catch (error) {
      return { ok: false, error: error instanceof InboxReviewError ? error.message : "The original attachment could not be retrieved. Check the Gmail connection and retry; the current reference is unchanged." };
    }
    const repository = getTravelRepository();
    await repository.setReferenceAttachment(actor.id, { travelRequestId, slot, messageId, partId: input.partId, confirmClientLevel: input.confirmClientLevel });
    const travel = await repository.findById(travelRequestId);
    revalidatePath("/travel");
    if (travel) revalidatePath(`/clients/${travel.clientId}`);
    return { ok: true, data: await repository.listReferenceAttachments(actor.id, travelRequestId) };
  } catch (error) {
    return { ok: false, error: referenceActionError(error, "The Travel reference could not be saved. Refresh the workflow and try again.") };
  }
}

/** Removes only the association; the email, its original and the checklist are untouched. */
export async function unlinkTravelReferenceAttachmentAction(travelRequestId: string, slot: TravelPackReferenceKey): Promise<ActionResult<TravelReferenceAttachment[]>> {
  try {
    const actor = await requireTravelPackStaff();
    const id = referenceId(travelRequestId, "Travel request not found.");
    const repository = getTravelRepository();
    await repository.unlinkReferenceAttachment(actor.id, id, referenceSlot(slot));
    const travel = await repository.findById(id);
    revalidatePath("/travel");
    if (travel) revalidatePath(`/clients/${travel.clientId}`);
    return { ok: true, data: await repository.listReferenceAttachments(actor.id, id) };
  } catch (error) {
    return { ok: false, error: referenceActionError(error, "The Travel reference could not be unlinked. Refresh the workflow and try again.") };
  }
}
