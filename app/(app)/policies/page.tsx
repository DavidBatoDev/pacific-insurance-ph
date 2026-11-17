import { PoliciesLive } from "@/components/hub/screens/operations";
import { getAgentScope } from "@/lib/auth/agent-scope";
import { getPoliciesRepository } from "@/lib/repositories/policies";

export const dynamic = "force-dynamic";

/** Policies register — wired to the policies table. */
export default async function Page() {
  const rows = await getPoliciesRepository().list({ ownerUserId: await getAgentScope() });
  return <PoliciesLive rows={rows} />;
}
