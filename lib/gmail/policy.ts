import { createHash, timingSafeEqual } from "node:crypto";

const APPROVED_MAILBOX = "admin@pacificinsuranceph.com";
const WORKSPACE_DOMAIN = "pacificinsuranceph.com";
const EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/** Never attach provider errors, request configuration, or token payloads to this error. */
export class GmailAuthorizationError extends Error {
  constructor(public readonly code: string, public readonly permanent: boolean) {
    super(safeMessage(code));
    this.name = "GmailAuthorizationError";
  }
}

function safeMessage(code: string): string {
  switch (code) {
    case "invalid_client": return "Gmail OAuth client configuration needs attention.";
    case "forbidden": return "Only an active CRM Admin can manage Gmail.";
    case "not_connected": return "Connect Gmail first.";
    case "stale_connection": return "The connection changed during this operation. Check its status again.";
    case "provider_unavailable": return "Google could not be reached. Please try again later.";
    case "token_encryption_error": return "The stored Gmail credential could not be opened. Check the encryption configuration.";
    case "missing_scope": return "Gmail authorization is missing a required permission. Reconnect the approved mailbox.";
    case "read_permission_required": return "Reconnect Gmail and approve read permission before enabling incoming email.";
    case "unexpected_scope": return "Gmail authorization includes permissions outside this connection. Use only the requested permissions.";
    case "refresh_token_missing": return "Google did not provide offline authorization. Reconnect the approved mailbox.";
    case "nonce_mismatch": return "Gmail authorization could not be matched to this connection attempt. Please restart.";
    case "unverified_email": return "Google did not verify the mailbox email address.";
    case "workspace_mismatch": return "Connect the approved agency Google Workspace mailbox.";
    case "identity_mismatch": return "The Google account does not match the approved agency mailbox.";
    case "invalid_identity": return "Google mailbox identity could not be verified. Reconnect the approved mailbox.";
    case "invalid_grant":
    case "invalid_token": return "Gmail authorization is no longer valid. Reconnect the approved mailbox.";
    default: return "Google could not complete the Gmail authorization check. Please try again.";
  }
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export interface MailboxClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  hd?: string;
  nonce?: string;
}

export function verifyMailboxClaims(
  payload: MailboxClaims,
  senderEmail: string,
  nonceHash?: string,
): { googleSubject: string; mailboxEmail: string } {
  if (typeof payload.sub !== "string" || !payload.sub.trim()) {
    throw new GmailAuthorizationError("invalid_identity", true);
  }
  if (payload.email_verified !== true) {
    throw new GmailAuthorizationError("unverified_email", true);
  }
  const mailboxEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (senderEmail.trim().toLowerCase() !== APPROVED_MAILBOX || mailboxEmail !== APPROVED_MAILBOX) {
    throw new GmailAuthorizationError("identity_mismatch", true);
  }
  if (payload.hd !== WORKSPACE_DOMAIN) {
    throw new GmailAuthorizationError("workspace_mismatch", true);
  }
  if (nonceHash !== undefined) {
    const expected = /^[a-f0-9]{64}$/.test(nonceHash) ? Buffer.from(nonceHash, "hex") : null;
    const actual = typeof payload.nonce === "string" && payload.nonce.length > 0
      ? Buffer.from(sha256(payload.nonce), "hex") : null;
    if (!expected || !actual || !timingSafeEqual(actual, expected)) {
      throw new GmailAuthorizationError("nonce_mismatch", true);
    }
  }
  return { googleSubject: payload.sub, mailboxEmail };
}

export interface GoogleIdClaims extends MailboxClaims {
  iss?: string;
  aud?: string | string[];
  azp?: string;
  exp?: number;
}

/** Additional claims checks AFTER OAuth2Client verifies the token's signature. */
export function verifyGoogleIdClaims(
  payload: GoogleIdClaims,
  clientId: string,
  senderEmail: string,
  nonceHash: string,
  now = Date.now(),
): { googleSubject: string; mailboxEmail: string } {
  if (
    !["accounts.google.com", "https://accounts.google.com"].includes(payload.iss ?? "")
    || payload.aud !== clientId
    || (payload.azp !== undefined && payload.azp !== clientId)
    || typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp * 1000 <= now
  ) {
    throw new GmailAuthorizationError("invalid_identity", true);
  }
  return verifyMailboxClaims(payload, senderEmail, nonceHash);
}

