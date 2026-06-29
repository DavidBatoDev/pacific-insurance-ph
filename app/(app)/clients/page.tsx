import { ClientsList } from "@/components/clients/clients-list";
import { getClientsRepository } from "@/lib/repositories/clients";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { rows, total } = await getClientsRepository().list({
    limit: 200,
    orderBy: "created_at",
    ascending: false,
  });

  return <ClientsList clients={rows} total={total} />;
}
