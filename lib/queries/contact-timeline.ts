import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * The Contact Profile timeline: communications rows (emails, logged messages,
 * calls) merged with activity_timeline entries (status changes, notes, tasks,
 * payments), newest first.
 */

export type TimelineKind =
  | "email" | "message" | "call" | "note" | "status" | "task" | "payment" | "doc";

/** Outcome tag: only `sent` means Gmail accepted it; `recorded` is historical without provider proof. */
export type TimelineStatus = "prepared" | "sending" | "sent" | "failed" | "unknown" | "logged" | "recorded" | "received";

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  status: TimelineStatus | null;
  title: string;
  body: string | null;
  actorName: string | null;
  at: string;
  atLabel: string;
  inboxHref?: string;
  /** CRM-sent Gmail ledger row, for status checks by authorized senders. */
  outboundId?: string;
  gmailThreadId?: string;
  /** Gmail accepted it, but the workflow update has not completed; Check status repairs it. */
  effectsPending?: boolean;
}

const GMAIL_STATUSES: readonly TimelineStatus[] = ["prepared", "sending", "sent", "failed", "unknown", "logged"];

function emailStatus(direction: string | null, deliveryStatus: string | null, kind: TimelineKind): TimelineStatus | null {
  if (kind === "call") return null;
  if (direction === "Inbound") return "received";
  if (kind === "message") return deliveryStatus === "logged" ? "logged" : "sent";
  return GMAIL_STATUSES.find((status) => status === deliveryStatus) ?? "recorded";
}

function formatSize(size: number): string {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function manifestSummary(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const names = value.flatMap((entry) => entry && typeof entry === "object" && "fileName" in entry && "size" in entry
    && typeof entry.fileName === "string" && typeof entry.size === "number" ? [`${entry.fileName} (${formatSize(entry.size)})`] : []);
  return names.length ? `Attachments: ${names.join(", ")}` : null;
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
      .select("id, direction, channel, subject, summary, notes, delivery_status, occurred_at, related_user:users (full_name), communication_library_documents (document_name_snapshot, version_label_snapshot), gmail_inbox_messages (id), gmail_outbound_messages (id, attachments, gmail_thread_id, state, effects_applied_at)")
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
    const outbound = c.gmail_outbound_messages;
    const status = emailStatus(c.direction, c.delivery_status, kind);
    const attachments = (c.communication_library_documents as Array<{ document_name_snapshot: string; version_label_snapshot: string }> | null) ?? [];
    // CRM sends list the real transmitted manifest; older log-only rows never delivered files.
    const attachmentSummary = outbound
      ? manifestSummary(outbound.attachments)
      : attachments.length
        ? `Attachments logged: ${attachments.map((item) => `${item.document_name_snapshot} (${item.version_label_snapshot})`).join(", ")}. No files were delivered.`
        : null;
    entries.push({
      id: "c-" + c.id,
      kind,
      status,
      title: c.subject ?? c.summary ?? "Communication",
      body: [c.notes && c.notes !== c.subject ? c.notes : null, attachmentSummary].filter(Boolean).join("\n\n") || null,
      actorName: (c.related_user as { full_name: string } | null)?.full_name ?? null,
      at: c.occurred_at,
      atLabel: label(c.occurred_at),
      inboxHref: c.gmail_inbox_messages ? `/inbox?message=${c.gmail_inbox_messages.id}` : undefined,
      ...(outbound ? {
        outboundId: outbound.id, gmailThreadId: outbound.gmail_thread_id ?? undefined,
        effectsPending: outbound.state === "accepted" && !outbound.effects_applied_at,
      } : {}),
    });
  }

  for (const a of activity.data ?? []) {
    entries.push({
      id: "a-" + a.id,
      kind: activityKind(a.activity_type),
      status: null,
      title: a.summary,
      body: null,
      actorName: (a.actor as { full_name: string } | null)?.full_name ?? null,
      at: a.created_at,
      atLabel: label(a.created_at),
    });
  }

  return entries.sort((x, y) => y.at.localeCompare(x.at)).slice(0, limit);
}
