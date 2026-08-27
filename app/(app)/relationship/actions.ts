"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivities } from "@/lib/activity/log";
import { getRelationshipTouchpoints, type TouchpointRow } from "@/lib/queries/relationship";
import { logOutboundEmails } from "@/lib/communications/log-outbound-email";

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
    // Batched: one communications insert + one activity insert for the whole
    // audience instead of 2 round-trips per recipient. The insert is a single
    // statement, so a failure logs nothing rather than a partial batch.
    const logged = await logOutboundEmails(
      input.recipients.map((r) => ({
        clientId: r.clientId,
        subject: r.subject,
        summary: `${input.type} campaign “${input.campaignName}” · via ${input.channels.join(", ")}`,
        notes: r.body,
        actorId: actor.id,
      })),
    );
    await recordActivities(
      input.recipients.map((r) => ({
        scopeType: "client" as const,
        scopeId: r.clientId,
        activityType: "campaign.logged",
        summary: `${input.type} campaign logged — “${r.subject}”`,
        actorId: actor.id,
      })),
    );
    revalidatePath("/relationship");
    return { ok: true, data: logged };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send campaign." };
  }
}
