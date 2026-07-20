import { SettingsLive } from "@/components/hub/screens/settings-live";
import { getUsersRepository } from "@/lib/repositories/users";

export const dynamic = "force-dynamic";

/** Settings — 6-tab workspace configuration; Team is wired to real users. */
export default async function Page() {
  const { rows } = await getUsersRepository().list({ limit: 50 });
  return <SettingsLive users={rows} />;
}
