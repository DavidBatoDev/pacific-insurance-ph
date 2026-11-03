import { Buffer } from "node:buffer";

export interface GmailNotification {
  messageId: string;
  historyId: string;
  emailAddress: string;
  subscription: string;
}

/** Only call after cryptographic OIDC verification; body metadata never authenticates delivery. */
export function parseGmailNotification(value: unknown, subscription: string, mailbox: string): GmailNotification {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid notification.");
  const envelope = value as Record<string, unknown>;
  const message = envelope.message;
  if (envelope.subscription !== subscription || !message || typeof message !== "object" || Array.isArray(message)) throw new Error("Invalid notification.");
  const { data, messageId } = message as Record<string, unknown>;
  if (typeof messageId !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(messageId) || typeof data !== "string" || data.length > 4096 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(data)) throw new Error("Invalid notification.");
  const normalized = data.replaceAll("-", "+").replaceAll("_", "/").replace(/=+$/, "");
  const decoded = Buffer.from(data, "base64");
  if (decoded.toString("base64").replace(/=+$/, "") !== normalized) throw new Error("Invalid notification.");
  let payload: unknown;
  try { payload = JSON.parse(decoded.toString("utf8")); } catch { throw new Error("Invalid notification."); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid notification.");
  const { emailAddress, historyId } = payload as Record<string, unknown>;
  // Gmail push can encode the ID as a JSON number; never stringify an already inexact integer.
  const decimalHistoryId = typeof historyId === "number" && Number.isSafeInteger(historyId) ? String(historyId) : historyId;
  if (emailAddress !== mailbox || typeof decimalHistoryId !== "string" || !/^[1-9][0-9]{0,31}$/.test(decimalHistoryId)) throw new Error("Invalid notification.");
  return { messageId, historyId: decimalHistoryId, emailAddress, subscription };
}

/** Signature, issuer, audience and lifetime must already be verified by google-auth-library. */
export function isGmailPushIdentity(payload: { email?: string; email_verified?: boolean } | undefined, serviceAccount: string): boolean {
  return Boolean(payload && payload.email_verified === true && payload.email === serviceAccount);
}
