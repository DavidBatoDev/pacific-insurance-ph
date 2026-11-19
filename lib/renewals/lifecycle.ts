import type { Renewal } from "@/lib/repositories/renewals/renewal.entity";

/** Client-safe renewal lifecycle predicates shared by the queue, reports and the completion form. */

const CLOSED_STATUSES: readonly string[] = ["Paid", "Renewed", "Lapsed"];

/** Same wording as `complete_renewal`; SQL stays authoritative. */
export const RENEWED_STATUS_ERROR = "Only a paid renewal can be marked renewed.";
export const RENEWED_EXPIRY_ERROR = "New expiry must be after the current renewal dates and today.";

/** Today's calendar date in Manila (YYYY-MM-DD), the agency's business day. */
export function manilaTodayIso(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

/** Paid and Renewed both count as retained in renewal reporting. */
export function isRetainedRenewal(status: string): boolean {
  return status === "Paid" || status === "Renewed";
}

/** An unpaid cycle whose due date is before today (Manila) can be closed as Lapsed. */
export function canMarkLapsed(
  renewal: Pick<Renewal, "status" | "renewalDueDate">,
  todayIso: string,
): boolean {
  return !CLOSED_STATUSES.includes(renewal.status) && !!renewal.renewalDueDate && renewal.renewalDueDate < todayIso;
}

type QueueCycle = Pick<Renewal, "policyId" | "status" | "renewalDueDate" | "renewalCompletedDate" | "createdAt">;
export type RenewalQueueRow<T extends QueueCycle = Renewal> = T & { lastRenewedDate: string | null };

/** Later due date wins; a missing due date sorts first; creation time breaks ties. */
const laterCycle = <T extends QueueCycle>(a: T, b: T): T =>
  (a.renewalDueDate ?? "") !== (b.renewalDueDate ?? "")
    ? ((a.renewalDueDate ?? "") > (b.renewalDueDate ?? "") ? a : b)
    : (a.createdAt >= b.createdAt ? a : b);

/**
 * The renewal queue shows one row per policy: its open cycle (SQL allows at most one), else its
 * latest closed cycle. Earlier cycles remain for the timeline and reports; each row carries the
 * latest completion date among its policy's other cycles, so a just-renewed policy reads as renewed.
 */
export function currentRenewalPerPolicy<T extends QueueCycle>(rows: readonly T[]): RenewalQueueRow<T>[] {
  const byPolicy = new Map<string, T[]>();
  for (const row of rows) {
    const cycles = byPolicy.get(row.policyId);
    if (cycles) cycles.push(row);
    else byPolicy.set(row.policyId, [row]);
  }
  return [...byPolicy.values()].map((cycles) => {
    const current = cycles.find((c) => !CLOSED_STATUSES.includes(c.status)) ?? cycles.reduce(laterCycle);
    const renewedDates = cycles
      .filter((c) => c !== current && c.status === "Renewed" && c.renewalCompletedDate)
      .map((c) => c.renewalCompletedDate as string)
      .sort();
    return { ...current, lastRenewedDate: renewedDates.at(-1) ?? null };
  });
}

/** A real calendar date, YYYY-MM-DD, years 0001–9999 (strict round-trip, no overflow dates). */
function isRealCalendarDate(value: string): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Client-side pre-check for "Mark renewed". Null means acceptable. The database re-checks against
 * the policy's current dates and the live revision, so this only spares a round trip.
 */
export function renewedExpiryProblem(
  renewal: Pick<Renewal, "status" | "renewalDueDate" | "policyExpiryDate">,
  newExpiry: string,
  todayIso: string,
): string | null {
  if (renewal.status !== "Paid") return RENEWED_STATUS_ERROR;
  if (!isRealCalendarDate(newExpiry)) return RENEWED_EXPIRY_ERROR;
  const floors = [todayIso, renewal.renewalDueDate, renewal.policyExpiryDate];
  for (const floor of floors) {
    if (floor && newExpiry <= floor) return RENEWED_EXPIRY_ERROR;
  }
  return null;
}
