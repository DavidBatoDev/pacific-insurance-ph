import { notFound } from "next/navigation";

import { PaymentsLive } from "@/components/hub/screens/payments-live";
import { assertRecordAccess, getAgentScope, RecordAccessError } from "@/lib/auth/agent-scope";
import { getPaymentsRepository } from "@/lib/repositories/payments";
import { getTravelRepository } from "@/lib/repositories/travel";
import { loadCommissionTracker } from "@/lib/queries/commission-tracker";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `?travelRequestId=` narrows Collections to one trip. Anything but a single, accessible, existing
 * Travel request is a 404 rather than a silent fall-back to every payment.
 */
async function resolveTravelFilter(value: string | string[]): Promise<{ id: string; referenceNo: string | null }> {
  if (typeof value !== "string" || !UUID.test(value)) notFound();
  try {
    await assertRecordAccess("travel", value);
  } catch (error) {
    if (error instanceof RecordAccessError) notFound();
    throw error;
  }
  const travel = await getTravelRepository().findById(value);
  if (!travel) notFound();
  return { id: travel.id, referenceNo: travel.referenceNo };
}

/** Payments — Collections + Commissions over real payment/commission rows. */
export default async function Page({ searchParams }: { searchParams: Promise<{ travelRequestId?: string | string[] }> }) {
  const { travelRequestId } = await searchParams;
  const travelFilter = travelRequestId === undefined ? null : await resolveTravelFilter(travelRequestId);
  const [payments, { commissions, commissionContacts }] = await Promise.all([
    travelFilter
      ? getPaymentsRepository().listByTravelRequest(travelFilter.id)
      : getPaymentsRepository().list({ ownerUserId: await getAgentScope() }),
    loadCommissionTracker(),
  ]);
  return <PaymentsLive payments={payments} commissions={commissions} commissionContacts={commissionContacts} travelFilter={travelFilter} />;
}
