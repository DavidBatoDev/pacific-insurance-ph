"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toAppRole } from "@/lib/auth/permissions";
import { medicalReviewRequired, type ApplicationMedicalReview } from "@/lib/applications/medical-review";
import { isMedicalQuestionnaireName, requirementSection } from "@/lib/applications/requirement-sections";
import { RepositoryError } from "@/lib/repositories/types";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { BILLING_SUMMARY_PREFIX, outboundEmailErrorMessage, requireEmailSender } from "@/lib/communications/outbound-email";
import type { EmailDraftSeed } from "@/lib/communications/outbound-email.types";
import { getApplicationRequirementsRepository, type ApplicationRequirement, type ApplicationRequirementStatus, type RequirementPhase } from "@/lib/repositories/application-requirements";
import { getApplicationsRepository, type Application } from "@/lib/repositories/applications";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getCarrierWorkflowsRepository, type CarrierFormAssignmentRecord } from "@/lib/repositories/carrier-workflows";
import { getTemplatesRepository } from "@/lib/repositories/templates";
import { getPaymentsRepository, type Payment } from "@/lib/repositories/payments";
import { getPoliciesRepository, type Policy } from "@/lib/repositories/policies";
import { registerUploadedProposalReceipt } from "@/lib/documents/uploaded-pdf";
import { getDocumentsRepository, type DocumentRecord } from "@/lib/repositories/documents";
import { getPaymentChannelsRepository } from "@/lib/repositories/payment-channels";
import { countsAsCompleted, type SubmissionRecord } from "@/lib/submissions/submission-email";
import { listCommunicationRecords, listSubmissionRecords } from "@/lib/submissions/submission-files";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fillTemplate, pesoMerge } from "@/lib/templates/merge";

export interface ApplicationRequirementsPayload {
  application: Application;
  clientName: string;
  clientEmail: string | null;
  requirements: ApplicationRequirement[];
  carrierForms: CarrierFormAssignmentRecord[];
  /** Emails logged to Pacific Cross for this application, newest first. */
  submissions: SubmissionRecord[];
  /** The application's latest payment request, if one has been created. */
  payment: Payment | null;
  /** The policy logged from this application, once it exists. */
  policy: Policy | null;
  /** Pacific Cross's current illustrative proposal (the final billing) — lead-stage or later. */
  proposal: Pick<DocumentRecord, "id" | "name" | "uploadedAt"> | null;
  /** Replies from Pacific Cross logged against this application, newest first. */
  replies: SubmissionRecord[];
  /** The latest billing email Gmail accepted (delivery_status 'sent') — the only proof the billing went out. */
  billingSent: SubmissionRecord | null;
  /** Every billing email recorded for the application, any outcome (incl. historical log-only rows), newest first. */
  billingHistory: SubmissionRecord[];
  /** Active payment channels, for the billing message to the client. */
  paymentChannels: string[];
  medicalReview: ApplicationMedicalReview;
  medicalReviewDocuments: Pick<DocumentRecord, "id" | "applicationRequirementId" | "name" | "filePath" | "status">[];
}

/** Summary prefixes that let the workflow find its own communications again (never proof of sending). */
const REPLY_PREFIX = "Pacific Cross reply";
const PROPOSAL_TYPE = "Illustrative Proposal";

/** The client's current illustrative proposal: the newest one not marked Replaced. */
async function currentProposal(clientId: string) {
  const docs = (await getDocumentsRepository().listByClient(clientId))
    .filter((doc) => doc.documentType === PROPOSAL_TYPE && doc.status !== "Replaced" && doc.filePath)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  return docs[0] ?? null;
}

const refresh = (clientId: string) => {
  revalidatePath("/applications");
  revalidatePath(`/clients/${clientId}`);
};

