import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";
import { RepositoryError } from "../types";
import type {
  CommitInboxSyncInput,
  EnableInboxSyncInput,
  FileInboxAttachmentInput,
  InboxCorrectionImpact,
  InboxCorrectionInput,
  InboxCorrectionTarget,
  InboxCorrectionUsage,
  FilingPurpose,
  InboxAttachment,
  InboxMessage,
  InboxNotificationInput,
  InboxSyncState,
  InboxTarget,
  InboxTargetKind,
} from "./inbox.entity";
import type { InboxRepository } from "./inbox.repository";

type SyncRow = Database["public"]["Tables"]["gmail_inbox_sync"]["Row"];
type MessageRow = Database["public"]["Tables"]["gmail_inbox_messages"]["Row"];
type TargetRow = Database["public"]["Functions"]["list_gmail_inbox_targets"]["Returns"][number];

function persistenceError(operation: string, code?: string): RepositoryError {
  // Failing-row details can contain correspondence or medical information. Do
  // not retain the backend error, its body, details, hint, or cause.
  return new RepositoryError(`InboxRepository.${operation}: Inbox request could not be completed.`, {
    code: code && /^[a-zA-Z0-9_-]{1,64}$/.test(code) ? code : "inbox_persistence_failed",
  });
}

function toSyncState(row: SyncRow): InboxSyncState {
  return {
    googleSubject: row.google_subject,
    oauthClientId: row.oauth_client_id,
    enabledAt: row.enabled_at,
    historyId: row.history_id,
    pageToken: row.page_token,
    recoveryHistoryId: row.recovery_history_id,
    watchExpiresAt: row.watch_expires_at,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
    pending: row.pending,
    leaseToken: row.lease_token,
    leaseUntil: row.lease_until,
  };
}

function targetKind(value: string): InboxTargetKind {
  switch (value) {
    case "client": case "application": case "claim": case "renewal": case "travel": case "policy": return value;
    default: throw persistenceError("decodeTarget", "inbox_invalid_data");
  }
}

function toTarget(row: TargetRow): InboxTarget {
  return { kind: targetKind(row.kind), id: row.id, clientId: row.client_id, label: row.label, status: row.status, participants: row.participants };
}

function object(value: Json | undefined): { [key: string]: Json | undefined } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw persistenceError("decodeMessage", "inbox_invalid_data");
  }
  return value;
}

function attachments(value: Json): InboxAttachment[] {
  if (!Array.isArray(value)) throw persistenceError("decodeMessage", "inbox_invalid_data");
  return value.map((entry) => {
    const item = object(entry);
    if (typeof item.partId !== "string" || (item.attachmentId !== null && typeof item.attachmentId !== "string")
      || typeof item.fileName !== "string" || typeof item.mimeType !== "string" || typeof item.size !== "number") {
      throw persistenceError("decodeMessage", "inbox_invalid_data");
    }
    return { partId: item.partId, attachmentId: item.attachmentId, fileName: item.fileName, mimeType: item.mimeType, size: item.size };
  });
}

function filedParts(value: Json): Record<string, string> {
  const entries = Object.entries(object(value));
  if (entries.some(([, id]) => typeof id !== "string")) throw persistenceError("decodeMessage", "inbox_invalid_data");
  return Object.fromEntries(entries.map(([part, id]) => [part, String(id)]));
}

function toMessage(row: MessageRow): InboxMessage {
  return {
    id: row.id,
    googleSubject: row.google_subject,
    gmailMessageId: row.gmail_message_id,
    gmailThreadId: row.gmail_thread_id,
    rfcMessageId: row.rfc_message_id,
    inReplyTo: row.in_reply_to,
    references: row.message_references,
    fromAddress: row.from_address,
    fromName: row.from_name,
    toAddresses: row.to_addresses,
    ccAddresses: row.cc_addresses,
    subject: row.subject,
    bodyText: row.body_text,
    bodyTruncated: row.body_truncated,
    receivedAt: row.received_at,
    attachments: attachments(row.attachments),
    isAutoReply: row.is_auto_reply,
    authenticationResults: row.authentication_results,
    targetKind: row.target_kind === null ? null : targetKind(row.target_kind),
    targetId: row.target_id,
    clientId: row.client_id,
    communicationId: row.communication_id,
    linkedBy: row.linked_by,
    linkedAt: row.linked_at,
    createdAt: row.created_at,
    filedParts: filedParts(row.filed_parts),
  };
}

