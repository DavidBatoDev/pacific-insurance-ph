import Link from "next/link";

import type { IconName } from "@/components/hub/icons";
import { Avatar, Card, CardHead, PageHead, StatusBadge } from "@/components/hub/primitives";
import { globalSearch, type SearchHit, type SearchKind } from "@/lib/queries/global-search";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<SearchKind, IconName> = {
  client: "users",
  group: "building",
  policy: "shield",
  application: "fileText",
  claim: "clipboard",
  renewal: "refresh",
  travel: "plane",
};

function hitHref(hit: SearchHit): string {
  if (hit.kind === "group") return `/group/${hit.id}`;
  if (hit.clientId) return `/clients/${hit.clientId}`;
  return "/clients";
}

/** Full-page "view all results" fallback for the topbar dropdown / ⌘K palette. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const groups = query ? await globalSearch(query, 30) : [];

  return (
    <div>
      <PageHead
        iconName="search"
        title="Search"
        sub={query ? `Results for “${query}”` : "Type a query in the top bar"}
        draft={false}
      />

      {query && groups.length === 0 && (
        <Card className="p-8 text-center text-[13px] text-muted-foreground">
          No results for “{query}” — try a name, email, or a POL- / CLM- / APP- number.
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <Card key={g.kind} className="overflow-hidden">
            <CardHead iconName={KIND_ICON[g.kind]} title={g.label} count={g.hits.length + g.more} />
            <div>
              {g.hits.map((hit) => (
                <Link
                  key={hit.kind + hit.id}
                  href={hitHref(hit)}
                  className="flex items-center gap-3 border-b border-border-soft px-[18px] py-3 transition-colors last:border-b-0 hover:bg-hover"
                >
                  <Avatar name={hit.title} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">{hit.title}</div>
                    <div className="text-[11.5px] text-subtle">{hit.sub}</div>
                  </div>
                  {hit.badge && <StatusBadge status={hit.badge} />}
                </Link>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
