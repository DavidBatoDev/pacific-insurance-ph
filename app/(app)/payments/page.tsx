import { PaymentsLive } from "@/components/hub/screens/payments-live";
import { getPaymentsRepository } from "@/lib/repositories/payments";
import { loadCommissionTracker } from "@/lib/queries/commission-tracker";

export const dynamic = "force-dynamic";

/** Payments — Collections + Commissions over real payment/commission rows. */
export default async function Page() {
  const [payments, { commissions, commissionContacts }] = await Promise.all([
    getPaymentsRepository().list(),
    loadCommissionTracker(),
  ]);
  return <PaymentsLive payments={payments} commissions={commissions} commissionContacts={commissionContacts} />;
}
