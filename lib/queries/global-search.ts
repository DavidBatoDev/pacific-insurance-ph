import "server-only";

import { getClientsRepository } from "@/lib/repositories/clients";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Global multi-entity search backing the topbar dropdown, the ⌘K palette and
 * the /search page (design command-palette.jsx CK_search, wired to Supabase).
 *
 * People match on name/email/mobile/reference; the operational registers match
 * on their reference numbers (POL- / APP- / CLM- / RNW- / TRV-, policy number,
 * travel destination); group accounts on company name/reference. Each group is
 * queried in parallel and capped, with the overflow count for "+N more".
 */

export type SearchKind =
  | "client"
  | "group"
  | "policy"
  | "application"
  | "claim"
  | "renewal"
  | "travel";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  /** Route target: client profile / group account (operational rows carry their client's id). */
  clientId: string | null;
  title: string;
  sub: string;
  badge: string | null;
}

export interface SearchGroup {
  kind: SearchKind;
  label: string;
  hits: SearchHit[];
  /** How many further matches were cut off by the cap. */
  more: number;
}

const clientName = (c: { first_name: string; last_name: string } | null) =>
  c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : "—";

export async function globalSearch(query: string, cap = 5): Promise<SearchGroup[]> {
  // Strip characters that would break the PostgREST `or` filter grammar.
  const term = query.replace(/[,()%*]/g, " ").trim();
  if (!term) return [];
  const like = `%${term}%`;
  const db = getSupabaseAdmin();
  const fetch = cap + 1; // one extra row signals "+N more"

  const [clients, groups, policies, applications, claims, renewals, travel] = await Promise.all([
    getClientsRepository().search(term, fetch),
    db
      .from("group_accounts")
      .select("id, name, reference_no, status, group_members (count)")
      .or(`name.ilike.${like},reference_no.ilike.${like}`)
      .limit(fetch),
    db
      .from("policies")
      .select("id, client_id, reference_no, policy_number, status, clients (first_name, last_name)")
      .or(`reference_no.ilike.${like},policy_number.ilike.${like}`)
      .limit(fetch),
    db
      .from("applications")
      .select("id, client_id, reference_no, status, clients (first_name, last_name)")
      .ilike("reference_no", like)
      .limit(fetch),
    db
      .from("claims")
      .select("id, client_id, reference_no, status, clients (first_name, last_name), policies (reference_no)")
      .ilike("reference_no", like)
      .limit(fetch),
    db
      .from("renewals")
      .select("id, client_id, reference_no, status, renewal_due_date, clients (first_name, last_name)")
      .ilike("reference_no", like)
      .limit(fetch),
    db
      .from("travel_requests")
      .select("id, client_id, reference_no, destination, status, clients (first_name, last_name)")
      .or(`reference_no.ilike.${like},destination.ilike.${like}`)
      .limit(fetch),
  ]);

  for (const r of [groups, policies, applications, claims, renewals, travel]) {
    if (r.error) throw new Error(`globalSearch: ${r.error.message}`);
  }

  const group = (kind: SearchKind, label: string, hits: SearchHit[]): SearchGroup => ({
    kind,
    label,
    hits: hits.slice(0, cap),
    more: Math.max(0, hits.length - cap),
  });

  return [
    group(
      "client",
      "People",
      clients.map((c) => ({
        kind: "client" as const,
        id: c.id,
        clientId: c.id,
        title: c.fullName,
        sub: [c.email, c.referenceNo ? `#${c.referenceNo}` : null].filter(Boolean).join(" · ") || c.clientType,
        badge: c.lifecycleStage,
      })),
    ),
    group(
      "group",
      "Group Accounts",
      (groups.data ?? []).map((g) => ({
        kind: "group" as const,
        id: g.id,
        clientId: null,
        title: g.name,
        sub: [g.reference_no, `${g.group_members?.[0]?.count ?? 0} members`].filter(Boolean).join(" · "),
        badge: g.status,
      })),
    ),
    group(
      "policy",
      "Policies",
      (policies.data ?? []).map((p) => ({
        kind: "policy" as const,
        id: p.id,
        clientId: p.client_id,
        title: p.reference_no ?? p.policy_number ?? "Policy",
        sub: [clientName(p.clients), p.policy_number].filter(Boolean).join(" · "),
        badge: p.status,
      })),
    ),
    group(
      "application",
      "Applications",
      (applications.data ?? []).map((a) => ({
        kind: "application" as const,
        id: a.id,
        clientId: a.client_id,
        title: a.reference_no ?? "Application",
        sub: clientName(a.clients),
        badge: a.status,
      })),
    ),
    group(
      "claim",
      "Claims",
      (claims.data ?? []).map((c) => ({
        kind: "claim" as const,
        id: c.id,
        clientId: c.client_id,
        title: c.reference_no ?? "Claim",
        sub: [clientName(c.clients), c.policies?.reference_no].filter(Boolean).join(" · "),
        badge: c.status,
      })),
    ),
    group(
      "renewal",
      "Renewals",
      (renewals.data ?? []).map((r) => ({
        kind: "renewal" as const,
        id: r.id,
        clientId: r.client_id,
        title: r.reference_no ?? "Renewal",
        sub: [clientName(r.clients), r.renewal_due_date ? `due ${r.renewal_due_date}` : null]
          .filter(Boolean)
          .join(" · "),
        badge: r.status,
      })),
    ),
    group(
      "travel",
      "Travel",
      (travel.data ?? []).map((t) => ({
        kind: "travel" as const,
        id: t.id,
        clientId: t.client_id,
        title: t.reference_no ?? "Travel request",
        sub: [clientName(t.clients), t.destination].filter(Boolean).join(" · "),
        badge: t.status,
      })),
    ),
  ].filter((g) => g.hits.length > 0);
}
