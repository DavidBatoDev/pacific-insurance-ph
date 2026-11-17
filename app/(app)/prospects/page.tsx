import { ProspectsLive } from "@/components/hub/screens/prospects-live";
import { getAgentScope } from "@/lib/auth/agent-scope";
import { leadExitCounts, recentLeadActivity } from "@/lib/queries/lead-activity";
import { candidateLeadCommunications, withInferredLeadStatusesFrom } from "@/lib/queries/lead-status-inference";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getUsersRepository } from "@/lib/repositories/users";

export const dynamic = "force-dynamic";

/** Lead Lifecycle — Board / List / Forecast over real lead records (wired). */
export default async function Page() {
  const ownerUserId = await getAgentScope();
  const [rawLeads, users, activity, exits, communications] = await Promise.all([
    getClientsRepository().listLeads({ ownerUserId }),
    getUsersRepository().list({ limit: 50 }),
    recentLeadActivity(undefined, ownerUserId),
    leadExitCounts(ownerUserId),
    // Only joined onto the (already scoped) leads above to infer their status; never rendered alone.
    candidateLeadCommunications(),
  ]);
  const leads = withInferredLeadStatusesFrom(rawLeads, communications);
  const userNames = Object.fromEntries(users.rows.map((u) => [u.id, u.fullName]));
  return <ProspectsLive leads={leads} userNames={userNames} activity={activity} exits={exits} />;
}
