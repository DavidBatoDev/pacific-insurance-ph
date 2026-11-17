import "server-only";

import { getCurrentUser } from "@/lib/auth/current-user";
import { toAppRole } from "@/lib/auth/permissions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Agent row scoping (Phase J9). An Agent (DB role `Viewer`) works only their own book: a record is
 * theirs when its client's `assigned_user_id` is the agent. Group accounts and tasks carry their own
 * owner column. Admin and Staff see the whole agency book. The real DB role decides; the "View as"
 * persona preview never widens or narrows what the server returns.
 */

/** Deliberately indistinguishable from a missing record, so ids of other agents' records leak nothing. */
export class RecordAccessError extends Error {
  constructor() {
    super("Record not found.");
    this.name = "RecordAccessError";
  }
}

export type ScopedRecordKind =
  | "client" | "application" | "policy" | "renewal" | "claim" | "travel"
  | "payment" | "commission" | "document" | "group" | "task";

/** The signed-in agent's user id, or null when the account sees the whole book (Admin, Staff). */
export async function getAgentScope(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) throw new RecordAccessError();
  return toAppRole(user.role) === "agent" ? user.id : null;
}

const CLIENT_COLUMN = {
  application: "applications",
  policy: "policies",
  renewal: "renewals",
  claim: "claims",
  travel: "travel_requests",
  payment: "payments",
  commission: "commissions",
  document: "documents",
} as const;

async function clientOwner(clientId: string | null): Promise<string | null> {
  if (!clientId) return null;
  const { data } = await getSupabaseAdmin().from("clients").select("assigned_user_id").eq("id", clientId).maybeSingle();
  return data?.assigned_user_id ?? null;
}

/** Whether `agentId` owns the record. Unknown ids and records without a client are not owned. */
export async function agentOwnsRecord(agentId: string, kind: ScopedRecordKind, id: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (kind === "client") return (await clientOwner(id)) === agentId;
  if (kind === "group") {
    const { data } = await db.from("group_accounts").select("assigned_user_id").eq("id", id).maybeSingle();
    return data?.assigned_user_id === agentId;
  }
  if (kind === "task") {
    const { data } = await db.from("tasks").select("assigned_user_id, client_id").eq("id", id).maybeSingle();
    return !!data && (data.assigned_user_id === agentId || (await clientOwner(data.client_id)) === agentId);
  }
  const { data } = await db.from(CLIENT_COLUMN[kind]).select("client_id").eq("id", id).maybeSingle();
  return (await clientOwner(data?.client_id ?? null)) === agentId;
}

/**
 * Throws `RecordAccessError` unless the signed-in account may use this record. A no-op lookup-free
 * pass for Admin and Staff. Call it in every Server Action, route handler and record page that
 * takes a record id from the browser, before reading or writing that record.
 */
export async function assertRecordAccess(kind: ScopedRecordKind, id: string | null | undefined): Promise<void> {
  const agentId = await getAgentScope();
  if (agentId === null) return;
  if (!id || !(await agentOwnsRecord(agentId, kind, id))) throw new RecordAccessError();
}
