"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { LEAD_STAGES, nextLeadStage, type LeadStage } from "@/components/hub/lead-config";
import {
  getClientsRepository,
  type Client,
  type ClientUpdate,
} from "@/lib/repositories/clients";
import type { Json } from "@/lib/supabase/types";

/**
 * Lead Lifecycle mutations. advanceLeadAction is the SINGLE transition used by
 * every path — Kanban drag, list-row Advance, nurture-action chaining, Mark
 * Lost — so stage/status changes are always confirmed and always logged
 * (lead-workflow.md §4: nothing moves silently).
 */

export interface AdvanceLeadInput {
  clientId: string;
  stage: string;
  status: string;
  note?: string;
  nextFollowUpDate?: string | null;
  estPremium?: number | null;
  expectedCloseDate?: string | null;
  markLost?: boolean;
}

export async function advanceLeadAction(
  input: AdvanceLeadInput,
): Promise<ActionResult<Client>> {
  const actor = await getActor();
  const repo = getClientsRepository();

  try {
    const lead = await repo.findById(input.clientId);
    if (!lead) return { ok: false, error: "Lead not found." };
    if (lead.lifecycleStage !== "Lead")
      return { ok: false, error: `${lead.fullName} is no longer a Lead.` };

    // Forward-only spine (docs/lead-stage-status.md): a lead may hold its stage or move to
    // the immediately following one. Backward moves and skips are rejected here as well as
    // in the UI, so the rule holds for any caller. Lost travels via markLost, not `stage`.
    if (!input.markLost) {
      const current = lead.leadStage ?? LEAD_STAGES[0];
      const currentIndex = LEAD_STAGES.indexOf(current as LeadStage);
      const next = nextLeadStage(current);
      if (!LEAD_STAGES.includes(input.stage as LeadStage))
        return { ok: false, error: `Unknown lead stage "${input.stage}".` };
      if (currentIndex !== -1 && input.stage !== current && input.stage !== next)
        return {
          ok: false,
          error: next
            ? `Leads advance one stage at a time — from ${current} you can only stay or move to ${next}.`
            : `${current} is the final lead stage; convert the application instead.`,
        };
    }

    const patch: ClientUpdate = {};
    if (input.markLost) {
      patch.lifecycleStage = "Lost";
      patch.leadStage = "Lost";
    } else {
      patch.leadStage = input.stage;
      patch.leadStatus = input.status;
    }
    if (input.nextFollowUpDate !== undefined) patch.nextFollowUpDate = input.nextFollowUpDate;
    if (input.estPremium != null) patch.estPremium = input.estPremium;
    if (input.expectedCloseDate) patch.expectedCloseDate = input.expectedCloseDate;

    const updated = await repo.update(lead.id, patch);

    const log = (activityType: string, summary: string) =>
      recordActivity({
        scopeType: "client",
        scopeId: lead.id,
        activityType,
        summary,
        actorId: actor.id,
      });

    if (input.note) await log("lead.note", `Outcome note — ${input.note}`);
    if (input.markLost) {
      await log("lead.lost", "Marked Lost — lifecycle_stage = Lost (retained for re-nurture)");
    } else {
      if (input.stage !== lead.leadStage)
        await log("lead.stage_changed", `Stage changed — ${lead.leadStage ?? "—"} → ${input.stage}`);
      if (input.status !== lead.leadStatus)
        await log("lead.status_changed", `Status changed — ${lead.leadStatus ?? "—"} → ${input.status}`);
    }

    await recordAudit({
      actorId: actor.id,
      action: "update",
      tableName: "clients",
      recordId: lead.id,
      newValue: updated as unknown as Json,
    });

    revalidatePath("/prospects");
    revalidatePath(`/clients/${lead.id}`);
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to advance lead." };
  }
}

export interface NewLeadInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  mobileNumber?: string | null;
  productInterest?: string | null;
  estPremium?: number | null;
  leadSource?: string | null;
  startingStage?: string;
  startingStatus?: string;
  dateOfBirth?: string | null;
  nextFollowUpDate?: string | null;
  notes?: string | null;
}

export async function createLeadAction(input: NewLeadInput): Promise<ActionResult<Client>> {
  const actor = await getActor();
  if (!input.firstName?.trim() || !input.lastName?.trim())
    return { ok: false, error: "First and last name are required." };
  if (!input.email && !input.mobileNumber)
    return { ok: false, error: "At least one contact method (email or mobile) is required." };
  const dateOfBirth = input.dateOfBirth?.trim();
  if (!dateOfBirth)
    return { ok: false, error: "Date of birth is required to create a lead." };

  try {
    const created = await getClientsRepository().create({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email ?? null,
      mobileNumber: input.mobileNumber ?? null,
      clientType: "Prospect",
      leadSource: input.leadSource ?? null,
      assignedUserId: actor.id,
      lifecycleStage: "Lead",
      leadStage: input.startingStage ?? "New Lead",
      leadStatus: input.startingStatus ?? "New",
      dateOfBirth,
      productInterest: input.productInterest ?? null,
      estPremium: input.estPremium ?? null,
      nextFollowUpDate: input.nextFollowUpDate ?? null,
      notes: input.notes ?? null,
    });

    await recordActivity({
      scopeType: "client",
      scopeId: created.id,
      activityType: "lead.created",
      summary: `New lead created — stage ${created.leadStage}, status ${created.leadStatus}`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "create",
      tableName: "clients",
      recordId: created.id,
      newValue: created as unknown as Json,
    });

    revalidatePath("/prospects");
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create lead." };
  }
}

/** Proposal micro-status within the Proposal stage (Requested→Received→Sent→Decision). */
export async function setProposalStatusAction(
  clientId: string,
  status: string,
): Promise<ActionResult<Client>> {
  const actor = await getActor();
  try {
    const repo = getClientsRepository();
    const lead = await repo.findById(clientId);
    if (!lead) return { ok: false, error: "Lead not found." };

    const updated = await repo.update(clientId, { proposalStatus: status });
    await recordActivity({
      scopeType: "client",
      scopeId: clientId,
      activityType: "lead.proposal",
      summary: `Proposal ${status.toLowerCase()} — ${lead.productInterest ?? "carrier"} proposal`,
      actorId: actor.id,
    });

    revalidatePath("/prospects");
    revalidatePath(`/clients/${clientId}`);
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update proposal." };
  }
}
