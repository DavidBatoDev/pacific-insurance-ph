import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientForm } from "@/components/clients/client-form";
import { PageHead } from "@/components/hub/primitives";
import { getClientsRepository } from "@/lib/repositories/clients";

export const dynamic = "force-dynamic";

export default async function EditClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const client = await getClientsRepository().findById(id);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/clients/${id}${from === "prospects" ? "?from=prospects" : ""}`}
        className="mb-3 inline-block text-[12.5px] font-semibold text-subtle hover:text-foreground"
      >
        ← {client.fullName}
      </Link>
      <PageHead iconName="users" title={`Edit ${client.fullName}`} draft={false} />
      <ClientForm client={client} from={from === "prospects" ? "prospects" : undefined} />
    </div>
  );
}
