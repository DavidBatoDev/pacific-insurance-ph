import { ApplicationsLive } from "@/components/hub/screens/operations";
import { getAgentScope } from "@/lib/auth/agent-scope";
import { getApplicationsRepository } from "@/lib/repositories/applications";

export const dynamic = "force-dynamic";

/** Applications register — wired to the applications table. */
export default async function Page() {
  const rows = await getApplicationsRepository().list({ ownerUserId: await getAgentScope() });
  return <ApplicationsLive rows={rows} />;
}
