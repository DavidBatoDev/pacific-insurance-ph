import "server-only";

import type { GmailAccess } from "./access";

const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
export const GMAIL_SEND_TIMEOUT_MS = 45_000;
const MAX_SEND_RESPONSE_BYTES = 64 * 1024;
const PROVIDER_ID = /^[A-Za-z0-9_-]{1,256}$/;
/** A complete response with one of these statuses proves Gmail rejected the request. */
const REJECTED_STATUSES = new Set([400, 401, 403, 404, 413, 422, 429]);

export const GMAIL_SEND_ERROR_CODES = [
  "gmail_send_rejected",
  "gmail_send_timeout",
  "gmail_send_unknown",
  "gmail_send_invalid_response",
  "gmail_send_source_changed",
  "gmail_send_attachment_unavailable",
  "gmail_send_auth_required",
  "gmail_send_persistence_unavailable",
  "gmail_send_thread_mismatch",
] as const;
export type GmailSendErrorCode = (typeof GMAIL_SEND_ERROR_CODES)[number];

/** Never carries request bytes, tokens, or provider response bodies. */
export class GmailSendError extends Error {
  constructor(
    public readonly outcome: "failed" | "unknown",
    public readonly code: GmailSendErrorCode,
    public readonly httpStatus: number | null = null,
  ) {
    super(code);
    this.name = "GmailSendError";
  }
}

export interface GmailSendResult {
  gmailMessageId: string;
  gmailThreadId: string;
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function readBounded(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new GmailSendError("unknown", "gmail_send_invalid_response", response.status);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_SEND_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new GmailSendError("unknown", "gmail_send_invalid_response", response.status);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

/**
 * Dispatches exactly one POST to the fixed send endpoint. Never retries: Gmail offers no
 * idempotency key, so any response that does not prove rejection is reported as unknown.
 */
export async function sendGmailMessage(
  input: { raw: Buffer; threadId?: string },
  access: GmailAccess,
  fetchImpl: typeof fetch = fetch,
): Promise<GmailSendResult> {
  if (!access.accessToken) throw new GmailSendError("failed", "gmail_send_auth_required");
  if (input.threadId !== undefined && !PROVIDER_ID.test(input.threadId)) throw new GmailSendError("failed", "gmail_send_thread_mismatch");
  const body = JSON.stringify({ raw: input.raw.toString("base64url"), ...(input.threadId ? { threadId: input.threadId } : {}) });
  let response: Response;
  try {
    response = await fetchImpl(SEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${access.accessToken}`, "Content-Type": "application/json" },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(GMAIL_SEND_TIMEOUT_MS),
    });
  } catch (error) {
    throw new GmailSendError("unknown", isTimeout(error) ? "gmail_send_timeout" : "gmail_send_unknown");
  }
  if (!response.ok) {
    // Reading the error body is unnecessary: only the status decides the outcome.
    await response.body?.cancel().catch(() => undefined);
    if (REJECTED_STATUSES.has(response.status)) {
      throw new GmailSendError("failed", response.status === 401 ? "gmail_send_auth_required" : "gmail_send_rejected", response.status);
    }
    throw new GmailSendError("unknown", "gmail_send_unknown", response.status);
  }
  let bytes: Buffer;
  try {
    bytes = await readBounded(response);
  } catch (error) {
    if (error instanceof GmailSendError) throw error;
    throw new GmailSendError("unknown", isTimeout(error) ? "gmail_send_timeout" : "gmail_send_invalid_response", response.status);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString("utf8")); }
  catch { throw new GmailSendError("unknown", "gmail_send_invalid_response", response.status); }
  if (!parsed || typeof parsed !== "object" || !("id" in parsed) || !("threadId" in parsed)
    || typeof parsed.id !== "string" || !PROVIDER_ID.test(parsed.id) || typeof parsed.threadId !== "string" || !PROVIDER_ID.test(parsed.threadId)) {
    throw new GmailSendError("unknown", "gmail_send_invalid_response", response.status);
  }
  return { gmailMessageId: parsed.id, gmailThreadId: parsed.threadId };
}
