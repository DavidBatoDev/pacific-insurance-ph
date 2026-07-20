import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface LeadActivityEntry {
  id: string;
  summary: string;
  actorName: string | null;
  when: string;
}

/** Exit counters for the Lead Lifecycle funnel/KPIs. */
export async function leadExitCounts(): Promise<{ converted: number; lost: number }> {
  const supabase = getSupabaseAdmin();
  const [converted, lost] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("lead_stage", "Converted"),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("lifecycle_stage", "Lost"),
  ]);
  return { converted: converted.count ?? 0, lost: lost.count ?? 0 };
}

/** Most recent lead-scoped timeline entries, joined with actor names. */
export async function recentLeadActivity(limit = 8): Promise<LeadActivityEntry[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("activity_timeline")
    .select("id, summary, created_at, actor:users (full_name)")
    .like("activity_type", "lead.%")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id,
    summary: r.summary,
    actorName: (r.actor as { full_name: string } | null)?.full_name ?? null,
    when: new Date(r.created_at).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  }));
}
