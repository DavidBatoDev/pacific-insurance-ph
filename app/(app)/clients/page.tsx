import { ClientsList } from "@/components/clients/clients-list";
import {
  ClientsViewToggle,
  GroupAccountsList,
} from "@/components/hub/screens/group-accounts-list";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getGroupsRepository } from "@/lib/repositories/groups";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Clients directory with the Individuals / Group Accounts segments. */
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;

  if (view === "groups") {
    const groups = await getGroupsRepository().list();
    return <GroupAccountsList groups={groups} />;
  }

  const [{ rows, total }, memberships] = await Promise.all([
    getClientsRepository().list({ limit: 200, orderBy: "created_at", ascending: false }),
    getSupabaseAdmin()
      .from("group_members")
      .select("client_id, group_accounts (id, name)")
      .not("client_id", "is", null)
      .limit(1000),
  ]);
  const groupsByClient: Record<string, { id: string; name: string }> = {};
  for (const m of memberships.data ?? []) {
    if (m.client_id && m.group_accounts) groupsByClient[m.client_id] = m.group_accounts;
  }

  return (
    <div>
      <ClientsViewToggle view="individuals" />
      <ClientsList clients={rows} total={total} groupsByClient={groupsByClient} />
    </div>
  );
}
