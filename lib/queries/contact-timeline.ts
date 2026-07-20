import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * The Contact Profile timeline: communications rows (emails, logged messages,
 * calls) merged with activity_timeline entries (status changes, notes, tasks,
 * payments), newest first.
 */

export type TimelineKind =
  | "email" | "message" | "call" | "note" | "status" | "task" | "payment" | "doc";

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  /** Sent/Received tag for emails & messages. */
  direction: "sent" | "received" | null;
  title: string;
  body: string | null;
  actorName: string | null;
  at: string;
  atLabel: string;
}

const label = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function activityKind(activityType: string): TimelineKind {
  if (activityType.includes("task")) return "task";
  if (activityType.includes("payment")) return "payment";
  if (activityType.includes("document") || activityType.startsWith("doc")) return "doc";
  if (activityType === "contact.note" || activityType === "lead.note") return "note";
  if (
    activityType.includes("stage") ||
    activityType.includes("status") ||
    activityType.includes("created") ||
    activityType.includes("lost") ||
    activityType.includes("proposal") ||
    activityType.includes("flag")
  )
    return "status";
  return "note";
}

export async function getContactTimeline(clientId: string, limit = 60): Promise<TimelineEntry[]> {
  const supabase = getSupabaseAdmin();
  const [comms, activity] = await Promise.all([
    supabase
      .from("communications")
      .select("id, direction, channel, subject, summary, notes, occurred_at, related_user:users (full_name)")
      .eq("client_id", clientId)
      .order("occurred_at", { ascending: false })
      .limit(limit),
    supabase
      .from("activity_timeline")
      .select("id, activity_type, summary, created_at, actor:users (full_name)")
      .eq("scope_type", "client")
      .eq("scope_id", clientId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const entries: TimelineEntry[] = [];

  for (const c of comms.data ?? []) {
    const kind: TimelineKind =
      c.channel === "Phone" ? "call" : c.channel === "Gmail" ? "email" : "message";
    entries.push({
      id: "c-" + c.id,
      kind,
      direction: kind === "call" ? null : c.direction === "Inbound" ? "received" : "sent",
      title: c.subject ?? c.summary ?? "Communication",
      body: c.notes && c.notes !== c.subject ? c.notes : null,
      actorName: (c.related_user as { full_name: string } | null)?.full_name ?? null,
      at: c.occurred_at,
      atLabel: label(c.occurred_at),
    });
  }

  for (const a of activity.data ?? []) {
    entries.push({
      id: "a-" + a.id,
      kind: activityKind(a.activity_type),
      direction: null,
      title: a.summary,
      body: null,
      actorName: (a.actor as { full_name: string } | null)?.full_name ?? null,
      at: a.created_at,
      atLabel: label(a.created_at),
    });
  }

  return entries.sort((x, y) => y.at.localeCompare(x.at)).slice(0, limit);
}
