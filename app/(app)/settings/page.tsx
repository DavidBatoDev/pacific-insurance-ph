import { SettingsLive } from "@/components/hub/screens/settings-live";
import { getPaymentChannelsRepository } from "@/lib/repositories/payment-channels";
import { getUsersRepository } from "@/lib/repositories/users";

export const dynamic = "force-dynamic";

/** Settings — 6-tab configuration; Team + Payment Channels are wired. */
export default async function Page() {
  const [{ rows }, channels] = await Promise.all([
    getUsersRepository().list({ limit: 50 }),
    getPaymentChannelsRepository().list(),
  ]);
  return <SettingsLive users={rows} channels={channels} />;
}
