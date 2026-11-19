"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { assertRecordAccess } from "@/lib/auth/agent-scope";
import { toAppRole } from "@/lib/auth/permissions";
import { getRenewalsRepository, type Renewal } from "@/lib/repositories/renewals";
import { renewedExpiryProblem } from "@/lib/renewals/lifecycle";
import { noticeReceiptPatch } from "@/lib/renewals/notice-receipt";

const RENEWAL_CHANGED = "This renewal changed. Reload and try again.";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mark Renewal Notice Sent (modals.md §5): an explicit staff action. Emailing the
 * notice through the Engage composer (Renewal reminder template) never advances
 * the renewal lifecycle by itself; this marks the renewal row and logs the change.
 */
export async function markRenewalNoticeSentAction(
  renewalId: string,
): Promise<ActionResult<Renewal>> {
  const actor = await getActor();
  try {
    await assertRecordAccess("renewal", renewalId);
    const repo = getRenewalsRepository();
    const renewal = await repo.findById(renewalId);
    if (!renewal) return { ok: false, error: "Renewal not found." };

    // Conditional: an old tab must not reopen a cycle that has since been paid, renewed or lapsed.
    const updated = await repo.transition(renewalId, ["Upcoming", "Notice Received"], { status: "Reminder Sent" });
    if (!updated) return { ok: false, error: RENEWAL_CHANGED };
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
    await assertRecordAccess("renewal", renewalId);
    const repo = getRenewalsRepository();
    const renewal = await repo.findById(renewalId);
    if (!renewal) return { ok: false, error: "Renewal not found." };
    const patch = noticeReceiptPatch(renewal, receivedDate);
    if (!patch) return { ok: true, data: renewal };

    // Only an Upcoming cycle advances to Notice Received. If it moved on meanwhile, keep its new
    // status and record just the receipt date against the refreshed row.
    let before = renewal;
    let updated: Renewal;
    if (patch.status) {
      const advanced = await repo.transition(renewalId, ["Upcoming"], patch);
      if (advanced) {
        updated = advanced;
      } else {
        const fresh = await repo.findById(renewalId);
        if (!fresh) return { ok: false, error: "Renewal not found." };
        if (fresh.noticeReceivedDate === receivedDate) return { ok: true, data: fresh };
        before = fresh;
        updated = await repo.update(renewalId, { noticeReceivedDate: receivedDate });
      }
    } else {
      updated = await repo.update(renewalId, patch);
    }
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
      previousValue: { notice_received_date: before.noticeReceivedDate, status: before.status },
      newValue: { notice_received_date: updated.noticeReceivedDate, status: updated.status },
    });
    revalidatePath("/renewals");
    revalidatePath("/dashboard");
    revalidatePath("/tasks");
    revalidatePath(`/clients/${renewal.clientId}`);
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to record notice receipt." };
  }
}

/** Validated renewal the actor may act on (renewal and its linked policy), or null when missing. */
async function findLifecycleRenewal(renewalId: string): Promise<Renewal | null> {
  if (typeof renewalId !== "string" || !UUID_PATTERN.test(renewalId)) return null;
  await assertRecordAccess("renewal", renewalId);
  const renewal = await getRenewalsRepository().findById(renewalId);
  if (!renewal) return null;
  await assertRecordAccess("policy", renewal.policyId);
  return renewal;
}

function revalidateRenewalLifecycle(clientId: string): void {
  for (const path of ["/renewals", "/policies", "/payments", "/dashboard", "/tasks", "/reports", `/clients/${clientId}`]) {
    revalidatePath(path);
  }
}

/**
 * Mark a Paid renewal Renewed and set the policy Active with the carrier's new expiry. The SQL
 * routine owns state, date, revision and ownership checks, opens the next cycle, and writes the
 * audit and timeline entries in the same transaction; `updatedAt` is the row revision the user saw.
 */
export async function markRenewalRenewedAction(
  renewalId: string,
  updatedAt: string,
  newExpiryDate: string,
): Promise<ActionResult<Renewal>> {
  try {
    const actor = await getActor();
    // Calendar-format check only (no state or date floors), so an exact replay still reaches SQL.
    const formatProblem = renewedExpiryProblem(
      { status: "Paid", renewalDueDate: null, policyExpiryDate: null }, newExpiryDate, "",
    );
    if (formatProblem) return { ok: false, error: formatProblem };
    if (typeof updatedAt !== "string" || !updatedAt) return { ok: false, error: RENEWAL_CHANGED };
    const renewal = await findLifecycleRenewal(renewalId);
    if (!renewal) return { ok: false, error: "Record not found." };

    const updated = await getRenewalsRepository().completeRenewal(renewal.id, actor.id, updatedAt, newExpiryDate);
    revalidateRenewalLifecycle(renewal.clientId);
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to mark renewal renewed." };
  }
}

/**
 * Mark an overdue, unpaid renewal Lapsed. Closes only the renewal cycle (the policy, payments and
 * dates stay untouched); SQL validates and logs atomically, and the status trigger dismisses
 * pending renewal drafts and tasks.
 */
export async function markRenewalLapsedAction(
  renewalId: string,
  updatedAt: string,
): Promise<ActionResult<Renewal>> {
  try {
    const actor = await getActor();
    if (typeof updatedAt !== "string" || !updatedAt) return { ok: false, error: RENEWAL_CHANGED };
    const renewal = await findLifecycleRenewal(renewalId);
    if (!renewal) return { ok: false, error: "Record not found." };

    const updated = await getRenewalsRepository().lapseRenewal(renewal.id, actor.id, updatedAt);
    revalidateRenewalLifecycle(renewal.clientId);
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to mark renewal lapsed." };
  }
}
