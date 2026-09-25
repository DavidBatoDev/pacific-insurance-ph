import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toRepositoryError } from "@/lib/repositories/types";
import type { ActivityScope } from "./log";

export interface TimelineEntry {
  id: string;
  activityType: string;
  summary: string;
  actorName: string | null;
  clientVisible: boolean;
  createdAt: string;
}

/** Read a record's activity timeline (newest first), resolving actor names. */
export async function getActivity(
  scopeType: ActivityScope,
  scopeId: string,
  limit = 50,
): Promise<TimelineEntry[]> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("activity_timeline")
    .select("id, activity_type, summary, client_visible, created_at, actor:users!activity_timeline_actor_id_fkey(full_name)")
    .eq("scope_type", scopeType)
    .eq("scope_id", scopeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw toRepositoryError("getActivity", error);

  return (data ?? []).map((r) => ({
    id: r.id,
    activityType: r.activity_type,
    summary: r.summary,
    actorName: r.actor?.full_name ?? null,
    clientVisible: r.client_visible,
    createdAt: r.created_at,
  }));
}
