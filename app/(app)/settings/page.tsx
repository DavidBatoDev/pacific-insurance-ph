import { SettingsLive } from "@/components/hub/screens/settings-live";
import { getIntegrationSettingsRepository } from "@/lib/repositories/integration-settings";
import { getExternalContactsRepository } from "@/lib/repositories/external-contacts";
import { getPaymentChannelsRepository } from "@/lib/repositories/payment-channels";
import { getUsersRepository } from "@/lib/repositories/users";

export const dynamic = "force-dynamic";

/** Settings — 6-tab configuration; Team + Payment Channels are wired. */
export default async function Page() {
  const [{ rows }, channels, pacificCross, contacts] = await Promise.all([
    getUsersRepository().list({ limit: 50 }),
    getPaymentChannelsRepository().list(),
    getIntegrationSettingsRepository().getPacificCross(),
    getExternalContactsRepository().list(),
  ]);
  return <SettingsLive users={rows} channels={channels} pacificCross={pacificCross} contacts={contacts} />;
}
