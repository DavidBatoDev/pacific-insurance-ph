import "server-only";

import { convert } from "html-to-text";
import type { InboxAttachment, IncomingMessage } from "@/lib/repositories/inbox/inbox.entity";

const BODY_LIMIT = 128 * 1024;
const MAX_TEXT_PART_BYTES = 8 * 1024 * 1024;
const MAX_PARTS = 1_000;
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

type JsonObject = Record<string, unknown>;
export function gmailObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("gmail_invalid_payload");
  return value as JsonObject;
}

export function decodeGmailBase64(value: unknown, maxBytes: number): Buffer {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]*={0,2}$/.test(value) || value.length % 4 === 1) {
    throw new Error("gmail_invalid_base64");
  }
  if (value.length > Math.ceil(maxBytes / 3) * 4 + 2) throw new Error("gmail_content_too_large");
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length > maxBytes) throw new Error("gmail_content_too_large");
  if (bytes.toString("base64url") !== value.replace(/=+$/, "")) throw new Error("gmail_invalid_base64");
  return bytes;
}

export function safeGmailFileName(value: string): string {
  const clean = value.normalize("NFKC").replace(/[\\/\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "_").replace(/^\.+/, "").trim();
  return Array.from(clean || "attachment").slice(0, 180).join("");
}

function cleanHeader(value: string): string {
  return value.replace(/\r?\n[ \t]+/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
}

function decodeWords(value: string): string {
  return cleanHeader(value.replace(/(\?=)\s+(=\?)/g, "$1$2").replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (_whole, charset: string, encoding: string, text: string) => {
    try {
      const bytes = encoding.toLowerCase() === "b"
        ? Buffer.from(text, "base64")
        : Buffer.from(text.replace(/_/g, " ").replace(/=([a-f0-9]{2})/gi, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16))), "latin1");
      return new TextDecoder(charset, { fatal: false }).decode(bytes);
    } catch { return "[unreadable header]"; }
  }));
}

function headers(part: JsonObject): Map<string, string> {
  const result = new Map<string, string>();
  if (part.headers === undefined) return result;
  if (!Array.isArray(part.headers) || part.headers.length > 1_000) throw new Error("gmail_invalid_headers");
  for (const entry of part.headers) {
    const header = gmailObject(entry);
    if (typeof header.name !== "string" || typeof header.value !== "string" || header.value.length > 64 * 1024) throw new Error("gmail_invalid_headers");
    const name = header.name.toLowerCase();
    const value = cleanHeader(header.value);
    result.set(name, result.has(name) ? `${result.get(name)}, ${value}` : value);
  }
  return result;
}

function addresses(value: string): { address: string; name: string }[] {
  // Commas inside quoted display names and angle addresses are not separators.
  const segments: string[] = [];
  let start = 0, quoted = false, escaped = false, angle = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (escaped) { escaped = false; continue; }
    if (char === "\\" && quoted) { escaped = true; continue; }
    if (char === '"') quoted = !quoted;
    if (!quoted && char === "<") angle++;
    if (!quoted && char === ">") angle--;
    if (!quoted && angle === 0 && (char === "," || char === ";")) { segments.push(value.slice(start, index)); start = index + 1; }
  }
  segments.push(value.slice(start));
  return segments.flatMap((segment) => {
    const match = segment.match(/(?:<\s*)?([A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?)(?:\s*>)?/i);
    if (!match) return [];
    const prefix = segment.slice(0, match.index).replace(/^[^"<]*:\s*/, "").trim().replace(/^"|"$/g, "").replace(/\\(["\\])/g, "$1");
    return [{ address: match[1].toLowerCase(), name: decodeWords(prefix) }];
  });
}

export function gmailParts(payload: unknown, skipFileChildren = false): JsonObject[] {
  const root = gmailObject(payload);
  const result: JsonObject[] = [];
  const visit = (part: JsonObject, depth: number) => {
    if (depth > 30 || result.length >= MAX_PARTS) throw new Error("gmail_mime_limits_exceeded");
    result.push(part);
    // An attached message is a file, not an alternative correspondence body.
    if (skipFileChildren && (Boolean(part.filename) || /^attachment\b/i.test(headers(part).get("content-disposition") || ""))) return;
    if (part.parts !== undefined) {
      if (!Array.isArray(part.parts)) throw new Error("gmail_invalid_payload");
      for (const child of part.parts) visit(gmailObject(child), depth + 1);
    }
  };
  visit(root, 0);
  return result;
}

function textPart(part: JsonObject, body: JsonObject): string {
  if (body.data === undefined && (body.size === 0 || body.size === undefined)) return "";
  // A textual MIME body supplied by attachmentId needs fetching, not silently skipping.
  if (typeof body.data !== "string") throw new Error("gmail_text_body_unavailable");
  const bytes = decodeGmailBase64(body.data, MAX_TEXT_PART_BYTES);
  if (body.size !== undefined && (typeof body.size !== "number" || body.size !== bytes.length)) throw new Error("gmail_invalid_part_size");
  const charset = headers(part).get("content-type")?.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1] || "utf-8";
  try { return new TextDecoder(charset, { fatal: false }).decode(bytes); }
  catch { throw new Error("gmail_unsupported_charset"); }
}

