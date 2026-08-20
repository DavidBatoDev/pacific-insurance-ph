"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { logOutboundEmail } from "@/lib/communications/log-outbound-email";
import { getApplicationRequirementsRepository, type ApplicationRequirement, type ApplicationRequirementStatus, type RequirementPhase } from "@/lib/repositories/application-requirements";
import { getApplicationsRepository, type Application } from "@/lib/repositories/applications";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getCarrierWorkflowsRepository, type CarrierFormAssignmentRecord } from "@/lib/repositories/carrier-workflows";
import { getTemplatesRepository } from "@/lib/repositories/templates";
import { fillTemplate, pesoMerge } from "@/lib/templates/merge";

export interface ApplicationRequirementsPayload {
  application: Application;
  clientName: string;
  clientEmail: string | null;
  requirements: ApplicationRequirement[];
  carrierForms: CarrierFormAssignmentRecord[];
}

const refresh = (clientId: string) => {
  revalidatePath("/applications");
  revalidatePath(`/clients/${clientId}`);
};

export async function getApplicationRequirementsAction(applicationId: string): Promise<ActionResult<ApplicationRequirementsPayload>> {
  await getActor();
  try {
    const application = await getApplicationsRepository().findById(applicationId);
    if (!application || application.status === "Lead") return { ok: false, error: "This application does not have a persisted requirements checklist." };
    const client = await getClientsRepository().findById(application.clientId);
    if (!client) return { ok: false, error: "The linked contact could not be found." };
    const [requirements, carrierForms] = await Promise.all([
      getApplicationRequirementsRepository().listByApplication(applicationId),
      getCarrierWorkflowsRepository().listApplicationCarrierForms(applicationId),
    ]);
    return { ok: true, data: { application, clientName: client.fullName, clientEmail: client.email, requirements, carrierForms } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to load application requirements." };
  }
}

export async function updateApplicationRequirementStatusAction(
  applicationId: string,
  requirementId: string,
  status: ApplicationRequirementStatus,
): Promise<ActionResult<ApplicationRequirement>> {
  const actor = await getActor();
  try {
    const application = await getApplicationsRepository().findById(applicationId);
    if (!application || application.status === "Lead") return { ok: false, error: "This application is not available." };
    const repo = getApplicationRequirementsRepository();
    const current = (await repo.listByApplication(applicationId)).find((item) => item.id === requirementId);
    if (!current) return { ok: false, error: "That requirement does not belong to this application." };
    const updated = await repo.updateStatus(requirementId, status);
    await recordActivity({
      scopeType: "client", scopeId: application.clientId, actorId: actor.id,
      activityType: "application.requirement_updated",
      summary: `${updated.documentName} marked ${updated.status} for ${application.referenceNo ?? "application"}`,
    });
    await recordAudit({
      actorId: actor.id, action: "update_status", tableName: "application_requirements", recordId: updated.id,
      previousValue: { status: current.status }, newValue: { status: updated.status },
    });
    refresh(application.clientId);
    return { ok: true, data: updated };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update the requirement." };
  }
}

export async function updateApplicationRequirementRequiredAction(
  applicationId: string,
  requirementId: string,
  isRequired: boolean,
): Promise<ActionResult<ApplicationRequirement>> {
  const actor = await getActor();
  try {
    const application = await getApplicationsRepository().findById(applicationId);
    if (!application || application.status === "Lead") return { ok: false, error: "This application is not available." };
    const repo = getApplicationRequirementsRepository();
    const current = (await repo.listByApplication(applicationId)).find((item) => item.id === requirementId);
    if (!current) return { ok: false, error: "That requirement does not belong to this application." };
    const updated = await repo.updateRequired(requirementId, isRequired);
    await recordAudit({
      actorId: actor.id, action: "update_required", tableName: "application_requirements", recordId: updated.id,
      previousValue: { is_required: current.isRequired }, newValue: { is_required: updated.isRequired },
    });
    refresh(application.clientId);
    return { ok: true, data: updated };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update the requirement." };
  }
}

/**
 * Flip a whole requirement gate to required.
 *
 * BC Flexi's list is two sequential gates: four documents to get a proposal, then thirteen more
 * once the group accepts it. The second gate is snapshotted `isRequired: false` so it is visible as
 * forthcoming without inflating the outstanding count or landing in the client's missing-documents
 * email. This is what staff call when the group actually agrees (G9).
 *
 * Idempotent: re-running simply sets already-required rows to required again.
 */
export async function activateRequirementPhaseAction(
  applicationId: string,
  phase: RequirementPhase,
): Promise<ActionResult<{ activated: number }>> {
  const actor = await getActor();
  try {
    const application = await getApplicationsRepository().findById(applicationId);
    if (!application || application.status === "Lead") return { ok: false, error: "This application is not available." };
    const updated = await getApplicationRequirementsRepository().activatePhase(applicationId, phase);
    await recordAudit({
      actorId: actor.id, action: "activate_phase", tableName: "application_requirements", recordId: applicationId,
      previousValue: { phase, is_required: false }, newValue: { phase, is_required: true, count: updated.length },
    });
    refresh(application.clientId);
    return { ok: true, data: { activated: updated.length } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not activate that requirement phase." };
  }
}

export async function requestMissingDocumentsAction(applicationId: string): Promise<ActionResult<{ outstanding: number }>> {
  const actor = await getActor();
  try {
    const application = await getApplicationsRepository().findById(applicationId);
    if (!application || application.status === "Lead") return { ok: false, error: "This application is not available." };
    const client = await getClientsRepository().findById(application.clientId);
    if (!client?.email) return { ok: false, error: "Add the contact’s email address before logging a document follow-up." };
    const requirements = await getApplicationRequirementsRepository().listByApplication(application.id);
    const missing = requirements.filter((item) => item.isRequired && (item.status === "Pending" || item.status === "Incomplete"));
    if (!missing.length) return { ok: false, error: "There are no outstanding required documents to request." };

    const template = await getTemplatesRepository().findByName("Request missing documents");
    if (!template) return { ok: false, error: "The Request missing documents email template is unavailable." };
    const list = missing.map((item) => `- ${item.documentName}${item.status === "Incomplete" ? " (incomplete)" : ""}`).join("\n");
    const merged = fillTemplate(template.body, {
      first_name: client.firstName,
      product: application.productName ?? client.productInterest,
      premium: pesoMerge(client.estPremium),
      agent: actor.fullName,
    });
    const body = merged.includes("- (documents will be listed here)")
      ? merged.replace("- (documents will be listed here)", list)
      : `${merged.trim()}\n\nOutstanding documents:\n${list}`;
    const subject = fillTemplate(template.subject, { first_name: client.firstName, product: application.productName ?? client.productInterest, agent: actor.fullName });
    const communicationId = await logOutboundEmail({
      clientId: client.id, applicationId: application.id, actorId: actor.id,
      subject, summary: `Request for ${missing.length} outstanding document${missing.length === 1 ? "" : "s"}`,
      notes: body,
    });
    await recordActivity({
      scopeType: "client", scopeId: client.id, actorId: actor.id,
      activityType: "application.documents_requested",
      summary: `Requested ${missing.length} missing document${missing.length === 1 ? "" : "s"} for ${application.referenceNo ?? "application"} (logged, not delivered)`,
    });
    await recordAudit({
      actorId: actor.id, action: "request_missing_documents", tableName: "communications", recordId: communicationId,
      newValue: { application_id: application.id, requirement_ids: missing.map((item) => item.id) },
    });
    refresh(client.id);
    return { ok: true, data: { outstanding: missing.length } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to log the document follow-up." };
  }
}