export async function getApplicationRequirementsAction(applicationId: string): Promise<ActionResult<ApplicationRequirementsPayload>> {
  const actor = await getCurrentUser();
  if (!actor || actor.status !== "Active") return { ok: false, error: "An active account is required." };
  try {
    const application = await getApplicationsRepository().findById(applicationId);
    if (!application) return { ok: false, error: "This application is not available." };
    const client = await getClientsRepository().findById(application.clientId);
    if (!client || (toAppRole(actor.role) === "agent" && client.assignedUserId !== actor.id)) {
      return { ok: false, error: "This application is not available." };
    }
    if (application.status === "Lead") return { ok: false, error: "This application does not have a persisted requirements checklist." };
    const [requirements, carrierForms, submissions, payments, policy, proposal, replies, billing, channels, dependents, documents] = await Promise.all([
      getApplicationRequirementsRepository().listByApplication(applicationId),
      getCarrierWorkflowsRepository().listApplicationCarrierForms(applicationId),
      listSubmissionRecords("application", applicationId),
      getPaymentsRepository().listByApplication(applicationId),
      application.policyId ? getPoliciesRepository().findById(application.policyId) : Promise.resolve(null),
      currentProposal(application.clientId),
      listCommunicationRecords({ kind: "application", id: applicationId, summaryPrefix: REPLY_PREFIX, direction: "Inbound" }),
      listCommunicationRecords({ kind: "application", id: applicationId, summaryPrefix: BILLING_SUMMARY_PREFIX, direction: "Outbound" }),
      getPaymentChannelsRepository().list(),
      getCarrierWorkflowsRepository().listApplicationDependents(applicationId),
      getDocumentsRepository().listByClient(application.clientId),
    ]);
    const medicalRequirements = requirements.filter((item) => requirementSection(item) === "Medical requirements");
    const medicalIds = new Set(medicalRequirements.map((item) => item.id));
    const medicalReviewDocuments = documents.filter((doc) => doc.applicationId === applicationId
      && doc.applicationRequirementId !== null && medicalIds.has(doc.applicationRequirementId))
      .map(({ id, applicationRequirementId, name, filePath, status }) => ({ id, applicationRequirementId, name, filePath, status }));
    const hasOriginal = (id: string) => medicalReviewDocuments.some((doc) => doc.applicationRequirementId === id
      && Boolean(doc.filePath?.trim()) && !["Draft", "Archived", "Replaced"].includes(doc.status));
    const required = medicalReviewRequired({
      productName: application.productName, principalPreExistingStatus: application.preExistingStatus, dependents,
    });
    const subjects: ApplicationMedicalReview["subjects"] = required ? [
      ...(application.preExistingStatus === "Yes" ? [{ key: "principal", name: client.fullName, medicalNotes: application.medicalNotes }] : []),
      ...dependents.filter((person) => person.preExistingStatus === "Yes")
        .map((person) => ({ key: `dependent:${person.id}`, name: person.fullName, medicalNotes: person.medicalNotes })),
    ].map((subject) => {
      const candidates = medicalRequirements.filter((item) => isMedicalQuestionnaireName(item.documentName) && item.medicalReviewSubject === subject.key);
      return { ...subject, questionnaireRequirementId: candidates.length === 1 ? candidates[0].id : null };
    }) : [];
    const blockers = required ? [
      ...medicalRequirements.filter((item) => (item.isRequired || subjects.some((subject) => subject.questionnaireRequirementId === item.id))
        && (item.status !== "Verified" || !hasOriginal(item.id)))
        .map((item) => `${item.documentName}${item.appliesTo ? ` — ${item.appliesTo}` : ""}: verify the checklist item and link its original document.`),
      ...subjects.filter((subject) => !subject.questionnaireRequirementId)
        .map((subject) => `${subject.name}: associate the correct existing medical questionnaire or supporting records item.`),
    ] : [];
    const medicalReview: ApplicationMedicalReview = {
      status: application.medicalReviewStatus, subjects, medicalClass: application.medicalClass,
      clearedAt: application.medicalReviewClearedAt, clearedBy: application.medicalReviewClearedBy,
      canClear: ["Owner", "Admin", "Assistant"].includes(actor.role), blockers,
    };
    return {
      ok: true,
      data: {
        application, clientName: client.fullName, clientEmail: client.email, requirements, carrierForms,
        medicalReview, medicalReviewDocuments,
        submissions, payment: payments.at(-1) ?? null, policy,
        proposal: proposal && { id: proposal.id, name: proposal.name, uploadedAt: proposal.uploadedAt },
        replies, billingSent: billing.find((record) => record.deliveryStatus === "sent") ?? null, billingHistory: billing,
        paymentChannels: channels.filter((channel) => channel.active).map((channel) => `${channel.label} — ${channel.accountNumber}`),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to load application requirements." };
  }
}

const MEDICAL_REVIEW_ERRORS: Record<string, string> = {
  medical_review_forbidden: "Only active Admin and Staff accounts can clear medical review.",
  medical_review_unavailable: "This application is not available for medical review.",
  medical_review_not_required: "Medical review is not required for this application.",
  medical_review_stale: "This application changed. Reload it before clearing medical review.",
  medical_review_class_invalid: "Enter a medical class assessment of 1–500 characters.",
  medical_review_mapping_invalid: "Associate a distinct existing medical questionnaire or supporting records item with each affected insured.",
  medical_review_originals_required: "Every required medical item and selected questionnaire must be Verified with a linked original document.",
};

/** Adds only a Pending checklist row; an original and staff verification remain mandatory. */
export async function addApplicationMedicalQuestionnaireAction(
  applicationId: string,
  subjectKey: string,
): Promise<ActionResult<ApplicationRequirementsPayload>> {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.status !== "Active" || !["Owner", "Admin", "Assistant"].includes(actor.role)) {
      return { ok: false, error: MEDICAL_REVIEW_ERRORS.medical_review_forbidden };
    }
    if (typeof subjectKey !== "string" || !/^(principal|dependent:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(subjectKey)) {
      return { ok: false, error: MEDICAL_REVIEW_ERRORS.medical_review_mapping_invalid };
    }
    const application = await getApplicationsRepository().addMedicalQuestionnaire(applicationId, { actorId: actor.id, subjectKey });
    refresh(application.clientId);
    return getApplicationRequirementsAction(applicationId);
  } catch (error) {
    return { ok: false, error: error instanceof RepositoryError && error.code && MEDICAL_REVIEW_ERRORS[error.code]
      ? MEDICAL_REVIEW_ERRORS[error.code] : "The questionnaire checklist item could not be added. Reload and try again." };
  }
}

export async function clearApplicationMedicalReviewAction(
  applicationId: string,
  input: { medicalClass: string; expectedUpdatedAt: string; questionnaireRequirements: Record<string, string> },
): Promise<ActionResult<ApplicationRequirementsPayload>> {
  try {
    const actor = await getCurrentUser();
    if (!actor || actor.status !== "Active" || !["Owner", "Admin", "Assistant"].includes(actor.role)) {
      return { ok: false, error: MEDICAL_REVIEW_ERRORS.medical_review_forbidden };
    }
    if (typeof input?.medicalClass !== "string" || !input.medicalClass.trim() || input.medicalClass.trim().length > 500) {
      return { ok: false, error: MEDICAL_REVIEW_ERRORS.medical_review_class_invalid };
    }
    if (typeof input.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(input.expectedUpdatedAt))) {
      return { ok: false, error: MEDICAL_REVIEW_ERRORS.medical_review_stale };
    }
    const mapping = input.questionnaireRequirements;
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)
      || Object.entries(mapping).some(([key, value]) => !/^(principal|dependent:[0-9a-f-]{36})$/i.test(key)
        || typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))) {
      return { ok: false, error: MEDICAL_REVIEW_ERRORS.medical_review_mapping_invalid };
    }
    const application = await getApplicationsRepository().clearMedicalReview(applicationId, {
      actorId: actor.id, medicalClass: input.medicalClass.trim(),
      expectedUpdatedAt: input.expectedUpdatedAt, questionnaireRequirements: mapping,
    });
    refresh(application.clientId);
    return getApplicationRequirementsAction(applicationId);
  } catch (error) {
    return { ok: false, error: error instanceof RepositoryError && error.code && MEDICAL_REVIEW_ERRORS[error.code]
      ? MEDICAL_REVIEW_ERRORS[error.code] : "The medical review could not be saved. Reload and try again." };
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

/** A reviewable missing-documents email for one application, plus the client its attachments come from. */
export interface MissingDocumentsDraft {
  clientId: string;
  outstanding: number;
  draft: EmailDraftSeed;
}

/**
 * Builds the "Request missing documents" email listing the required checklist rows still Pending
 * or Incomplete. Nothing is sent or recorded here: staff review it and send it through Gmail, and
 * the documents-requested activity is written only once Gmail accepts it.
 */
export async function getMissingDocumentsDraftAction(applicationId: string): Promise<ActionResult<MissingDocumentsDraft>> {
  try {
    const actor = await requireEmailSender();
    const application = await getApplicationsRepository().findById(applicationId);
    if (!application || application.status === "Lead") return { ok: false, error: "This application is not available." };
    const client = await getClientsRepository().findById(application.clientId);
    if (!client) return { ok: false, error: "The linked contact could not be found." };
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
    return {
      ok: true,
      data: {
        clientId: client.id,
        outstanding: missing.length,
        draft: {
          origin: { type: "application_missing", id: application.id },
          recipient: client.email ?? "",
          subject,
          body,
          templateName: template.name,
          documentIds: [],
          emailAttachments: [],
        },
      },
    };
  } catch (error) {
    return { ok: false, error: outboundEmailErrorMessage(error) };
  }
}

/** Statuses an application can hold once it has gone to Pacific Cross. */
const SUBMITTED_OR_LATER = new Set(["Submitted to Pacific Cross", "Awaiting Payment", "Approved"]);

/**
 * Payment step of the application workflow: records the premium Pacific Cross billed as an
 * Awaiting payment (so it joins the Payments queue and payment links) and moves the application to
 * Awaiting Payment. Re-saving while still Awaiting corrects the amount instead of adding a row.
 */
export async function createApplicationPaymentAction(
  applicationId: string,
  input: { amount: number },
): Promise<ActionResult<Payment>> {
  const actor = await getActor();
  try {
    if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, error: "Enter the premium Pacific Cross billed." };
    const application = await getApplicationsRepository().findById(applicationId);
    if (!application) return { ok: false, error: "This application is not available." };
    if (!SUBMITTED_OR_LATER.has(application.status) && !application.dateSubmitted) {
      return { ok: false, error: "Submit the application to Pacific Cross first." };
    }
    const payments = getPaymentsRepository();
    const existing = (await payments.listByApplication(applicationId)).at(-1);
    if (existing && existing.status !== "Awaiting" && existing.status !== "Overdue") {
      return { ok: false, error: `This application already has a ${existing.status.toLowerCase()} payment.` };
    }
    const payment = existing
      ? await payments.update(existing.id, { amount: input.amount })
      : await payments.create({ clientId: application.clientId, applicationId, amount: input.amount, status: "Awaiting", notes: "Premium billed by Pacific Cross" });
    if (application.status !== "Awaiting Payment") await getApplicationsRepository().update(applicationId, { status: "Awaiting Payment" });

    const amount = "₱" + input.amount.toLocaleString("en-PH");
    await recordActivity({
      scopeType: "client", scopeId: application.clientId, actorId: actor.id,
      activityType: existing ? "payment.updated" : "payment.requested",
      summary: existing
        ? `Billed premium for ${application.referenceNo ?? "application"} corrected to ${amount}`
        : `Pacific Cross billed ${amount} for ${application.referenceNo ?? "application"} — awaiting payment`,
    });
    await recordAudit({
      actorId: actor.id, action: existing ? "update" : "create", tableName: "payments", recordId: payment.id,
      previousValue: existing ? { amount: existing.amount } : undefined,
      newValue: { amount: input.amount, application_id: applicationId, application_status: "Awaiting Payment" },
    });
    refresh(application.clientId);
    revalidatePath("/payments");
    return { ok: true, data: payment };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to create the payment request." };
  }
}

