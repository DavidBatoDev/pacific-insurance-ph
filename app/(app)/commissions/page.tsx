import { CommissionsLive } from "@/components/hub/screens/commissions-live";
import { loadCommissionTracker } from "@/lib/queries/commission-tracker";

export const dynamic = "force-dynamic";

/** Standalone tracker using the same protected payload as the Payments tab. */
export default async function Page() {
  const { commissions, commissionContacts } = await loadCommissionTracker();
  return <CommissionsLive commissions={commissions} commissionContacts={commissionContacts} />;
}
