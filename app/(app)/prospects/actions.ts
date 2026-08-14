"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import {
  LEAD_STAGES,
  LEAD_STATUSES,
  allowedLeadStatuses,
  discoveryGaps,
  formatGaps,
  nextLeadStage,
  type LeadStage,
  type LeadStatus,
} from "@/components/hub/lead-config";
import {
  getClientsRepository,
  type Client,
  type ClientUpdate,
} from "@/lib/repositories/clients";
import { getIntegrationSettingsRepository } from "@/lib/repositories/integration-settings";
import type { Json } from "@/lib/supabase/types";

const INDIVIDUAL_PROPOSAL_PRODUCTS = new Set(["select", "blue royale"]);

const normaliseProductName = (product: string | null) => product?.trim().toLowerCase() ?? "";

/**
 * Lead Lifecycle mutations. advanceLeadAction is the SINGLE transition used by
 * every path — Kanban drag, list-row Advance, nurture-action chaining — so
 * stage/status changes are always confirmed and always logged
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
    // in the UI, so the rule holds for any caller. `Lost` is not a reachable value here at
    // all — it's a separate lifecycle transition (markLostAction).
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

    // Status was previously written through unchecked — unlike `stage` above, which has always
    // been validated. `Nurturing` in particular must not be settable from here: it is defined by
    // a re-engagement follow-up date this input has no field for, so a lead set Nurturing through
    // the popup would be parked with nothing to resurface it (docs/lead-stage-status.md).
    if (!LEAD_STATUSES.includes(input.status as LeadStatus))
      return { ok: false, error: `Unknown lead status "${input.status}".` };
    if (!allowedLeadStatuses().includes(input.status) && input.status !== lead.leadStatus)
      return {
        ok: false,
        error: `Use “Mark as Nurturing” to put ${lead.fullName} on hold — it captures the re-engagement date this popup can't.`,
      };

    // Discovery readiness. `Qualified` and the Proposal stage both assert the lead is quotable,
    // so neither is reachable until budget, family size, product and tier are on the record
    // (docs/lead-stage-status.md). Enforced here so no client path — this popup, a stale tab,
    // a direct call — can set the state without the data behind it.
    const gaps = discoveryGaps(lead);
    if (gaps.length) {
      const movingToProposal = input.stage === "Proposal" && input.stage !== current;
      const qualifying = input.status === "Qualified" && input.status !== lead.leadStatus;
      if (movingToProposal || qualifying)
        return {
          ok: false,
          error: `Add ${formatGaps(gaps)} before ${
            movingToProposal
              ? `moving ${lead.fullName} to Proposal`
              : `marking ${lead.fullName} Qualified`
          }.`,
        };
    }

    const patch: ClientUpdate = {
      leadStage: input.stage,
      leadStatus: input.status,
    };
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
    if (input.stage !== lead.leadStage)
      await log("lead.stage_changed", `Stage changed — ${lead.leadStage ?? "—"} → ${input.stage}`);
    if (input.status !== lead.leadStatus)
      await log("lead.status_changed", `Status changed — ${lead.leadStatus ?? "—"} → ${input.status}`);

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

/**
 * Mark Lost — the only way into `lifecycle_stage = Lost`. Moved out of the
 * Advance-Lead popup: advancing and losing a lead are opposite workflows and
 * shouldn't share a confirm. Lives behind the ⋮ menu on Contact Profile,
 * immediately before Delete.
 */
export interface MarkLostInput {
  clientId: string;
  note?: string;
}

export async function markLostAction(input: MarkLostInput): Promise<ActionResult<Client>> {
  const actor = await getActor();
  const repo = getClientsRepository();

  try {
    const lead = await repo.findById(input.clientId);
    if (!lead) return { ok: false, error: "Lead not found." };
    if (lead.lifecycleStage !== "Lead")
      return { ok: false, error: `${lead.fullName} is no longer a Lead.` };

    const updated = await repo.update(lead.id, { lifecycleStage: "Lost", leadStage: "Lost" });

    if (input.note)
      await recordActivity({
        scopeType: "client",
        scopeId: lead.id,
        activityType: "lead.note",
        summary: `Outcome note — ${input.note}`,
        actorId: actor.id,
      });
    await recordActivity({
      scopeType: "client",
      scopeId: lead.id,
      activityType: "lead.lost",
      summary: "Marked Lost — lifecycle_stage = Lost (retained for re-nurture)",
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "lead_lost",
      tableName: "clients",
      recordId: lead.id,
      previousValue: lead as unknown as Json,
      newValue: updated as unknown as Json,
    });

    revalidatePath("/prospects");
    revalidatePath(`/clients/${lead.id}`);
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to mark the lead lost." };
  }
}

