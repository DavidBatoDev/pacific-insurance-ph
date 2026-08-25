import "server-only";

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
 */
export async function getShellStats(): Promise<ShellStats> {
  const supabase = getSupabaseAdmin();
  const head = { count: "exact" as const, head: true };

  const [leads, clients, applications, renewals, claims, travel, tasks] = await Promise.all([
    supabase.from("clients").select("*", head).eq("lifecycle_stage", "Lead"),
    supabase.from("clients").select("*", head),
    supabase.from("applications").select("*", head).not("status", "in", '("Approved","Lead")'),
    supabase.from("renewals").select("*", head).not("status", "in", '("Renewed","Lapsed")'),
    supabase.from("claims").select("*", head).not("status", "in", '("Closed","Rejected","Credited")'),
    supabase.from("travel_requests").select("*", head).neq("status", "Policy Issued"),
    supabase.from("tasks").select("*", head).in("status", ["Open", "In Progress"]),
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
