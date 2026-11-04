import "server-only";

import addressparser from "nodemailer/lib/addressparser";
import MailComposer from "nodemailer/lib/mail-composer";

export const AGENCY_MAILBOX = "admin@pacificinsuranceph.com";
export const MAX_SELECTED_ATTACHMENT_BYTES = 25_000_000;
/** Below Gmail's discovery-document send upload maximum of 36,700,160 bytes. */
export const MAX_RAW_MIME_BYTES = 35_000_000;
export const MAX_BODY_BYTES = 128 * 1024;
const MAILBOX = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const MESSAGE_ID = /^<[^<>\s]{1,996}>$/;

export class OutboundMimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutboundMimeError";
  }
}

/** Parses the complete value as exactly one mailbox; lists, groups and header injection are rejected. */
export function parseSingleMailbox(value: string): string | null {
  if (/[\r\n\0]/.test(value) || value.length > 320) return null;
  const parsed = addressparser(value.trim());
  if (parsed.length !== 1 || parsed[0].group || !parsed[0].address) return null;
  const address = parsed[0].address.trim();
  return MAILBOX.test(address) && address.length <= 254 ? address.toLowerCase() : null;
}

export interface OutboundMimeInput {
  id: string;
  createdAt: string;
  recipient: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references: string[];
  attachments: { fileName: string; mimeType: string; bytes: Buffer }[];
}

export function outboundRfcMessageId(id: string): string {
  return `<crm.${id}@pacificinsuranceph.com>`;
}

/**
 * Gmail's send API replaces the supplied Message-ID and Date with its own, so the RFC ID is not a
 * reconciliation locator. This server-built header carries the intent ID through to the sent copy.
 */
export const OUTBOUND_ID_HEADER = "X-PIPH-Outbound-ID";

/** Text-only MIME with real Buffer attachments; never reads files, URLs or browser-supplied headers. */
export async function buildOutboundMime(input: OutboundMimeInput): Promise<Buffer> {
  const to = parseSingleMailbox(input.recipient);
  if (!to) throw new OutboundMimeError("Enter exactly one valid recipient email address.");
  if (/[\r\n\0]/.test(input.subject)) throw new OutboundMimeError("The subject cannot contain line breaks.");
  if (input.body.includes("\0")) throw new OutboundMimeError("The message contains an invalid character.");
  if (Buffer.byteLength(input.body, "utf8") > MAX_BODY_BYTES) throw new OutboundMimeError("The message is too long to send.");
  const date = new Date(input.createdAt);
  if (Number.isNaN(date.getTime())) throw new OutboundMimeError("The message date is invalid.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id)) throw new OutboundMimeError("The email identity is invalid.");
  const headerIds = [input.inReplyTo, ...input.references].filter((value): value is string => value !== undefined);
  if (headerIds.some((value) => !MESSAGE_ID.test(value))) throw new OutboundMimeError("The reply headers are invalid.");
  const total = input.attachments.reduce((sum, file) => sum + file.bytes.length, 0);
  if (total > MAX_SELECTED_ATTACHMENT_BYTES) throw new OutboundMimeError("Selected attachments exceed 25 MB. Remove files before sending.");
  const composer = new MailComposer({
    from: { name: "Pacific Insurance PH", address: AGENCY_MAILBOX },
    to: [{ name: "", address: to }],
    subject: input.subject,
    text: input.body,
    date,
    messageId: outboundRfcMessageId(input.id),
    headers: { [OUTBOUND_ID_HEADER]: input.id },
    ...(input.inReplyTo ? { inReplyTo: input.inReplyTo } : {}),
    ...(input.references.length ? { references: input.references } : {}),
    attachments: input.attachments.map((file) => ({
      filename: file.fileName.replace(/[\u0000-\u001f\u007f]/g, "_"),
      content: file.bytes,
      contentType: file.mimeType,
      contentDisposition: "attachment",
      contentTransferEncoding: "base64",
    })),
    disableFileAccess: true,
    disableUrlAccess: true,
    xMailer: false,
  });
  const raw = await composer.compile().build();
  if (raw.length > MAX_RAW_MIME_BYTES) throw new OutboundMimeError("This email is too large for Gmail. Remove attachments before sending.");
  return raw;
}
