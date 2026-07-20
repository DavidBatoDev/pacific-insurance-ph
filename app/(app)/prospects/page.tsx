import { ProspectsLive } from "@/components/hub/screens/prospects-live";
import { leadExitCounts, recentLeadActivity } from "@/lib/queries/lead-activity";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getUsersRepository } from "@/lib/repositories/users";

export const dynamic = "force-dynamic";

/** Lead Lifecycle — Board / List / Forecast over real lead records (wired). */
export default async function Page() {
  const [leads, users, activity, exits] = await Promise.all([
    getClientsRepository().listLeads(),
    getUsersRepository().list({ limit: 50 }),
    recentLeadActivity(),
    leadExitCounts(),
  ]);
  const userNames = Object.fromEntries(users.rows.map((u) => [u.id, u.fullName]));
  return <ProspectsLive leads={leads} userNames={userNames} activity={activity} exits={exits} />;
}
