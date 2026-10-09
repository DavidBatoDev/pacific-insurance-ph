import { RenewalsLive } from "@/components/hub/screens/operations";
import { getRenewalsRepository } from "@/lib/repositories/renewals";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toAppRole } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/** Renewals queue — wired to the renewals table. */
export default async function Page() {
  const [rows, actor] = await Promise.all([getRenewalsRepository().list(), getCurrentUser()]);
  return <RenewalsLive rows={rows} canSyncPolicies={!!actor && toAppRole(actor.role) === "admin"} />;
}
