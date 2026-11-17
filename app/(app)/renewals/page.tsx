import { RenewalsLive } from "@/components/hub/screens/operations";
import { getRenewalsRepository } from "@/lib/repositories/renewals";
import { getAgentScope } from "@/lib/auth/agent-scope";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toAppRole } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/** Renewals queue — wired to the renewals table. */
export default async function Page() {
  const [rows, actor] = await Promise.all([
    getAgentScope().then((ownerUserId) => getRenewalsRepository().list({ ownerUserId })),
    getCurrentUser(),
  ]);
  return <RenewalsLive rows={rows} canSyncPolicies={!!actor && toAppRole(actor.role) === "admin"} />;
}
