import Link from "next/link";

import { Avatar, Card, CardHead, PageHead } from "@/components/hub/primitives";
import { getClientsRepository } from "@/lib/repositories/clients";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const clients = query ? await getClientsRepository().search(query, 30) : [];

  return (
    <div>
      <PageHead
        iconName="search"
        title="Search"
        sub={query ? `Results for “${query}”` : "Type a query in the top bar"}
        draft={false}
      />

      {query && clients.length === 0 && (
        <Card className="p-8 text-center text-[13px] text-muted-foreground">
          No clients matched “{query}”.
        </Card>
      )}

      {clients.length > 0 && (
        <Card className="overflow-hidden">
          <CardHead iconName="users" title="Clients" count={clients.length} />
          <div>
            {clients.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="flex items-center gap-3 border-b border-border-soft px-[18px] py-3 transition-colors last:border-b-0 hover:bg-hover"
              >
                <Avatar name={c.fullName} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{c.fullName}</div>
                  <div className="text-[11.5px] text-subtle">
                    {[c.referenceNo, c.email, c.mobileNumber].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span className="ml-auto whitespace-nowrap text-[11.5px] text-subtle">
                  {c.clientType}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