function cappedBody(value: string): { bodyText: string; bodyTruncated: boolean } {
  const normalized = value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n");
  const bytes = Buffer.from(normalized, "utf8");
  if (bytes.length <= BODY_LIMIT) return { bodyText: normalized, bodyTruncated: false };
  let end = BODY_LIMIT;
  while ((bytes[end] & 0xc0) === 0x80) end--;
  return { bodyText: bytes.subarray(0, end).toString("utf8"), bodyTruncated: true };
}

function messageIds(value: string): string[] {
  return [...value.matchAll(/<[^<>\s]{1,998}>/g)].map((match) => match[0]);
}

/** Only inert text and metadata leave this parser. Invalid input fails the checkpoint. */
export function parseGmailMessage(value: unknown): IncomingMessage | null {
  const message = gmailObject(value);
  if (message.labelIds !== undefined && (!Array.isArray(message.labelIds) || !message.labelIds.every((label) => typeof label === "string"))) throw new Error("gmail_invalid_labels");
  if (Array.isArray(message.labelIds) && (message.labelIds.includes("SENT") || message.labelIds.includes("DRAFT"))) return null;
  if (typeof message.id !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(message.id)
    || typeof message.threadId !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(message.threadId)
    || typeof message.internalDate !== "string" || !/^\d{1,16}$/.test(message.internalDate)) throw new Error("gmail_invalid_message");
  const received = Number(message.internalDate);
  if (!Number.isSafeInteger(received) || received < 0 || received > 8.64e15) throw new Error("gmail_invalid_received_at");
  const root = gmailObject(message.payload);
  const header = headers(root);
  const plain: string[] = [], html: string[] = [], attachments: InboxAttachment[] = [];
  const partIds = new Set<string>();
  for (const part of gmailParts(root, true)) {
    const mimeType = typeof part.mimeType === "string" ? part.mimeType.toLowerCase() : "application/octet-stream";
    const body = part.body === undefined ? {} : gmailObject(part.body);
    const fileName = typeof part.filename === "string" ? part.filename : "";
    const disposition = headers(part).get("content-disposition") || "";
    const isFile = Boolean(fileName) || /^attachment\b/i.test(disposition) || (typeof body.attachmentId === "string" && !mimeType.startsWith("text/"));
    if (isFile) {
      if (typeof part.partId !== "string" || !/^(?:\d+(?:\.\d+)*)?$/.test(part.partId) || partIds.has(part.partId)
        || typeof body.size !== "number" || !Number.isSafeInteger(body.size) || body.size < 0
        || (body.attachmentId !== undefined && (typeof body.attachmentId !== "string" || !/^[A-Za-z0-9_-]{1,512}$/.test(body.attachmentId)))) throw new Error("gmail_invalid_attachment");
      if (attachments.length >= 250) throw new Error("gmail_attachment_limits_exceeded");
      partIds.add(part.partId);
      attachments.push({ partId: part.partId, attachmentId: typeof body.attachmentId === "string" ? body.attachmentId : null, fileName: safeGmailFileName(decodeWords(fileName)), mimeType, size: body.size });
    } else if (mimeType === "text/plain") plain.push(textPart(part, body));
    else if (mimeType === "text/html") html.push(textPart(part, body));
  }
  const text = plain.length ? plain.join("\n\n") : html.map((markup) => convert(markup, {
    wordwrap: false,
    limits: { maxInputLength: MAX_TEXT_PART_BYTES, maxDepth: 30, maxChildNodes: 10_000, ellipsis: "\n[HTML content truncated]\n" },
    selectors: [
      { selector: "script", format: "skip" }, { selector: "style", format: "skip" },
      { selector: "img", format: "skip" }, { selector: "iframe", format: "skip" },
      { selector: "object", format: "skip" }, { selector: "svg", format: "skip" },
      { selector: "a", options: { ignoreHref: true } },
    ],
  })).join("\n\n");
  const from = addresses(header.get("from") || "")[0];
  const body = cappedBody(text);
  if (text.includes("[HTML content truncated]")) body.bodyTruncated = true;
  return {
    gmailMessageId: message.id, gmailThreadId: message.threadId,
    rfcMessageId: messageIds(header.get("message-id") || "")[0] || null,
    inReplyTo: messageIds(header.get("in-reply-to") || "")[0] || null,
    references: messageIds(header.get("references") || ""),
    fromAddress: from?.address || "", fromName: from?.name || "",
    toAddresses: [...new Set(addresses(header.get("to") || "").map(({ address }) => address))],
    ccAddresses: [...new Set(addresses(header.get("cc") || "").map(({ address }) => address))],
    subject: decodeWords(header.get("subject") || ""), ...body,
    receivedAt: new Date(received).toISOString(), attachments,
    isAutoReply: Boolean(header.get("auto-submitted") && !/^no(?:\s|;|$)/i.test(header.get("auto-submitted")!)) || /^(?:bulk|junk|list)$/i.test(header.get("precedence") || ""),
    authenticationResults: header.get("authentication-results") || null,
  };
}
