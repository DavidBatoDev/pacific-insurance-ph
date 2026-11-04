"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { registerUploadedPdf } from "@/lib/documents/uploaded-pdf";
import {
  getTravelRepository,
  type NewTravelRequest,
  type TravelRequest,
  type TravelRequestUpdate,
} from "@/lib/repositories/travel";
import { getCarrierWorkflowsRepository, type TravelerRecord, type TravelRequirementRecord } from "@/lib/repositories/carrier-workflows";
import { getDocumentLibraryRepository } from "@/lib/repositories/document-library";
import { getDocumentsRepository, type DocumentRecord } from "@/lib/repositories/documents";
import { getPaymentsRepository, type Payment } from "@/lib/repositories/payments";
import { getIntegrationSettingsRepository } from "@/lib/repositories/integration-settings";
import { resolveTravelPackReferences, type ResolvedTravelPackReference } from "@/lib/travel/post-issuance-pack";
import type { Json } from "@/lib/supabase/types";

/** New Travel Quote (modals.md §7) — creates a per-trip travel request. */
export async function createTravelQuoteAction(
  input: NewTravelRequest,
): Promise<ActionResult<TravelRequest>> {
  const actor = await getActor();
  if (!input.clientId) return { ok: false, error: "A traveler is required." };
  if (!input.destination?.trim()) return { ok: false, error: "Destination is required." };

  try {
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
  portalUrl: string | null;
}

export async function getTravelWorkflowAction(id: string): Promise<ActionResult<TravelWorkflowPayload>> {
  await getActor();
  try {
    const travel = await getTravelRepository().findById(id);
    if (!travel) return { ok: false, error: "Travel request not found." };
    const workflows = getCarrierWorkflowsRepository();
    const today = new Date().toISOString().slice(0, 10);
    const [travelers, requirements, payments, documents, libraryDocuments, portal] = await Promise.all([
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

/** Attach the policy PDF the Travel portal issued (uploaded to Storage by the browser). */
export async function recordTravelPolicyAction(
  travelRequestId: string,
  path: string,
  fileName: string,
): Promise<ActionResult<{ documentId: string; document: DocumentRecord; requirementId: string | null }>> {
  const actor = await getActor();
  try {
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
  const actor = await getActor();
  try {
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
