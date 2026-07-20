"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getTasksRepository } from "@/lib/repositories/tasks";

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

export async function sendEmailAction(input: {
  clientId: string;
  recipient: string;
  subject: string;
  body: string;
  templateName?: string | null;
}): Promise<ActionResult> {
  const actor = await getActor();
  if (!input.recipient.trim() || !input.subject.trim())
    return { ok: false, error: "Recipient and subject are required." };

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

  refresh(input.clientId);
  return { ok: true, data: undefined };
}

export async function logMessageAction(input: {
  clientId: string;
  channel: string;
  transcript: string;
  occurredAt?: string | null;
}): Promise<ActionResult> {
  const actor = await getActor();
  if (!input.transcript.trim()) return { ok: false, error: "Message transcript is required." };

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

  refresh(input.clientId);
  return { ok: true, data: undefined };
}

export async function logCallAction(input: {
  clientId: string;
  outcome: string;
  notes?: string | null;
}): Promise<ActionResult> {
  const actor = await getActor();

  const { error } = await getSupabaseAdmin().from("communications").insert({
    client_id: input.clientId,
    direction: "Outbound",
    channel: "Phone",
    subject: `Call logged — ${input.outcome}`,
    summary: input.notes?.split("\n").find(Boolean) ?? input.outcome,
    notes: input.notes ?? null,
    related_user_id: actor.id,
  });
  if (error) return { ok: false, error: error.message };

  refresh(input.clientId);
  return { ok: true, data: undefined };
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
