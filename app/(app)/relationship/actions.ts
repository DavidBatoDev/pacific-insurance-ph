"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { getRelationshipTouchpoints, type TouchpointRow } from "@/lib/queries/relationship";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Audience segments for the New Campaign drawer. */
export async function listTouchpointsAction(): Promise<TouchpointRow[]> {
  return getRelationshipTouchpoints();
}

export interface CampaignRecipient {
  clientId: string;
  name: string;
  email: string | null;
  subject: string;
  body: string;
}

/**
 * New Campaign send (new-modals.md §11): queues one personalized message per
 * recipient — a communications row + a timeline entry each.
 */
export async function sendCampaignAction(input: {
  campaignName: string;
  type: string;
  channels: string[];
  recipients: CampaignRecipient[];
}): Promise<ActionResult<number>> {
  const actor = await getActor();
  if (input.recipients.length === 0) return { ok: false, error: "No recipients selected." };

  try {
    let sent = 0;
    for (const r of input.recipients) {
      await getSupabaseAdmin().from("communications").insert({
        client_id: r.clientId,
        direction: "Outbound",
        channel: "Gmail",
        subject: r.subject,
        summary: `${input.type} campaign “${input.campaignName}” · via ${input.channels.join(", ")}`,
        notes: r.body,
        related_user_id: actor.id,
        delivery_status: "sent",
      });
      await recordActivity({
        scopeType: "client",
        scopeId: r.clientId,
        activityType: "campaign.sent",
        summary: `${input.type} campaign sent — “${r.subject}”`,
        actorId: actor.id,
      });
      sent++;
    }
    revalidatePath("/relationship");
    return { ok: true, data: sent };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send campaign." };
  }
}