function text(value: Json | undefined): string {
  if (typeof value !== "string") throw persistenceError("decodeCorrection", "inbox_invalid_data");
  return value;
}

function boolean(value: Json | undefined): boolean {
  if (typeof value !== "boolean") throw persistenceError("decodeCorrection", "inbox_invalid_data");
  return value;
}

function array(value: Json | undefined): Json[] {
  if (!Array.isArray(value)) throw persistenceError("decodeCorrection", "inbox_invalid_data");
  return value;
}

function correctionTarget(value: Json | undefined): InboxTarget {
  const row = object(value);
  return {
    kind: targetKind(text(row.kind)), id: text(row.id), clientId: text(row.clientId),
    label: text(row.label), status: text(row.status), participants: array(row.participants).map(text),
  };
}

function filingPurpose(value: Json | undefined): FilingPurpose {
  switch (value) {
    case "document": case "proposal": case "application_requirement": case "claim_requirement":
    case "travel_requirement": case "travel_policy": case "travel_application_copy": return value;
    default: throw persistenceError("decodeCorrection", "inbox_invalid_data");
  }
}

function correctionUsage(value: Json): InboxCorrectionUsage {
  const row = object(value);
  const kind = targetKind(text(row.kind));
  if (kind !== "application" && kind !== "claim" && kind !== "travel")
    throw persistenceError("decodeCorrection", "inbox_invalid_data");
  return {
    id: text(row.id), documentId: text(row.documentId), kind, recordId: text(row.recordId),
    requirementId: text(row.requirementId), label: text(row.label), status: text(row.status),
    hasOtherEvidence: boolean(row.hasOtherEvidence), canDetach: boolean(row.canDetach),
    blockers: array(row.blockers).map(text),
  };
}

function correctionImpact(value: Json): InboxCorrectionImpact {
  const row = object(value);
  return {
    messageId: text(row.messageId), revision: text(row.revision),
    currentTarget: correctionTarget(row.currentTarget), target: correctionTarget(row.target),
    crossClient: boolean(row.crossClient), blockers: array(row.blockers).map(text),
    targetRequirements: array(row.targetRequirements).map((value) => {
      const item = object(value);
      return { id: text(item.id), label: text(item.label), status: text(item.status) };
    }),
    filings: array(row.filings).map((value) => {
      const item = object(value);
      return {
        partId: text(item.partId), fileName: text(item.fileName), documentId: text(item.documentId),
        purpose: filingPurpose(item.purpose), canMove: boolean(item.canMove),
        blockers: array(item.blockers).map(text), usages: array(item.usages).map(correctionUsage),
        target: item.target === null ? null : correctionTarget(item.target),
      };
    }),
  };
}

export class SupabaseInboxRepository implements InboxRepository {
  async getSyncState(): Promise<InboxSyncState | null> {
    const { data, error } = await getSupabaseAdmin().from("gmail_inbox_sync").select("*").eq("id", "agency").maybeSingle();
    if (error) throw persistenceError("getSyncState", error.code);
    return data ? toSyncState(data) : null;
  }

  async enableSync(input: EnableInboxSyncInput, actorId: string): Promise<InboxSyncState> {
    const { data, error } = await getSupabaseAdmin().rpc("enable_gmail_inbox", { p_input: { ...input }, p_actor_id: actorId }).single();
    if (error) throw persistenceError("enableSync", error.code);
    return toSyncState(data);
  }

  async updateWatch(googleSubject: string, expiresAt: string): Promise<void> {
    const { error } = await getSupabaseAdmin().rpc("update_gmail_inbox_watch", { p_google_subject: googleSubject, p_expires_at: expiresAt });
    if (error) throw persistenceError("updateWatch", error.code);
  }

  async claimSync(leaseToken: string): Promise<InboxSyncState | null> {
    const { data, error } = await getSupabaseAdmin().rpc("claim_gmail_inbox_sync", { p_lease_token: leaseToken }).maybeSingle();
    if (error) throw persistenceError("claimSync", error.code);
    return data ? toSyncState(data) : null;
  }

  async commitSync(input: CommitInboxSyncInput): Promise<void> {
    const { error } = await getSupabaseAdmin().rpc("commit_gmail_inbox_sync", {
      p_input: {
        ...input,
        messages: input.messages.map((message) => ({ ...message, attachments: message.attachments.map((part) => ({ ...part })) })),
      },
    });
    if (error) throw persistenceError("commitSync", error.code);
  }

