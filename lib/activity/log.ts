import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

/** Record types a timeline entry can be scoped to. */
export type ActivityScope =
  | "client"
  | "application"
  | "policy"
  | "renewal"
  | "claim"
  | "travel_request"
  | "document"
  | "payment"
  | "relationship_activity"
  | "group_account";

/**
 * Human-friendly activity timeline writer. Call from Server Actions on
 * significant actions. `clientVisible` controls whether the entry will surface
 * in the future Client Hub. Failures are logged, not thrown.
 */
export interface ActivityEntry {
  scopeType: ActivityScope;
  scopeId: string;
  activityType: string;
  summary: string;
  actorId?: string | null;
  clientVisible?: boolean;
  metadata?: Json;
}

export async function recordActivity(entry: ActivityEntry): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("activity_timeline")
    .insert({
      scope_type: entry.scopeType,
      scope_id: entry.scopeId,
      activity_type: entry.activityType,
      summary: entry.summary,
      actor_id: entry.actorId ?? null,
      client_visible: entry.clientVisible ?? false,
      metadata: entry.metadata ?? null,
    });

  if (error) {
    console.error("recordActivity failed:", error.message);
  }
}
