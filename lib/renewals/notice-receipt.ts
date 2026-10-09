import type { Renewal, RenewalUpdate } from "@/lib/repositories/renewals/renewal.entity";

/** Validate a calendar date and derive only the receipt-owned fields. Null means no mutation. */
export function noticeReceiptPatch(
  renewal: Pick<Renewal, "noticeReceivedDate" | "status">,
  receivedDate: string,
): Pick<RenewalUpdate, "noticeReceivedDate" | "status"> | null {
  const error = "Notice received must be a valid date.";
  if (typeof receivedDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(receivedDate) || receivedDate.startsWith("0000-")) {
    throw new Error(error);
  }
  const date = new Date(`${receivedDate}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== receivedDate) {
    throw new Error(error);
  }
  if (renewal.status === "Upcoming") {
    return { noticeReceivedDate: receivedDate, status: "Notice Received" };
  }
  if (renewal.noticeReceivedDate === receivedDate) return null;
  return { noticeReceivedDate: receivedDate };
}