  async releaseSync(leaseToken: string, errorCode: string | null): Promise<void> {
    if (errorCode !== null && !/^[a-zA-Z0-9_-]{1,64}$/.test(errorCode)) throw persistenceError("releaseSync", "inbox_invalid_error_code");
    const { error } = await getSupabaseAdmin().rpc("release_gmail_inbox_sync", {
      p_lease_token: leaseToken,
      ...(errorCode === null ? {} : { p_error_code: errorCode }),
    });
    if (error) throw persistenceError("releaseSync", error.code);
  }

  async enqueueNotification(input: InboxNotificationInput): Promise<void> {
    const { error } = await getSupabaseAdmin().rpc("enqueue_gmail_inbox_notification", { p_input: { ...input } });
    if (error) throw persistenceError("enqueueNotification", error.code);
  }

  async getVisibleRevision(actorId: string): Promise<string> {
    const { data, error } = await getSupabaseAdmin().rpc("get_gmail_inbox_revision", { p_actor_id: actorId });
    if (error) throw persistenceError("getVisibleRevision", error.code);
    if (typeof data !== "string" || !/^[0-9a-f]{32}$/.test(data))
      throw persistenceError("getVisibleRevision", "inbox_invalid_data");
    return data;
  }

  async listVisible(actorId: string, offset = 0): Promise<InboxMessage[]> {
    const safeOffset = Number.isSafeInteger(offset) ? Math.min(2_147_483_647, Math.max(0, offset)) : 0;
    const { data, error } = await getSupabaseAdmin().rpc("list_gmail_inbox_messages", { p_actor_id: actorId, p_offset: safeOffset });
    if (error) throw persistenceError("listVisible", error.code);
    return data.map(toMessage);
  }

  async getVisible(id: string, actorId: string): Promise<InboxMessage | null> {
    const { data, error } = await getSupabaseAdmin().rpc("list_gmail_inbox_messages", { p_actor_id: actorId, p_message_id: id }).maybeSingle();
    if (error) throw persistenceError("getVisible", error.code);
    return data ? toMessage(data) : null;
  }

  async listTargets(actorId: string): Promise<InboxTarget[]> {
    const { data, error } = await getSupabaseAdmin().rpc("list_gmail_inbox_targets", { p_actor_id: actorId });
    if (error) throw persistenceError("listTargets", error.code);
    return data.map(toTarget);
  }

  async linkMessage(messageId: string, target: { kind: InboxTargetKind; id: string }, actorId: string): Promise<string> {
    const { data, error } = await getSupabaseAdmin().rpc("link_gmail_inbox_message", {
      p_message_id: messageId, p_kind: target.kind, p_target_id: target.id, p_actor_id: actorId,
    });
    if (error) throw persistenceError("linkMessage", error.code);
    return data;
  }

  async getThreadTarget(googleSubject: string, gmailThreadId: string): Promise<InboxTarget | null> {
    const { data, error } = await getSupabaseAdmin().rpc("get_gmail_inbox_thread_target", {
      p_google_subject: googleSubject, p_gmail_thread_id: gmailThreadId,
    }).maybeSingle();
    if (error) throw persistenceError("getThreadTarget", error.code);
    return data ? toTarget(data) : null;
  }

  async fileAttachment(input: FileInboxAttachmentInput): Promise<string> {
    const { data, error } = await getSupabaseAdmin().rpc("file_gmail_inbox_attachment", { p_input: { ...input } });
    if (error) throw persistenceError("fileAttachment", error.code);
    return data;
  }

  async previewCorrection(messageId: string, target: InboxCorrectionTarget, actorId: string): Promise<InboxCorrectionImpact> {
    const { data, error } = await getSupabaseAdmin().rpc("preview_gmail_inbox_correction", {
      p_actor_id: actorId, p_message_id: messageId, p_kind: target.kind, p_target_id: target.id,
    });
    if (error) throw persistenceError("previewCorrection", error.code);
    return correctionImpact(data);
  }

  async correctMessage(input: InboxCorrectionInput, actorId: string): Promise<string> {
    const { data, error } = await getSupabaseAdmin().rpc("correct_gmail_inbox_message", {
      p_actor_id: actorId,
      p_input: {
        ...input, target: { ...input.target },
        filings: input.filings.map((filing) => ({ ...filing })),
        receipts: input.receipts.map((receipt) => ({ ...receipt })),
      },
    });
    if (error) throw persistenceError("correctMessage", error.code);
    return data;
  }
}