export type PacificCrossReplyKind = "Conforme to sign" | "More requirements" | "Note";
export type ConformeKind = "CAC" | "TAL";

/** Checklist rows the wizard already snapshots for health products (wizard-actions.ts). */
const CONFORME_ROWS: Record<ConformeKind, { match: string; name: string }> = {
  CAC: { match: "(CAC)", name: "Client Application for Coverage (CAC)" },
  TAL: { match: "(TAL)", name: "Treatment Area Limitation (TAL) conforme" },
};

/**
 * Pacific Cross reply step: records what came back after the submission (logged by Eman; the
 * CRM has no inbox). A conforme or extra underwriting requirement becomes a required, Pending
 * checklist row so the workflow waits on the client until it is in.
 */
export async function logPacificCrossReplyAction(
  applicationId: string,
  input: { kind: PacificCrossReplyKind; conformes?: ConformeKind[]; items?: string[]; note?: string; receivedDate?: string },
): Promise<ActionResult<{ added: number }>> {
  const actor = await getActor();
  try {
    const application = await getApplicationsRepository().findById(applicationId);
    if (!application || application.status === "Lead") return { ok: false, error: "This application is not available." };
    const conformes = [...new Set(input.conformes ?? [])].filter((kind) => kind in CONFORME_ROWS);
    const items = [...new Set((input.items ?? []).map((item) => item.trim()).filter(Boolean))];
    const note = input.note?.trim() ?? "";
    if (input.kind === "Conforme to sign" && !conformes.length) return { ok: false, error: "Pick which conforme Pacific Cross sent." };
    if (input.kind === "More requirements" && !items.length) return { ok: false, error: "List what Pacific Cross asked for." };
    if (input.kind === "Note" && !note) return { ok: false, error: "Add a note about the reply." };
    if (input.receivedDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.receivedDate)) return { ok: false, error: "Received must be a valid date." };

    const repo = getApplicationRequirementsRepository();
    const existing = await repo.listByApplication(applicationId);
    const touched: string[] = [];
    for (const kind of conformes) {
      const row = existing.find((item) => item.documentName.includes(CONFORME_ROWS[kind].match));
      if (row) {
        if (!row.isRequired) await repo.updateRequired(row.id, true);
        if (row.status !== "Pending") await repo.updateStatus(row.id, "Pending");
        touched.push(row.id);
      } else {
        items.unshift(CONFORME_ROWS[kind].name);
      }
    }
    if (items.length) {
      const nextOrder = Math.max(0, ...existing.map((item) => item.sortOrder)) + 10;
      const created = await repo.createMany(items.map((name, index) => ({
        applicationId, documentName: name, section: "Application documents" as const, isRequired: true, status: "Pending" as const,
        appliesTo: "Requested by Pacific Cross", sortOrder: nextOrder + index * 10,
      })));
      touched.push(...created.map((item) => item.id));
    }

    // Only a submission that reached Pacific Cross (or a historical log) identifies the replying contact.
    const submission = (await listSubmissionRecords("application", applicationId)).find(countsAsCompleted);
    const what = input.kind === "Conforme to sign" ? `${input.kind} (${conformes.join(", ")})` : input.kind === "More requirements" ? `${input.kind} (${items.length})` : input.kind;
    const body = [note, ...(input.kind === "More requirements" ? items.map((item) => `- ${item}`) : [])].filter(Boolean).join("\n") || null;
    const { data: communication, error } = await getSupabaseAdmin().from("communications").insert({
      client_id: application.clientId, application_id: applicationId, direction: "Inbound", channel: "Gmail",
      subject: `${REPLY_PREFIX} — ${input.kind}`, summary: `${REPLY_PREFIX} — ${what}`, notes: body,
      occurred_at: input.receivedDate ? `${input.receivedDate}T12:00:00+08:00` : new Date().toISOString(),
      related_user_id: actor.id, external_contact_id: submission?.contactId ?? null, delivery_status: "logged",
    }).select("id").single();
    if (error) throw new Error(error.message);

    if (touched.length) await getApplicationsRepository().update(applicationId, { status: "Pending Requirements" });
    await recordActivity({
      scopeType: "client", scopeId: application.clientId, actorId: actor.id,
      activityType: "application.pacific_cross_reply",
      summary: `${REPLY_PREFIX} on ${application.referenceNo ?? "application"} — ${what}`,
    });
    await recordAudit({
      actorId: actor.id, action: "log_reply", tableName: "communications", recordId: communication.id,
      newValue: { application_id: applicationId, kind: input.kind, requirement_ids: touched },
    });
    refresh(application.clientId);
    return { ok: true, data: { added: touched.length } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to log the reply." };
  }
}

/**
 * Files Pacific Cross's illustrative proposal (the final billing) against the application, when
 * it wasn't already recorded at the lead stage. Earlier proposals are marked Replaced, as on the lead.
 */
export async function recordApplicationProposalAction(
  applicationId: string,
  pdf: { path: string; fileName: string },
): Promise<ActionResult<{ id: string; name: string }>> {
  const actor = await getActor();
  try {
    const application = await getApplicationsRepository().findById(applicationId);
    if (!application || application.status === "Lead") return { ok: false, error: "This application is not available." };
    const doc = await registerUploadedProposalReceipt({
      storagePath: pdf.path,
      name: `Illustrative proposal — ${application.productName ?? "Pacific Cross"} (${pdf.fileName})`,
      clientId: application.clientId,
      targetKind: "application", targetId: applicationId,
      actorId: actor.id,
    });
    refresh(application.clientId);
    revalidatePath("/documents");
    return { ok: true, data: { id: doc.id, name: doc.name } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn’t file the proposal." };
  }
}
