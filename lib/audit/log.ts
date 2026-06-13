import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

/**
 * Immutable audit trail writer. Call from every mutating Server Action.
 *
 * Audit logging must never break the main flow, so failures are logged and
 * swallowed rather than thrown.
 */
export interface AuditEntry {
  actorId?: string | null;
  action: string;
  tableName?: string | null;
  recordId?: string | null;
  previousValue?: Json;
  newValue?: Json;
  ipAddress?: string | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("audit_logs")
    .insert({
      actor_id: entry.actorId ?? null,
      action: entry.action,
      table_name: entry.tableName ?? null,
      record_id: entry.recordId ?? null,
      previous_value: entry.previousValue ?? null,
      new_value: entry.newValue ?? null,
      ip_address: entry.ipAddress ?? null,
    });

  if (error) {
    console.error("recordAudit failed:", error.message);
  }
}