/**
 * `Mark as Nurturing` — the one way into `lead_status = Nurturing`
 * (`docs/lead-stage-status.md`: "a deliberate hold, not a decay"; `docs/web/contact-profile.md`
 * places the button on the profile header at `Qualified`).
 *
 * The re-engagement date is required rather than optional because it is what the state is *for*:
 * `nextFollowUpDate` is the field the Prospects follow-up queue reads, so a hold saved without one
 * would drop off Eman's radar entirely — the opposite of parking a lead you intend to come back to.
 * The stage deliberately does not move; only the disposition changes.
 */
export async function markNurturingAction(input: {
  clientId: string;
  reEngagementDate: string;
  note?: string;
}): Promise<ActionResult<Client>> {
  const actor = await getActor();
  const repo = getClientsRepository();

  try {
    if (!input.reEngagementDate)
      return { ok: false, error: "A re-engagement date is required to put a lead on hold." };

    const lead = await repo.findById(input.clientId);
    if (!lead) return { ok: false, error: "Lead not found." };
    if (lead.lifecycleStage !== "Lead")
      return { ok: false, error: `${lead.fullName} is no longer a Lead.` };
    // Spec spine: `Qualified → Nurturing` is the only entry. Holding a lead you haven't yet
    // qualified isn't nurturing, it's an un-worked lead.
    if (lead.leadStatus !== "Qualified")
      return {
        ok: false,
        error: `Only a Qualified lead can be put on hold — ${lead.fullName} is ${lead.leadStatus ?? "unset"}.`,
      };

    const updated = await repo.update(lead.id, {
      leadStatus: "Nurturing",
      nextFollowUpDate: input.reEngagementDate,
    });

    if (input.note)
      await recordActivity({
        scopeType: "client",
        scopeId: lead.id,
        activityType: "lead.note",
        summary: `Nurture note — ${input.note}`,
        actorId: actor.id,
      });
    await recordActivity({
      scopeType: "client",
      scopeId: lead.id,
      activityType: "lead.status_changed",
      summary: `Status changed — ${lead.leadStatus ?? "—"} → Nurturing (re-engage ${input.reEngagementDate})`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "lead_nurturing",
      tableName: "clients",
      recordId: lead.id,
      previousValue: lead as unknown as Json,
      newValue: updated as unknown as Json,
    });

    revalidatePath("/prospects");
    revalidatePath(`/clients/${lead.id}`);
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to mark the lead as nurturing." };
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

/**
 * Individual Select / Blue Royale proposals are created in the Pacific Cross
 * portal. A completed handoff means an illustration is available to send, so
 * it enters the existing proposal artifact machine at Received rather than
 * introducing a parallel Generated status.
 */
export async function generateProposalAction(
  clientId: string,
): Promise<ActionResult<{ portalUrl: string }>> {
  const actor = await getActor();
  try {
    const repo = getClientsRepository();
    const lead = await repo.findById(clientId);
    if (!lead) return { ok: false, error: "Lead not found." };
    if (lead.lifecycleStage !== "Lead")
      return { ok: false, error: `${lead.fullName} is no longer a Lead.` };
    if (!INDIVIDUAL_PROPOSAL_PRODUCTS.has(normaliseProductName(lead.productInterest)))
      return {
        ok: false,
        error: "Generate Proposal is available for Select and Blue Royale. Use Request Proposal for HMO products.",
      };
    if (lead.proposalStatus && lead.proposalStatus !== "Requested")
      return {
        ok: false,
        error: `This proposal is already ${lead.proposalStatus.toLowerCase()}. Continue it from proposal tracking.`,
      };

    const portalUrl = (await getIntegrationSettingsRepository().getPacificCross())?.portalUrl;
    if (!portalUrl)
      return {
        ok: false,
        error: "The Pacific Cross portal URL has not been configured. Open Settings → Integrations to add it.",
      };

    const updated = await repo.update(clientId, { proposalStatus: "Received" });
    await recordActivity({
      scopeType: "client",
      scopeId: clientId,
      activityType: "lead.proposal",
      summary: `Proposal generated in Pacific Cross — ${lead.productInterest} illustration ready to send`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "proposal_generated",
      tableName: "clients",
      recordId: clientId,
      previousValue: lead as unknown as Json,
      newValue: updated as unknown as Json,
    });

    revalidatePath("/prospects");
    revalidatePath(`/clients/${clientId}`);
    return { ok: true, data: { portalUrl } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to generate proposal." };
  }
}
