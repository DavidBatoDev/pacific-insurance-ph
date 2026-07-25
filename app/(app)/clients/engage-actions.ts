"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getTasksRepository } from "@/lib/repositories/tasks";
import type { Client } from "@/lib/repositories/clients";
import type { Json } from "@/lib/supabase/types";

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
}

export interface EngagementResult {
  advance?: LeadAdvanceSuggestion;
}

async function updateLeadStatus(
  client: Client,
  actorId: string,
  nextStatus: string,
  summary: string,
  advance?: Pick<LeadAdvanceSuggestion, "stage" | "label">,
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
          stage: advance.stage,
          status: nextStatus,
          label: advance.label,
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
}): Promise<ActionResult<EngagementResult>> {
  const actor = await getActor();
  if (!input.recipient.trim() || !input.subject.trim())
    return { ok: false, error: "Recipient and subject are required." };

  const client = await getClientsRepository().findById(input.clientId);
  if (!client) return { ok: false, error: "Contact not found." };

  const { error } = await getSupabaseAdmin().from("communications").insert({
    client_id: input.clientId,
    direction: "Outbound",
    channel: "Gmail",
    subject: input.subject,
    summary: input.body.split("\n").find(Boolean) ?? "",
    notes: input.body,
    related_user_id: actor.id,
    delivery_status: "sent",
  });
  if (error) return { ok: false, error: error.message };

  const result =
    client.leadStatus === "New"
      ? await updateLeadStatus(client, actor.id, "Attempted", "First outbound email sent", {
          stage: "Contacted",
          label: "First outreach sent",
        })
      : {};
  refresh(input.clientId);
  return { ok: true, data: result };
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

  const result =
    client.leadStatus === "New" || client.leadStatus === "Attempted"
      ? await updateLeadStatus(client, actor.id, "Connected", "Inbound message logged", {
          stage: "Discovery",
          label: "Inbound response logged",
        })
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

  const result =
    input.outcome === "Reached" && (client.leadStatus === "New" || client.leadStatus === "Attempted")
      ? await updateLeadStatus(
          client,
          actor.id,
          "Connected",
          "Reached call logged",
          { stage: "Discovery", label: "Reached call logged" },
        )
      : input.outcome === "No answer" && client.leadStatus === "Connected"
        ? await updateLeadStatus(client, actor.id, "Attempted", "No-answer call logged")
        : {};

  refresh(input.clientId);
  return { ok: true, data: result };
}

export async function completeDiscoveryAction(
  clientId: string,
): Promise<ActionResult<EngagementResult>> {
  const actor = await getActor();
  const client = await getClientsRepository().findById(clientId);
  if (!client) return { ok: false, error: "Contact not found." };
  if (client.lifecycleStage !== "Lead" || client.leadStatus !== "Connected") {
    return { ok: false, error: "Discovery can be completed only for a connected lead." };
  }
  if (
    client.estPremium == null ||
    client.familySize == null ||
    client.familySize < 1 ||
    !client.productInterest ||
    !client.coverageTier
  ) {
    return {
      ok: false,
      error: "Add budget, family size, product interest, and coverage tier before completing discovery.",
    };
  }

  const result = await updateLeadStatus(client, actor.id, "Qualified", "Discovery completed", {
    stage: "Proposal",
    label: "Discovery complete",
  });
  refresh(clientId);
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
}): Promise<ActionResult> {
  const actor = await getActor();
  if (!input.note.trim()) return { ok: false, error: "A proposal request note is required." };

  try {
    const repo = getClientsRepository();
    const client = await repo.findById(input.clientId);
    if (!client) return { ok: false, error: "Contact not found." };

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
    if (input.alsoEmailCarrier && input.carrierRecipient) {
      await getSupabaseAdmin().from("communications").insert({
        client_id: input.clientId,
        direction: "Outbound",
        channel: "Gmail",
        subject: `Proposal request — ${client.productInterest ?? "product"} for ${client.fullName}`,
        summary: `Sent to ${input.carrierRecipient} (Pacific Cross)`,
        related_user_id: actor.id,
        delivery_status: "sent",
      });
    }

    refresh(input.clientId);
    revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to request proposal." };
  }
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
