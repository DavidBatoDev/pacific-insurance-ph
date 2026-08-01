import { CommissionsLive } from "@/components/hub/screens/commissions-live";
import { getCommissionsRepository } from "@/lib/repositories/payments";

export const dynamic = "force-dynamic";

/** Standalone commission tracker over the existing commissions repository. */
export default async function Page() {
  const commissions = await getCommissionsRepository().list();
  return <CommissionsLive commissions={commissions} />;
}
