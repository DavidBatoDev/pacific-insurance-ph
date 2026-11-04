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
import { requireEmailSender, outboundEmailErrorMessage } from "@/lib/communications/outbound-email";
import {
  attachmentRequirement, resolveEligibleLibraryDocuments, resolveOptionalLibraryDocuments,
} from "@/lib/communications/email-attachments";
import type {
  EligibleLibraryDocuments, EmailDraftSeed, LeadAdvanceSuggestion,
} from "@/lib/communications/outbound-email.types";
import { addBusinessDays, HMO_PROPOSAL_TURNAROUND_BUSINESS_DAYS, nextLeadStage } from "@/components/hub/lead-config";

/**
 * Engage composer mutations (contact-profile.md; human-in-the-loop). Inbound
 * message logs, calls and notes become `communications` rows; status flags and
 * Request Proposal mutate the contact + create the follow-up task. Outgoing email
 * goes through the reviewed Gmail send flow (`app/(app)/email/actions.ts`).
 * The contact timeline merges communications + activity_timeline.
 */

function refresh(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/prospects");
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

export async function listOptionalLibraryDocumentsAction(clientId: string): Promise<ActionResult<EligibleLibraryDocuments>> {
  try {
    await requireEmailSender();
    const client = await getClientsRepository().findById(clientId);
    if (!client) return { ok: false, error: "Contact not found." };
    return { ok: true, data: await resolveOptionalLibraryDocuments(client) };
  } catch (e) { return { ok: false, error: outboundEmailErrorMessage(e) }; }
}

export async function listEligibleLibraryDocumentsAction(clientId: string, templateName: string): Promise<ActionResult<EligibleLibraryDocuments>> {
  try {
    await requireEmailSender();
    const requirement = attachmentRequirement(templateName);
    if (!requirement) return { ok: true, data: { documents: [], reason: null } };
    const client = await getClientsRepository().findById(clientId);
    if (!client) return { ok: false, error: "Contact not found." };
    return { ok: true, data: await resolveEligibleLibraryDocuments(client, requirement) };
  } catch (e) { return { ok: false, error: outboundEmailErrorMessage(e) }; }
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

  // Discovery details carry into Convert to Application.
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
 * Saving the request never sends email: when staff chose to email Pacific Cross,
 * this returns a populated draft that they review and send separately.
 */
export async function requestProposalAction(input: {
  clientId: string;
  note: string;
  followUpDate?: string | null;
  /** Active New Business contact to draft the request email to; omitted = no email. */
  emailContactId?: string | null;
}): Promise<ActionResult<{ emailDraft?: EmailDraftSeed }>> {
  const actor = await getActor();
  const note = input.note.trim();
  if (!note) return { ok: false, error: "A proposal request note is required." };

  try {
    const repo = getClientsRepository();
    const client = await repo.findById(input.clientId);
    if (!client) return { ok: false, error: "Contact not found." };

    let carrier: ExternalContact | null = null;
    if (input.emailContactId) {
      carrier = await getExternalContactsRepository().findById(input.emailContactId);
      if (!carrier || carrier.status !== "Active" || carrier.department !== "New Business" || !carrier.email)
        return { ok: false, error: "Choose an active Pacific Cross New Business contact with an email address." };
    }

    // Requesting again restarts the cycle, so any decision from the previous round is stale —
    // clearing it is both the correct semantics and what keeps the
    // `clients_proposal_decision_scope` constraint satisfied (a decision may only exist while
    // the status is `Decision`). This path has no guard on the current status, so a lead sitting
    // at Declined can legitimately arrive here.
    await repo.update(input.clientId, { proposalStatus: "Requested", proposalDecision: null });
    await recordActivity({
      scopeType: "client",
      scopeId: input.clientId,
      activityType: "lead.proposal",
      summary: `Proposal requested — ${note}`,
      actorId: actor.id,
    });
    await getTasksRepository().create({
      title: `Follow up on proposal for ${client.fullName}`,
      tag: "Application",
      clientId: input.clientId,
      assignedUserId: actor.id,
      dueDate: input.followUpDate || addBusinessDays(HMO_PROPOSAL_TURNAROUND_BUSINESS_DAYS),
      priority: "Normal",
    });

    refresh(input.clientId);
    revalidatePath("/tasks");
    const emailDraft: EmailDraftSeed | undefined = carrier?.email
      ? {
          origin: { type: "proposal_request", clientId: client.id },
          externalContactId: carrier.id,
          recipient: carrier.email,
          subject: `Proposal request — ${client.productInterest ?? "product"} for ${client.fullName}`,
          body: note,
        }
      : undefined;
    return { ok: true, data: { emailDraft } };
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
