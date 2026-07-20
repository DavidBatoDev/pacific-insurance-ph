"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { getRenewalsRepository, type Renewal } from "@/lib/repositories/renewals";

/**
 * Send Renewal Notice (modals.md §5): the notice itself goes out through the
 * Engage composer (Renewal reminder template); this marks the renewal row and
 * logs the status change once the send completes.
 */
export async function markRenewalNoticeSentAction(
  renewalId: string,
): Promise<ActionResult<Renewal>> {
  const actor = await getActor();
  try {
    const repo = getRenewalsRepository();
    const renewal = await repo.findById(renewalId);
    if (!renewal) return { ok: false, error: "Renewal not found." };

    const updated = await repo.update(renewalId, { status: "Reminder Sent" });
    await recordActivity({
      scopeType: "client",
      scopeId: renewal.clientId,
      activityType: "renewal.notice_sent",
      summary: `Renewal notice sent — ${renewal.policyRef ?? "policy"} due ${renewal.renewalDueDate ?? ""}`.trim(),
      actorId: actor.id,
    });
    revalidatePath("/renewals");
    revalidatePath(`/clients/${renewal.clientId}`);
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update renewal." };
  }
}
