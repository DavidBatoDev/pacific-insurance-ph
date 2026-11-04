import "server-only";

import type { AttachmentManifestEntry } from "@/lib/communications/email-attachments";
import type { EmailOrigin, EmailSendState } from "@/lib/communications/outbound-email.types";
import type { InboxTargetKind } from "@/lib/repositories/inbox/inbox.entity";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";
import { RepositoryError } from "../types";
import type { OutboundClaim, OutboundEmail, OutboundResult, PrepareOutboundInput } from "./outbound-email.entity";
import type { OutboundEmailRepository } from "./outbound-email.repository";

type Row = Database["public"]["Tables"]["gmail_outbound_messages"]["Row"];

const STATES: readonly EmailSendState[] = ["prepared", "sending", "accepted", "failed", "unknown"];
const TARGETS: readonly InboxTargetKind[] = ["client", "application", "claim", "renewal", "travel", "policy"];
const ORIGINS = ["contact", "application_missing", "claim_missing", "billing", "submission", "proposal_request", "proposal_delivery", "renewal_draft", "reply"];

function persistenceError(operation: string, error?: { code?: string; message?: string } | null): RepositoryError {
  // Only our own allowlisted SQL exception identifiers survive; never row data or backend details.
  const code = error?.message && /^outbound_[a-z_]{1,48}$/.test(error.message) ? error.message
    : error?.code && /^[a-zA-Z0-9_-]{1,64}$/.test(error.code) ? `pg_${error.code}` : "outbound_persistence_failed";
  return new RepositoryError(`OutboundEmailRepository.${operation}: Outbound email request could not be completed.`, { code });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function origin(value: Json): EmailOrigin {
  if (!isObject(value) || typeof value.type !== "string" || !ORIGINS.includes(value.type)) throw persistenceError("decode");
  // Shape was produced by the server-side origin resolver and checked by the table constraint.
  const decoded: unknown = value;
  return decoded as EmailOrigin;
}

function manifest(value: Json): AttachmentManifestEntry[] {
  if (!Array.isArray(value)) throw persistenceError("decode");
  return value.map((entry) => {
    if (!isObject(entry) || !isObject(entry.source) || typeof entry.fileName !== "string" || typeof entry.mimeType !== "string"
      || typeof entry.size !== "number" || typeof entry.sha256 !== "string") throw persistenceError("decode");
    const decoded: unknown = entry;
    return decoded as AttachmentManifestEntry;
  });
}

function toOutbound(row: Row): OutboundEmail {
  const state = STATES.find((value) => value === row.state);
  const targetKind = TARGETS.find((value) => value === row.target_kind);
  if (!state || !targetKind || !isObject(row.acceptance_metadata)) throw persistenceError("decode");
  return {
    id: row.id,
    communicationId: row.communication_id,
    preparedBy: row.prepared_by,
    actorId: row.actor_id,
    googleSubject: row.google_subject,
    oauthClientId: row.oauth_client_id,
    clientId: row.client_id,
    origin: origin(row.origin),
    sourceKey: row.source_key,
    recipientEmail: row.recipient_email,
    subject: row.subject,
    body: row.body,
    templateName: row.template_name,
    externalContactId: row.external_contact_id,
    replyToMessageId: row.reply_to_message_id,
    targetKind,
    targetId: row.target_id,
    rfcMessageId: row.rfc_message_id,
    inReplyTo: row.in_reply_to,
    references: row.message_references,
    requestedThreadId: row.requested_thread_id,
    attachments: manifest(row.attachments),
    payloadHash: row.payload_hash,
    generation: row.generation,
    repeatOf: row.repeat_of,
    state,
    dispatchToken: row.dispatch_token,
    dispatchStartedAt: row.dispatch_started_at,
    acceptedAt: row.accepted_at,
    gmailMessageId: row.gmail_message_id,
    gmailThreadId: row.gmail_thread_id,
    errorCode: row.error_code,
    providerHttpStatus: row.provider_http_status,
    effectsAppliedAt: row.effects_applied_at,
    acceptanceMetadata: row.acceptance_metadata,
    createdAt: row.created_at,
  };
}

function rowFromJson(value: unknown): OutboundEmail | null {
  if (value === null || value === undefined) return null;
  if (!isObject(value)) throw persistenceError("decodeClaim");
  // jsonb of the full table row; decoded with the same validation as a selected row.
  const row: unknown = value;
  return toOutbound(row as Row);
}

function toJson(value: unknown): Json {
  // Plain JSON-safe data built by the service (strings, numbers, arrays, objects).
  return JSON.parse(JSON.stringify(value)) as Json;
}

export class SupabaseOutboundEmailRepository implements OutboundEmailRepository {
  async prepare(actorId: string, input: PrepareOutboundInput): Promise<OutboundEmail> {
    const { data, error } = await getSupabaseAdmin().rpc("prepare_gmail_outbound_email", { p_actor_id: actorId, p_input: toJson(input) }).single();
    if (error) throw persistenceError("prepare", error);
    return toOutbound(data);
  }

  async claim(actorId: string, id: string): Promise<OutboundClaim> {
    const { data, error } = await getSupabaseAdmin().rpc("claim_gmail_outbound_email", { p_actor_id: actorId, p_id: id });
    if (error) throw persistenceError("claim", error);
    if (!isObject(data) || typeof data.claimed !== "boolean") throw persistenceError("decodeClaim");
    const message = rowFromJson(data.message);
    if (!message) throw persistenceError("decodeClaim");
    const token = typeof data.dispatchToken === "string" ? data.dispatchToken : null;
    if (data.claimed && !token) throw persistenceError("decodeClaim");
    return {
      claimed: data.claimed, dispatchToken: token, message,
      blockedBy: rowFromJson(data.blockedBy), problem: typeof data.problem === "string" ? data.problem : null,
    };
  }

  async failPrepared(actorId: string, id: string, errorCode: string): Promise<OutboundEmail> {
    const { data, error } = await getSupabaseAdmin().rpc("fail_prepared_gmail_outbound_email", { p_actor_id: actorId, p_id: id, p_error_code: errorCode }).single();
    if (error) throw persistenceError("failPrepared", error);
    return toOutbound(data);
  }

  async finish(id: string, dispatchToken: string, result: OutboundResult): Promise<OutboundEmail> {
    const { data, error } = await getSupabaseAdmin().rpc("finish_gmail_outbound_email", { p_id: id, p_dispatch_token: dispatchToken, p_result: toJson(result) }).single();
    if (error) throw persistenceError("finish", error);
    return toOutbound(data);
  }

  async applyEffects(id: string): Promise<OutboundEmail> {
    const { data, error } = await getSupabaseAdmin().rpc("apply_gmail_outbound_email_effects", { p_id: id }).single();
    if (error) throw persistenceError("applyEffects", error);
    return toOutbound(data);
  }

  async get(actorId: string, id: string): Promise<OutboundEmail | null> {
    const { data, error } = await getSupabaseAdmin().rpc("get_gmail_outbound_email", { p_actor_id: actorId, p_id: id }).maybeSingle();
    if (error) throw persistenceError("get", error);
    return data ? toOutbound(data) : null;
  }

  async list(actorId: string, clientId: string, replyToMessageId?: string): Promise<OutboundEmail[]> {
    const { data, error } = await getSupabaseAdmin().rpc("list_gmail_outbound_email", {
      p_actor_id: actorId, p_client_id: clientId, ...(replyToMessageId ? { p_reply_to_message_id: replyToMessageId } : {}),
    });
    if (error) throw persistenceError("list", error);
    return data.map(toOutbound);
  }
}