export function requireSendScope(scopes: string[]): void {
  if (!scopes.includes(GMAIL_SEND_SCOPE)) throw new GmailAuthorizationError("missing_scope", true);
}

/** Reading is a separate capability; a send-only connection remains valid. */
export function requireReadScope(scopes: string[]): void {
  if (!scopes.includes(GMAIL_READ_SCOPE)) throw new GmailAuthorizationError("read_permission_required", false);
}

/** Google may return the OIDC email alias instead of its canonical OAuth scope. */
export function validateGrantedScopes(scopes: string[]): string[] {
  const canonical = [...new Set(scopes.map((scope) => scope === "email" ? EMAIL_SCOPE : scope))];
  requireSendScope(canonical);
  if (!canonical.includes("openid") || !canonical.includes(EMAIL_SCOPE)) {
    throw new GmailAuthorizationError("missing_scope", true);
  }
  if (canonical.some((scope) => !["openid", EMAIL_SCOPE, GMAIL_SEND_SCOPE, GMAIL_READ_SCOPE].includes(scope))) {
    throw new GmailAuthorizationError("unexpected_scope", true);
  }
  return canonical;
}

export function verifyAccessTokenInfo(
  info: { aud?: string; azp?: string; sub?: string; user_id?: string; scopes: string[]; expiry_date?: number },
  clientId: string,
  googleSubject?: string,
  now = Date.now(),
): string[] {
  if (info.aud !== clientId || (info.azp !== undefined && info.azp !== clientId)) {
    throw new GmailAuthorizationError("identity_mismatch", true);
  }
  if (googleSubject && ((info.sub !== undefined && info.sub !== googleSubject)
    || (info.user_id !== undefined && info.user_id !== googleSubject))) {
    throw new GmailAuthorizationError("identity_mismatch", true);
  }
  // An expired short-lived access token is not proof that offline authorization was revoked.
  if (typeof info.expiry_date !== "number" || !Number.isFinite(info.expiry_date) || info.expiry_date <= now) {
    throw new GmailAuthorizationError("provider_unavailable", false);
  }
  return validateGrantedScopes(info.scopes);
}

export function canReuseRefreshToken(
  existing: { googleSubject: string; oauthClientId: string; mailboxEmail: string },
  identity: { googleSubject: string; mailboxEmail: string },
  config: { clientId: string; senderEmail: string },
): boolean {
  return existing.googleSubject === identity.googleSubject
    && existing.oauthClientId === config.clientId
    && existing.mailboxEmail.trim().toLowerCase() === identity.mailboxEmail.trim().toLowerCase()
    && identity.mailboxEmail.trim().toLowerCase() === config.senderEmail.trim().toLowerCase()
    && config.senderEmail.trim().toLowerCase() === APPROVED_MAILBOX;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

export function classifyGoogleError(error: unknown): GmailAuthorizationError {
  if (error instanceof GmailAuthorizationError) return error;
  const object = record(error);
  const response = record(object.response);
  const data = record(response.data);
  // Only exact allowlisted provider identifiers are retained, never arbitrary error messages.
  const provider = [data.error, object.error, object.code, object.message].find(
    (value) => typeof value === "string"
      && ["invalid_client", "unauthorized_client", "invalid_grant", "invalid_token"].includes(value),
  );
  const status = typeof response.status === "number" ? response.status
    : typeof object.status === "number" ? object.status : undefined;
  if (provider === "invalid_client" || provider === "unauthorized_client") {
    return new GmailAuthorizationError("invalid_client", false);
  }
  if (provider === "invalid_grant" || provider === "invalid_token") {
    return new GmailAuthorizationError(provider, true);
  }
  if (status === 401) return new GmailAuthorizationError("invalid_token", true);
  if (status === 429 || (status !== undefined && status >= 500)
    || ["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(String(object.code))
    || object.name === "AbortError" || object.name === "TimeoutError" || error instanceof TypeError) {
    return new GmailAuthorizationError("provider_unavailable", false);
  }
  return new GmailAuthorizationError("provider_error", false);
}
