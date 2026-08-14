import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Client } from "@/lib/repositories/clients";

/**
 * `Unresponsive` inference (`../../docs/lead-stage-status.md`): "System: N follow-ups with no
 * reply — no button, an automatic count." Computed live on every read, not written back to
 * `clients.lead_status` and not run on a schedule — this app has no background-job
 * infrastructure. Leaving the stored value untouched also means the existing win-back checks in
 * `app/(app)/clients/engage-actions.ts` (`client.leadStatus === "Attempted"`, etc.) keep matching
 * unmodified once a reply lands — the computed status simply stops flipping on the next read.
 */

/** N (decided): 3 outbound touches with nothing breaking the streak. */
const UNRESPONSIVE_THRESHOLD = 3;

/**
 * The only two spec edges into Unresponsive (`Attempted → Unresponsive`, `Nurturing →
 * Unresponsive`). `New` moves to `Attempted` on first outbound touch before 3 could ever log, and
 * `Connected`/`Qualified` have no such edge at all — so the inference is a no-op outside these two.
 */
const UNRESPONSIVE_SOURCE_STATUSES = new Set(["Attempted", "Nurturing"]);

interface CommunicationRow {
  client_id: string | null;
  direction: string | null;
  channel: string | null;
  subject: string | null;
  occurred_at: string;
}

/** A Reached call is logged Outbound (Eman placed it), but it *is* contact — it resets the streak
 * exactly like an inbound reply. `logCallAction` (`engage-actions.ts`) is the only writer and
 * always shapes the subject this way. */
function isReachedCall(row: CommunicationRow): boolean {
  return row.channel === "Phone" && row.subject === "Call logged — Reached";
}

/** Walks a lead's communications oldest-first, counting outbound touches since the last inbound
 * reply or Reached call. True once that streak reaches {@link UNRESPONSIVE_THRESHOLD}. */
function hasUnansweredStreak(rows: CommunicationRow[]): boolean {
  let streak = 0;
  for (const row of [...rows].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
    if (row.direction === "Inbound") streak = 0;
    else if (row.direction === "Outbound") streak = isReachedCall(row) ? 0 : streak + 1;
  }
  return streak >= UNRESPONSIVE_THRESHOLD;
}

function isInferenceCandidate(client: Client): boolean {
  return (
    client.lifecycleStage === "Lead" &&
    !!client.leadStatus &&
    UNRESPONSIVE_SOURCE_STATUSES.has(client.leadStatus)
  );
}

function applyInference(client: Client, rows: CommunicationRow[]): Client {
  if (!isInferenceCandidate(client) || !hasUnansweredStreak(rows)) return client;
  return { ...client, leadStatus: "Unresponsive" };
}

/** Applies the on-read Unresponsive inference to one lead (Contact Profile). Pass-through for
 * anything that isn't a candidate — no query is issued. */
export async function withInferredLeadStatus(client: Client): Promise<Client> {
  if (!isInferenceCandidate(client)) return client;

  const { data } = await getSupabaseAdmin()
    .from("communications")
    .select("client_id, direction, channel, subject, occurred_at")
    .eq("client_id", client.id)
    .order("occurred_at", { ascending: true });

  return applyInference(client, data ?? []);
}

/** Batched version for the Prospects board — one communications query for every candidate lead
 * instead of N+1. */
export async function withInferredLeadStatuses(clients: Client[]): Promise<Client[]> {
  const candidateIds = clients.filter(isInferenceCandidate).map((c) => c.id);
  if (!candidateIds.length) return clients;

  const { data } = await getSupabaseAdmin()
    .from("communications")
    .select("client_id, direction, channel, subject, occurred_at")
    .in("client_id", candidateIds)
    .order("occurred_at", { ascending: true });

  const byClient = new Map<string, CommunicationRow[]>();
  for (const row of data ?? []) {
    if (!row.client_id) continue;
    const rows = byClient.get(row.client_id);
    if (rows) rows.push(row);
    else byClient.set(row.client_id, [row]);
  }

  return clients.map((client) => applyInference(client, byClient.get(client.id) ?? []));
}
