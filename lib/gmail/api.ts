import "server-only";

import type { InboxMessage } from "@/lib/repositories/inbox/inbox.entity";
import { getGmailReadAccess } from "./access";
import { decodeGmailBase64, gmailObject, gmailParts, MAX_ATTACHMENT_BYTES, safeGmailFileName } from "./mime";

const BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/";
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
export const GMAIL_REQUEST_TIMEOUT_MS = 10_000;

export class GmailApiError extends Error {
  readonly status: number;
  constructor(status: number, code = "gmail_provider_error") {
    super(code);
    this.name = "GmailApiError";
    this.status = status;
  }
}

function validateRequest(path: string, method: string, body: unknown): void {
  // Validate raw path as well as parsed URL: URL normalization must never rescue traversal.
  if (!/^[A-Za-z0-9_/?=&%+.-]+$/.test(path) || path.startsWith("/") || path.includes("..") || path.includes("#") || path.length > 8_192) throw new GmailApiError(400, "gmail_disallowed_request");
  const url = new URL(path, BASE_URL);
  const relative = url.pathname.slice(new URL(BASE_URL).pathname.length);
  if (url.origin !== "https://gmail.googleapis.com" || !url.pathname.startsWith("/gmail/v1/users/me/") || relative.includes("%")) throw new GmailApiError(400, "gmail_disallowed_request");
  const message = /^messages\/[A-Za-z0-9_-]{1,256}$/.test(relative);
  const attachment = /^messages\/[A-Za-z0-9_-]{1,256}\/attachments\/[A-Za-z0-9_-]{1,512}$/.test(relative);
  const allowedKeys = relative === "history" ? ["startHistoryId", "pageToken", "maxResults", "historyTypes"]
    : relative === "messages" ? ["q", "pageToken", "maxResults", "includeSpamTrash"]
      : message ? ["format"] : [];
  const keys = [...url.searchParams.keys()];
  if (keys.some((key) => !allowedKeys.includes(key) || url.searchParams.getAll(key).length !== 1)) throw new GmailApiError(400, "gmail_disallowed_request");
  const maxResults = url.searchParams.get("maxResults");
  if (maxResults !== null && (!/^\d{1,3}$/.test(maxResults) || Number(maxResults) < 1 || Number(maxResults) > 100)) throw new GmailApiError(400, "gmail_disallowed_request");
  if (method === "POST" && relative === "watch" && keys.length === 0) {
    const watch = gmailObject(body);
    if (Object.keys(watch).length !== 1 || typeof watch.topicName !== "string" || !/^projects\/[a-z][a-z0-9-]{4,61}[a-z0-9]\/topics\/[A-Za-z][A-Za-z0-9._~+%-]{2,254}$/.test(watch.topicName)) throw new GmailApiError(400, "gmail_disallowed_request");
    return;
  }
  if (method !== "GET" || body !== undefined || !(relative === "profile" || relative === "history" || relative === "messages" || message || attachment)) throw new GmailApiError(400, "gmail_disallowed_request");
  if (relative === "history" && (!/^\d{1,40}$/.test(url.searchParams.get("startHistoryId") || "") || url.searchParams.get("historyTypes") !== "messageAdded")) throw new GmailApiError(400, "gmail_disallowed_request");
  if (message && url.searchParams.get("format") !== "full") throw new GmailApiError(400, "gmail_disallowed_request");
}

/** Read-only endpoints, plus watch registration; no arbitrary URL, redirect, or Gmail mutation. */
export async function gmailRequest<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown; access?: { accessToken: string } } = {}): Promise<T> {
  const method = options.method || "GET";
  validateRequest(path, method, options.body);
  const access = options.access || await getGmailReadAccess();
  if (!access.accessToken) throw new GmailApiError(401, "gmail_read_permission_required");
  try {
    const response = await fetch(new URL(path, BASE_URL), {
      method, headers: { Authorization: `Bearer ${access.accessToken}`, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
      body: method === "POST" ? JSON.stringify(options.body) : undefined,
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(GMAIL_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new GmailApiError(response.status);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new GmailApiError(502, "gmail_invalid_response");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new GmailApiError(413, "gmail_response_too_large"); }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks, total).toString("utf8")) as T; }
    catch { throw new GmailApiError(502, "gmail_invalid_response"); }
  } catch (error) {
    if (error instanceof GmailApiError) throw error;
    throw new GmailApiError(503, "gmail_request_failed");
  }
}

/** Caller must first resolve the message through the actor-scoped repository. */
export async function getGmailAttachment(message: InboxMessage, partId: string): Promise<{ bytes: Buffer; fileName: string; mimeType: string }> {
  const attachment = message.attachments.find((part) => part.partId === partId);
  if (!attachment) throw new GmailApiError(404, "gmail_attachment_not_found");
  if (attachment.size > MAX_ATTACHMENT_BYTES) throw new GmailApiError(413, "gmail_attachment_too_large");
  const access = await getGmailReadAccess();
  if (access.googleSubject !== message.googleSubject) throw new GmailApiError(403, "gmail_identity_mismatch");
  let encoded: unknown;
  let declaredSize: unknown;
  if (attachment.attachmentId) {
    const payload = gmailObject(await gmailRequest<unknown>(`messages/${encodeURIComponent(message.gmailMessageId)}/attachments/${encodeURIComponent(attachment.attachmentId)}`, { access }));
    encoded = payload.data;
    declaredSize = payload.size;
  } else {
    const full = gmailObject(await gmailRequest<unknown>(`messages/${encodeURIComponent(message.gmailMessageId)}?format=full`, { access }));
    if (full.id !== message.gmailMessageId) throw new GmailApiError(502, "gmail_invalid_response");
    const matches = gmailParts(full.payload).filter((part) => part.partId === partId);
    if (matches.length !== 1) throw new GmailApiError(404, "gmail_attachment_not_found");
    const part = matches[0];
    // Gmail message/part IDs are immutable. Use the already-decoded stored filename;
    // comparing it with the provider's RFC 2047 wire spelling would reject valid names.
    if ((typeof part.mimeType === "string" ? part.mimeType.toLowerCase() : "application/octet-stream") !== attachment.mimeType) throw new GmailApiError(409, "gmail_attachment_mismatch");
    const body = gmailObject(part.body);
    encoded = body.data;
    declaredSize = body.size;
  }
  const bytes = decodeGmailBase64(encoded, MAX_ATTACHMENT_BYTES);
  if (bytes.length !== attachment.size || declaredSize !== bytes.length) throw new GmailApiError(502, "gmail_attachment_size_mismatch");
  // Force active/unknown formats to download as inert bytes, never inline browser content.
  const mimeType = /^(?:application\/pdf|image\/(?:png|jpeg|gif|webp)|text\/plain)$/.test(attachment.mimeType) ? attachment.mimeType : "application/octet-stream";
  return { bytes, fileName: safeGmailFileName(attachment.fileName), mimeType };
}
