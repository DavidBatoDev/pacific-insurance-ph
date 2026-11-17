import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface LeadActivityEntry {
  id: string;
  summary: string;
  actorName: string | null;
  when: string;
}

/**
 * Exit counters for the Lead Lifecycle funnel/KPIs. `ownerUserId` (Phase J9 agent scope) counts only
 * clients assigned to that user; null/undefined counts the whole agency book.
 */
export async function leadExitCounts(ownerUserId?: string | null): Promise<{ converted: number; lost: number }> {
  const supabase = getSupabaseAdmin();
  const count = () => {
    const query = supabase.from("clients").select("id", { count: "exact", head: true });
    return ownerUserId ? query.eq("assigned_user_id", ownerUserId) : query;
  };
  const [converted, lost] = await Promise.all([
    count().eq("lead_stage", "Converted"),
    count().eq("lifecycle_stage", "Lost"),
  ]);
  return { converted: converted.count ?? 0, lost: lost.count ?? 0 };
}

/**
 * Most recent lead-scoped timeline entries, joined with actor names. `ownerUserId` (Phase J9 agent
 * scope) keeps only entries on clients assigned to that user; null/undefined = whole agency book.
 */
export async function recentLeadActivity(limit = 8, ownerUserId?: string | null): Promise<LeadActivityEntry[]> {
  const db = getSupabaseAdmin();
  let query = db
    .from("activity_timeline")
    .select("id, summary, created_at, actor:users (full_name)")
    .like("activity_type", "lead.%");
  if (ownerUserId) {
    // Timeline scope ids are polymorphic (no FK to join through), so resolve the agent's clients first.
    const { data: owned, error: ownedError } = await db.from("clients").select("id").eq("assigned_user_id", ownerUserId);
    if (ownedError) return [];
    const ids = (owned ?? []).map((c) => c.id);
    if (!ids.length) return [];
    query = query.eq("scope_type", "client").in("scope_id", ids);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);

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
