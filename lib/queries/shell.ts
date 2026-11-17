import "server-only";

import { ownerScopedSelect, ownerScopeFilter } from "@/lib/repositories/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Live counts rendered in the authenticated application shell. */
export interface ShellStats {
  leads: number | null;
  clients: number | null;
  applications: number | null;
  renewals: number | null;
  claims: number | null;
  travel: number | null;
  tasks: number | null;
}

/**
 * Keep shell chrome honest without loading full repository rows on every route.
 * A failed count stays null so the client can omit it rather than claim there is no work.
 * `ownerUserId` (an Agent, Phase J9) narrows every badge to that agent's book.
 */
export async function getShellStats(ownerUserId: string | null = null): Promise<ShellStats> {
  const supabase = getSupabaseAdmin();
  const head = { count: "exact" as const, head: true };
  const select = ownerScopedSelect("id", ownerUserId);
  const clientsOf = () => {
    const query = supabase.from("clients").select("*", head);
    return ownerUserId ? query.eq("assigned_user_id", ownerUserId) : query;
  };
  // A task is an agent's when assigned to them or on one of their clients.
  const tasksQuery = async () => {
    const query = supabase.from("tasks").select("*", head).in("status", ["Open", "In Progress"]);
    if (!ownerUserId) return query;
    const { data, error } = await supabase.from("clients").select("id").eq("assigned_user_id", ownerUserId);
    if (error) return { count: null, error };
    const ids = (data ?? []).map((row) => row.id);
    return query.or(ids.length ? `assigned_user_id.eq.${ownerUserId},client_id.in.(${ids.join(",")})` : `assigned_user_id.eq.${ownerUserId}`);
  };

  const [leads, clients, applications, renewals, claims, travel, tasks] = await Promise.all([
    clientsOf().eq("lifecycle_stage", "Lead"),
    clientsOf().eq("status", "Active"),
    ownerScopeFilter(supabase.from("applications").select(select, head).not("status", "in", '("Approved","Lead")'), ownerUserId),
    ownerScopeFilter(supabase.from("renewals").select(select, head).not("status", "in", '("Renewed","Lapsed")'), ownerUserId),
    ownerScopeFilter(supabase.from("claims").select(select, head).not("status", "in", '("Closed","Rejected","Credited")'), ownerUserId),
    ownerScopeFilter(supabase.from("travel_requests").select(select, head).neq("status", "Policy Issued"), ownerUserId),
    tasksQuery(),
  ]);

  const count = (result: { count: number | null; error: unknown }) =>
    result.error ? null : result.count;

  return {
    leads: count(leads),
    clients: count(clients),
    applications: count(applications),
    renewals: count(renewals),
    claims: count(claims),
    travel: count(travel),
    tasks: count(tasks),
  };
}
