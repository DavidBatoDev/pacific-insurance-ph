"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { toAppRole } from "@/lib/auth/permissions";
import { getRenewalsRepository, type Renewal } from "@/lib/repositories/renewals";
import { noticeReceiptPatch } from "@/lib/renewals/notice-receipt";

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

/** Admin-triggered backfill, also used after policy import. Never runs on page load. */
export async function backfillPolicyRenewalsAction(): Promise<ActionResult<{
  created: number; refreshed: number; unchanged: number; skipped: number;
}>> {
  const actor = await getActor();
  if (toAppRole(actor.role) !== "admin") {
    return { ok: false, error: "Only admins can sync policy renewals." };
  }
  try {
    const results = await getRenewalsRepository().synchronizeFromPolicies();
    const counts = { created: 0, refreshed: 0, unchanged: 0, skipped: 0 };
    for (const result of results) counts[result.outcome] += 1;
    await recordAudit({
      actorId: actor.id,
      action: "sync_from_policies",
      tableName: "renewals",
      recordId: null,
      newValue: {
        ...counts,
        policies: results.map((result) => ({
          policy_id: result.policyId, renewal_id: result.renewalId, outcome: result.outcome,
        })),
      },
    });
    revalidatePath("/renewals");
    revalidatePath("/dashboard");
    return { ok: true, data: counts };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to sync policy renewals." };
  }
}

/** Record carrier notice receipt without sending an email or regressing later workflow states. */
export async function markRenewalNoticeReceivedAction(
  renewalId: string,
  receivedDate: string,
): Promise<ActionResult<Renewal>> {
  const actor = await getActor();
  try {
    // Validate before lookup so malformed dates always get the actionable date error.
    noticeReceiptPatch({ status: "Upcoming", noticeReceivedDate: null }, receivedDate);
    const repo = getRenewalsRepository();
    const renewal = await repo.findById(renewalId);
    if (!renewal) return { ok: false, error: "Renewal not found." };
    const patch = noticeReceiptPatch(renewal, receivedDate);
    if (!patch) return { ok: true, data: renewal };

    const updated = await repo.update(renewalId, patch);
    await recordActivity({
      scopeType: "client",
      scopeId: renewal.clientId,
      activityType: "renewal.notice_received",
      summary: `Renewal notice received — ${renewal.policyNumber ?? renewal.policyRef ?? "policy"} on ${receivedDate}`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "update",
      tableName: "renewals",
      recordId: renewalId,
      previousValue: { notice_received_date: renewal.noticeReceivedDate, status: renewal.status },
      newValue: { notice_received_date: updated.noticeReceivedDate, status: updated.status },
    });
    revalidatePath("/renewals");
    revalidatePath("/dashboard");
    revalidatePath(`/clients/${renewal.clientId}`);
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to record notice receipt." };
  }
}
