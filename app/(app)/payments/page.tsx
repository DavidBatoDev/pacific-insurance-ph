import { PaymentsLive } from "@/components/hub/screens/payments-live";
import { getCommissionsRepository, getPaymentsRepository } from "@/lib/repositories/payments";

export const dynamic = "force-dynamic";

/** Payments — Collections + Commissions over real payment/commission rows. */
export default async function Page() {
  const [payments, commissions] = await Promise.all([
    getPaymentsRepository().list(),
    getCommissionsRepository().list(),
  ]);
  return <PaymentsLive payments={payments} commissions={commissions} />;
}
