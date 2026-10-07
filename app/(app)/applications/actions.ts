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
import { getPaymentsRepository, type Payment } from "@/lib/repositories/payments";
import { getPoliciesRepository, type Policy } from "@/lib/repositories/policies";
import { registerUploadedPdf } from "@/lib/documents/uploaded-pdf";
import { getDocumentsRepository, type DocumentRecord } from "@/lib/repositories/documents";
import { getPaymentChannelsRepository } from "@/lib/repositories/payment-channels";
import type { SubmissionRecord } from "@/lib/submissions/submission-email";
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
  /** The latest "billing sent to client" email, if Eman has logged one. */
  billingSent: SubmissionRecord | null;
  /** Active payment channels, for the billing message to the client. */
  paymentChannels: string[];
}

/** Summary prefixes that let the workflow find its own logged communications again. */
const REPLY_PREFIX = "Pacific Cross reply";
const BILLING_PREFIX = "Billing sent to client";
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
  await getActor();
  try {
    const application = await getApplicationsRepository().findById(applicationId);
    if (!application || application.status === "Lead") return { ok: false, error: "This application does not have a persisted requirements checklist." };
    const client = await getClientsRepository().findById(application.clientId);
    if (!client) return { ok: false, error: "The linked contact could not be found." };
    const [requirements, carrierForms, submissions, payments, policy, proposal, replies, billing, channels] = await Promise.all([
      getApplicationRequirementsRepository().listByApplication(applicationId),
      getCarrierWorkflowsRepository().listApplicationCarrierForms(applicationId),
      listSubmissionRecords("application", applicationId),
      getPaymentsRepository().listByApplication(applicationId),
      application.policyId ? getPoliciesRepository().findById(application.policyId) : Promise.resolve(null),
      currentProposal(application.clientId),
      listCommunicationRecords({ kind: "application", id: applicationId, summaryPrefix: REPLY_PREFIX, direction: "Inbound" }),
      listCommunicationRecords({ kind: "application", id: applicationId, summaryPrefix: BILLING_PREFIX, direction: "Outbound" }),
      getPaymentChannelsRepository().list(),
    ]);
    return {
      ok: true,
      data: {
        application, clientName: client.fullName, clientEmail: client.email, requirements, carrierForms,
        submissions, payment: payments.at(-1) ?? null, policy,
        proposal: proposal && { id: proposal.id, name: proposal.name, uploadedAt: proposal.uploadedAt },
        replies, billingSent: billing[0] ?? null,
        paymentChannels: channels.filter((channel) => channel.active).map((channel) => `${channel.label} — ${channel.accountNumber}`),
      },
    };
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
        applicationId, documentName: name, isRequired: true, status: "Pending" as const,
        appliesTo: "Requested by Pacific Cross", sortOrder: nextOrder + index * 10,
      })));
      touched.push(...created.map((item) => item.id));
    }

    const submission = (await listSubmissionRecords("application", applicationId))[0];
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
    const docs = getDocumentsRepository();
    const previous = (await docs.listByClient(application.clientId)).filter((doc) => doc.documentType === PROPOSAL_TYPE && doc.status !== "Replaced");
    const doc = await registerUploadedPdf({
      path: pdf.path,
      name: `Illustrative proposal — ${application.productName ?? "Pacific Cross"} (${pdf.fileName})`,
      clientId: application.clientId,
      applicationId,
      documentType: PROPOSAL_TYPE,
      actorId: actor.id,
    });
    for (const old of previous) {
      await docs.update(old.id, { status: "Replaced" });
      await recordAudit({
        actorId: actor.id, action: "update", tableName: "documents", recordId: old.id,
        previousValue: { status: old.status }, newValue: { status: "Replaced", replacedBy: doc.id },
      });
    }
    await recordActivity({
      scopeType: "client", scopeId: application.clientId, actorId: actor.id,
      activityType: "application.proposal_received",
      summary: `Illustrative proposal (final billing) received for ${application.referenceNo ?? "application"}`,
    });
    refresh(application.clientId);
    revalidatePath("/documents");
    return { ok: true, data: { id: doc.id, name: doc.name } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn’t file the proposal." };
  }
}

/** Payment step: records that the billing and payment channels went to the client (R1 — logged only). */
export async function logBillingSentAction(
  applicationId: string,
  input: { subject: string; body: string },
): Promise<ActionResult<null>> {
  const actor = await getActor();
  try {
    const subject = input.subject.trim();
    const body = input.body.trim();
    if (!subject || !body) return { ok: false, error: "Add a subject and a message first." };
    const application = await getApplicationsRepository().findById(applicationId);
    if (!application || application.status === "Lead") return { ok: false, error: "This application is not available." };
    const payment = (await getPaymentsRepository().listByApplication(applicationId)).at(-1);
    if (!payment) return { ok: false, error: "Record the billed amount first." };
    const amount = payment.amount != null ? "₱" + payment.amount.toLocaleString("en-PH") : "the billed premium";
    const communicationId = await logOutboundEmail({
      clientId: application.clientId, applicationId, actorId: actor.id,
      subject, summary: `${BILLING_PREFIX} — ${amount}`, notes: body,
    });
    await recordActivity({
      scopeType: "client", scopeId: application.clientId, actorId: actor.id,
      activityType: "payment.instruction_logged",
      summary: `Billing (${amount}) and payment channels sent for ${application.referenceNo ?? "application"} (logged, not delivered)`,
    });
    await recordAudit({
      actorId: actor.id, action: "log_billing_sent", tableName: "communications", recordId: communicationId,
      newValue: { application_id: applicationId, payment_id: payment.id },
    });
    refresh(application.clientId);
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to log the billing email." };
  }
}
