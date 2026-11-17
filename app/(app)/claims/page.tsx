import { ClaimsLive } from "@/components/hub/screens/operations";
import { getAgentScope } from "@/lib/auth/agent-scope";
import { getClaimsRepository } from "@/lib/repositories/claims";

export const dynamic = "force-dynamic";

/** Claims tracker — wired to the claims table. */
export default async function Page() {
  const rows = await getClaimsRepository().list({ ownerUserId: await getAgentScope() });
  return <ClaimsLive rows={rows} />;
}
