"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getTasksRepository } from "@/lib/repositories/tasks";
import { getExternalContactsRepository, type ExternalContact } from "@/lib/repositories/external-contacts";
import type { Client } from "@/lib/repositories/clients";
import type { Json } from "@/lib/supabase/types";
import { can, toAppRole } from "@/lib/auth/permissions";
import { getDocumentLibraryRepository, type LibraryDocument } from "@/lib/repositories/document-library";
import { logOutboundEmail } from "@/lib/communications/log-outbound-email";
import { nextLeadStage } from "@/components/hub/lead-config";

/**
 * Engage composer mutations (contact-profile.md; human-in-the-loop). Emails,
 * inbound message logs, calls and notes become `communications` rows; status
 * flags and Request Proposal mutate the contact + create the follow-up task.
 * The contact timeline merges communications + activity_timeline.
 */

function refresh(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/prospects");
}

/** A status changes automatically; the suggested stage still requires consent. */
export interface LeadAdvanceSuggestion {
  clientId: string;
  name: string;
  referenceNo: string | null;
  currentStage: string | null;
  currentStatus: string | null;
  stage: string;
  status: string;
  label: string;
  /** What specifically triggered this — e.g. "Send brochure: Select Brochure", "Outcome: Reached". */
  detail?: string;
  /** ISO timestamp captured at write time by the same communication-driven callers. */
  occurredAt?: string;
  /** The status as it was immediately before this write — status changes automatically (unlike
   * stage), so by the time the popup opens `lead.status` already reflects the new value. */
  previousStatus?: string | null;
}

export interface EngagementResult {
  advance?: LeadAdvanceSuggestion;
}

async function updateLeadStatus(
  client: Client,
  actorId: string,
  nextStatus: string,
  summary: string,
  advance?: Pick<LeadAdvanceSuggestion, "stage" | "label" | "detail" | "occurredAt">,
): Promise<EngagementResult> {
  if (client.lifecycleStage !== "Lead" || client.leadStatus === nextStatus) return {};

  const updated = await getClientsRepository().update(client.id, { leadStatus: nextStatus });
  await recordActivity({
    scopeType: "client",
    scopeId: client.id,
    activityType: "lead.status_changed",
    summary: `${summary}: ${client.leadStatus ?? "—"} → ${nextStatus}`,
    actorId,
  });
  await recordAudit({
    actorId,
    action: "lead_status_updated",
    tableName: "clients",
    recordId: client.id,
    previousValue: client as unknown as Json,
    newValue: updated as unknown as Json,
  });

  return advance
    ? {
        advance: {
          clientId: client.id,
          name: client.fullName,
          referenceNo: client.referenceNo,
          currentStage: updated.leadStage,
          currentStatus: updated.leadStatus,
          previousStatus: client.leadStatus,
          stage: advance.stage,
          status: nextStatus,
          label: advance.label,
          detail: advance.detail,
          occurredAt: advance.occurredAt,
        },
      }
    : {};
}

