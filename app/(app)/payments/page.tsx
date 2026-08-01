import { PaymentsLive } from "@/components/hub/screens/payments-live";
import { getCommissionsRepository, getPaymentsRepository } from "@/lib/repositories/payments";
import { getExternalContactsRepository } from "@/lib/repositories/external-contacts";

export const dynamic = "force-dynamic";

/** Payments — Collections + Commissions over real payment/commission rows. */
export default async function Page() {
  const [payments, commissions, contacts] = await Promise.all([
    getPaymentsRepository().list(),
    getCommissionsRepository().list(),
    getExternalContactsRepository().list({ status: "Active", contactTypes: ["Commission Contact"] }),
  ]);
  return <PaymentsLive payments={payments} commissions={commissions} commissionContacts={contacts} />;
}
