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
    .select("id, activity_type, summary, client_visible, created_at, actor_id")
    .eq("scope_type", scopeType)
    .eq("scope_id", scopeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw toRepositoryError("getActivity", error);
  const rows = data ?? [];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((v): v is string => !!v))];
  const names = new Map<string, string>();
  if (actorIds.length) {
    const { data: users } = await admin.from("users").select("id, full_name").in("id", actorIds);
    for (const u of users ?? []) names.set(u.id, u.full_name);
  }

  return rows.map((r) => ({
    id: r.id,
    activityType: r.activity_type,
    summary: r.summary,
    actorName: r.actor_id ? (names.get(r.actor_id) ?? null) : null,
    clientVisible: r.client_visible,
    createdAt: r.created_at,
  }));
}