export async function sendEmailAction(input: {
  clientId: string;
  recipient: string;
  subject: string;
  body: string;
  templateName?: string | null;
  externalContactId?: string | null;
  libraryDocumentIds?: string[];
}): Promise<ActionResult<EngagementResult>> {
  const actor = await getActor();
  if (!input.recipient.trim() || !input.subject.trim())
    return { ok: false, error: "Recipient and subject are required." };

  const client = await getClientsRepository().findById(input.clientId);
  if (!client) return { ok: false, error: "Contact not found." };
  const requirement = attachmentRequirement(input.templateName ?? null);
  const ids = [...new Set(input.libraryDocumentIds ?? [])];
  let attachmentName: string | null = null;
  if (requirement) {
    if (!can(toAppRole(actor.role), "documentLibrary", "view")) return { ok: false, error: "Carrier attachments are available to Admin and Staff only." };
    const eligible = await resolveEligibleLibraryDocuments(client, requirement);
    if (eligible.reason) return { ok: false, error: eligible.reason };
    if (ids.length !== 1 || !eligible.documents.some((doc) => doc.id === ids[0]))
      return { ok: false, error: `Choose the approved ${requirement.toLowerCase()} matched to this contact.` };
    attachmentName = eligible.documents.find((doc) => doc.id === ids[0])?.documentName ?? null;
  } else if (ids.length) return { ok: false, error: "This email template does not accept carrier-library attachments yet." };

  try {
    await logOutboundEmail({ clientId: input.clientId, subject: input.subject, summary: input.body.split("\n").find(Boolean) ?? "", notes: input.body, actorId: actor.id, externalContactId: input.externalContactId, libraryDocumentIds: ids });
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Failed to log email." }; }

  // First touch (docs/lead-stage-status.md): Eman's send sets Attempted, no Lead reply required yet.
  const detail = [input.templateName, attachmentName].filter(Boolean).join(": ");
  const result =
    client.leadStatus === "New"
      ? await updateLeadStatus(client, actor.id, "Attempted", "Email logged", {
          stage: nextLeadStage(client.leadStage) ?? "Contacted",
          label: "Email logged",
          detail: detail || undefined,
          occurredAt: new Date().toISOString(),
        })
      : {};
  refresh(input.clientId);
  return { ok: true, data: result };
}

type RequiredLibraryType = "Brochure" | "Application Form";
function attachmentRequirement(templateName: string | null): RequiredLibraryType | null {
  if (templateName === "Send brochure") return "Brochure";
  if (templateName === "Send application form") return "Application Form";
  return null;
}

function ageOn(dateOfBirth: string) {
  const today = new Date(); const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  if (today.getUTCMonth() < dob.getUTCMonth() || (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

async function resolveEligibleLibraryDocuments(client: Client, documentType: RequiredLibraryType): Promise<{ documents: LibraryDocument[]; reason: string | null }> {
  if (!client.productInterest?.trim()) return { documents: [], reason: "Set the contact’s product interest before selecting a carrier asset." };
  let ageBand: "All Ages" | "0-70" | "71-100" = "All Ages";
  if (documentType === "Application Form") {
    if (!client.dateOfBirth) return { documents: [], reason: "Add the contact’s date of birth before selecting an application form." };
    const age = ageOn(client.dateOfBirth);
    if (age < 0 || age > 100) return { documents: [], reason: "No supported application-form age band matches this contact." };
    ageBand = age <= 70 ? "0-70" : "71-100";
  }
  const documents = await getDocumentLibraryRepository().listEligible({ productName: client.productInterest, documentType, ageBand });
  return { documents, reason: documents.length ? null : `No active, approved ${documentType.toLowerCase()} matches ${client.productInterest}${documentType === "Application Form" ? ` · ${ageBand}` : ""}.` };
}

export async function listEligibleLibraryDocumentsAction(clientId: string, templateName: string): Promise<ActionResult<{ documents: LibraryDocument[]; reason: string | null }>> {
  try {
    const actor = await getActor();
    if (!can(toAppRole(actor.role), "documentLibrary", "view")) return { ok: false, error: "Carrier attachments are available to Admin and Staff only." };
    const requirement = attachmentRequirement(templateName);
    if (!requirement) return { ok: true, data: { documents: [], reason: null } };
    const client = await getClientsRepository().findById(clientId);
    if (!client) return { ok: false, error: "Contact not found." };
    return { ok: true, data: await resolveEligibleLibraryDocuments(client, requirement) };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Couldn’t load library assets." }; }
}

export async function logMessageAction(input: {
  clientId: string;
  channel: string;
  transcript: string;
  occurredAt?: string | null;
}): Promise<ActionResult<EngagementResult>> {
  const actor = await getActor();
  if (!input.transcript.trim()) return { ok: false, error: "Message transcript is required." };

  const client = await getClientsRepository().findById(input.clientId);
  if (!client) return { ok: false, error: "Contact not found." };

  const { error } = await getSupabaseAdmin().from("communications").insert({
    client_id: input.clientId,
    direction: "Inbound",
    channel: input.channel,
    subject: `${input.channel} message received`,
    summary: input.transcript.split("\n").find(Boolean) ?? "",
    notes: input.transcript,
    occurred_at: input.occurredAt || undefined,
    related_user_id: actor.id,
  });
  if (error) return { ok: false, error: error.message };

  const canSuggestAdvance = client.leadStage === "New Lead" || client.leadStage === "Contacted";
  const result =
    client.leadStatus === "New" || client.leadStatus === "Attempted"
      ? await updateLeadStatus(
          client,
          actor.id,
          "Connected",
          "Inbound message logged",
          canSuggestAdvance
            ? {
                stage: nextLeadStage(client.leadStage) ?? "Discovery",
                label: "Inbound response logged",
                detail: `Channel: ${input.channel}`,
                occurredAt: input.occurredAt || new Date().toISOString(),
              }
            : undefined,
        )
      : // Coming out of a nurture hold: the lead signalled they're ready. Discovery data is already
        // on file, so this returns straight to `Qualified` with no re-asking, and the stage never
        // moved — so there is nothing to suggest advancing (docs/lead-stage-status.md).
        client.leadStatus === "Nurturing"
        ? await updateLeadStatus(client, actor.id, "Qualified", "Re-engaged during nurture hold")
        : {};
  refresh(input.clientId);
  return { ok: true, data: result };
}

export async function logCallAction(input: {
  clientId: string;
  outcome: string;
  notes?: string | null;
  /** Structured discovery (Reached calls) — written onto the client record. */
  discovery?: {
    estPremium?: number | null;
    familySize?: number | null;
    productInterest?: string | null;
    coverageTier?: string | null;
  };
  followUpDate?: string | null;
}): Promise<ActionResult<EngagementResult>> {
  const actor = await getActor();
  const client = await getClientsRepository().findById(input.clientId);
  if (!client) return { ok: false, error: "Contact not found." };

  const d = input.discovery;
  const bits = [
    d?.estPremium != null ? `Budget ₱${d.estPremium.toLocaleString("en-PH")}` : null,
    d?.familySize != null ? `${d.familySize} ${d.familySize === 1 ? "person" : "people"} to cover` : null,
    d?.productInterest,
    d?.coverageTier,
  ].filter(Boolean);
  const structured = bits.join(" · ");
  const body = [structured, input.notes].filter(Boolean).join(structured && input.notes ? " — " : "");

  const { error } = await getSupabaseAdmin().from("communications").insert({
    client_id: input.clientId,
    direction: "Outbound",
    channel: "Phone",
    subject: `Call logged — ${input.outcome}`,
    summary: body.split("\n").find(Boolean) ?? input.outcome,
    notes: body || null,
    related_user_id: actor.id,
  });
  if (error) return { ok: false, error: error.message };

  // Discovery details carry into Convert to Application (design contact-profile.jsx).
  if (d && (d.estPremium != null || d.familySize != null || d.productInterest || d.coverageTier)) {
    await getClientsRepository().update(input.clientId, {
      ...(d.estPremium != null ? { estPremium: d.estPremium } : {}),
      ...(d.familySize != null ? { familySize: d.familySize } : {}),
      ...(d.productInterest ? { productInterest: d.productInterest } : {}),
      ...(d.coverageTier ? { coverageTier: d.coverageTier } : {}),
    });
  }

  if (input.followUpDate) {
    await getTasksRepository().create({
      title: "Follow-up call",
      tag: "General",
      clientId: input.clientId,
      assignedUserId: actor.id,
      dueDate: input.followUpDate,
    });
  }

  const canSuggestAdvance = client.leadStage === "New Lead" || client.leadStage === "Contacted";
  const result =
    input.outcome === "Reached" && (client.leadStatus === "New" || client.leadStatus === "Attempted")
      ? await updateLeadStatus(
          client,
          actor.id,
          "Connected",
          "Reached call logged",
          canSuggestAdvance
            ? {
                stage: nextLeadStage(client.leadStage) ?? "Discovery",
                label: "Reached call logged",
                detail: `Outcome: ${input.outcome}`,
                occurredAt: new Date().toISOString(),
              }
            : undefined,
        )
      : // Reaching a lead on nurture hold ends the hold — back to `Qualified`, discovery already on
        // file, stage unchanged so no advance suggestion (docs/lead-stage-status.md).
        input.outcome === "Reached" && client.leadStatus === "Nurturing"
        ? await updateLeadStatus(client, actor.id, "Qualified", "Re-engaged during nurture hold")
        : input.outcome === "No answer" && client.leadStatus === "Connected"
          ? await updateLeadStatus(client, actor.id, "Attempted", "No-answer call logged")
          : {};

  refresh(input.clientId);
  return { ok: true, data: result };
}

export async function addNoteAction(input: {
  clientId: string;
  note: string;
}): Promise<ActionResult> {
  const actor = await getActor();
  if (!input.note.trim()) return { ok: false, error: "Note is required." };

  await recordActivity({
    scopeType: "client",
    scopeId: input.clientId,
    activityType: "contact.note",
    summary: input.note.trim(),
    actorId: actor.id,
  });

  refresh(input.clientId);
  return { ok: true, data: undefined };
}

/**
 * Request Proposal (modals.md §14) — its own modal, NOT the Email tab. Always:
 * sets proposal_status = Requested, logs a note, creates a follow-up task.
 * Optionally also logs the internal email to Pacific Cross.
 */
export async function requestProposalAction(input: {
  clientId: string;
  note: string;
  followUpDate?: string | null;
  alsoEmailCarrier?: boolean;
  carrierRecipient?: string | null;
  carrierContactId?: string | null;
}): Promise<ActionResult> {
  const actor = await getActor();
  if (!input.note.trim()) return { ok: false, error: "A proposal request note is required." };

  try {
    const repo = getClientsRepository();
    const client = await repo.findById(input.clientId);
    if (!client) return { ok: false, error: "Contact not found." };

    let carrierRecipient = input.carrierRecipient?.trim() || null;
    let carrierContactId: string | null = null;
    if (input.alsoEmailCarrier && input.carrierContactId) {
      const contact = await getExternalContactsRepository().findById(input.carrierContactId);
      if (!contact || contact.status !== "Active" || !contact.email)
        return { ok: false, error: "Choose an active Pacific Cross contact with an email address." };
      carrierRecipient = contact.email;
      carrierContactId = contact.id;
    }
    if (input.alsoEmailCarrier && !carrierRecipient)
      return { ok: false, error: "Choose a Pacific Cross contact or enter a recipient email." };

    await repo.update(input.clientId, { proposalStatus: "Requested" });
    await recordActivity({
      scopeType: "client",
      scopeId: input.clientId,
      activityType: "lead.proposal",
      summary: `Proposal requested — ${input.note.trim()}`,
      actorId: actor.id,
    });
    await getTasksRepository().create({
      title: `Follow up on proposal for ${client.fullName}`,
      tag: "Application",
      clientId: input.clientId,
      assignedUserId: actor.id,
      dueDate: input.followUpDate ?? null,
      priority: "Normal",
    });
    if (input.alsoEmailCarrier && carrierRecipient) {
      await logOutboundEmail({ clientId: input.clientId, subject: `Proposal request — ${client.productInterest ?? "product"} for ${client.fullName}`, summary: `Logged for ${carrierRecipient} (Pacific Cross)`, actorId: actor.id, externalContactId: carrierContactId });
    }

    refresh(input.clientId);
    revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to request proposal." };
  }
}

export async function listProposalContactsAction(): Promise<ExternalContact[]> {
  const contacts = await getExternalContactsRepository().list({ status: "Active", departments: ["New Business"] });
  return contacts.filter((contact) => !!contact.email);
}

export async function toggleContactFlagAction(input: {
  clientId: string;
  flag: "earlyPayer" | "doNotContact";
  value: boolean;
}): Promise<ActionResult> {
  const actor = await getActor();
  try {
    await getClientsRepository().update(input.clientId, { [input.flag]: input.value });
    await recordActivity({
      scopeType: "client",
      scopeId: input.clientId,
      activityType: "contact.flag",
      summary: `${input.flag === "earlyPayer" ? "Early payer" : "Lost / Do not contact"} ${input.value ? "enabled" : "disabled"}`,
      actorId: actor.id,
    });
    refresh(input.clientId);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update flag." };
  }
}
