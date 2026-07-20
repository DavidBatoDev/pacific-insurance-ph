import { ClientsList } from "@/components/clients/clients-list";
import {
  ClientsViewToggle,
  GroupAccountsList,
} from "@/components/hub/screens/group-accounts-list";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getGroupsRepository } from "@/lib/repositories/groups";

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

  const { rows, total } = await getClientsRepository().list({
    limit: 200,
    orderBy: "created_at",
    ascending: false,
  });

  return (
    <div>
      <ClientsViewToggle view="individuals" />
      <ClientsList clients={rows} total={total} />
    </div>
  );
}
