import { CommissionsLive } from "@/components/hub/screens/commissions-live";
import { getCommissionsRepository } from "@/lib/repositories/payments";
import { getExternalContactsRepository } from "@/lib/repositories/external-contacts";

export const dynamic = "force-dynamic";

/** Standalone commission tracker over the existing commissions repository. */
export default async function Page() {
  const [commissions, contacts] = await Promise.all([getCommissionsRepository().list(), getExternalContactsRepository().list({ status: "Active", contactTypes: ["Commission Contact"] })]);
  return <CommissionsLive commissions={commissions} commissionContacts={contacts} />;
}
