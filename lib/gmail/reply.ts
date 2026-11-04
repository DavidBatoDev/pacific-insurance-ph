import "server-only";

import addressparser from "nodemailer/lib/addressparser";

import type { InboxTargetKind } from "@/lib/repositories/inbox/inbox.entity";
import { getGmailReadAccess } from "./access";
import { gmailRequest } from "./api";
import { gmailObject, headers as gmailHeaders } from "./mime";
import { parseSingleMailbox } from "./outbound-mime";
import { getScopedInboxMessage, InboxReviewError } from "./review";

const MESSAGE_ID = /^<[^<>\s]{1,996}>$/;
const MAX_REFERENCES = 100;

export interface ReplyDraft {
  messageId: string;
  clientId: string;
  targetKind: InboxTargetKind;
  targetId: string;
  googleSubject: string;
  recipient: string;
  /** The original decoded subject, unchanged (may be empty). */
  subject: string;
  inReplyTo: string;
  references: string[];
  threadId: string;
}

function messageIds(value: string): string[] {
  return [...value.matchAll(/<[^<>\s]{1,996}>/g)].map((match) => match[0]);
}

/** Exactly one valid mailbox from Reply-To, else From. Ambiguity blocks rather than guesses. */
export function replyRecipient(replyTo: string | undefined, from: string | undefined): string | null {
  const source = replyTo !== undefined && replyTo.trim() !== "" ? replyTo : from;
  if (!source) return null;
  const parsed = addressparser(source);
  if (parsed.length !== 1 || parsed[0].group || !parsed[0].address) return null;
  return parseSingleMailbox(parsed[0].address);
}

/** Ordered distinct original References followed by the original Message-ID (RFC 5322 §3.6.4). */
export function replyReferences(original: string[], messageId: string): string[] {
  const distinct = [...new Set(original.filter((id) => MESSAGE_ID.test(id) && id !== messageId))];
  return [...distinct.slice(Math.max(0, distinct.length - (MAX_REFERENCES - 1))), messageId];
}

/**
 * Caller must have passed the sender gate. The live provider fetch supplies authoritative
 * Reply-To/Message-ID/References; the stored decoded subject is reused unchanged.
 */
export async function getReplyDraft(messageId: string): Promise<ReplyDraft> {
  const message = await getScopedInboxMessage(messageId);
  if (!message.targetId || !message.targetKind || !message.clientId) {
    throw new InboxReviewError("Link this correspondence before replying.", 409);
  }
  const access = await getGmailReadAccess();
  if (access.googleSubject !== message.googleSubject) throw new InboxReviewError("This correspondence belongs to a different mailbox connection.", 409);
  const full = gmailObject(await gmailRequest<unknown>(`messages/${encodeURIComponent(message.gmailMessageId)}?format=full`, { access }));
  if (full.id !== message.gmailMessageId || full.threadId !== message.gmailThreadId) {
    throw new InboxReviewError("Gmail returned a different message. Open it in Gmail to reply.", 409);
  }
  const header = gmailHeaders(gmailObject(full.payload));
  const recipient = replyRecipient(header.get("reply-to"), header.get("from"));
  if (!recipient) throw new InboxReviewError("The sender's reply address is missing or ambiguous. Open it in Gmail to reply.", 422);
  const rfcIds = messageIds(header.get("message-id") || "");
  if (rfcIds.length !== 1 || (message.rfcMessageId && message.rfcMessageId !== rfcIds[0])) {
    throw new InboxReviewError("This message has no valid Message-ID, so a threaded reply is not possible. Open it in Gmail to reply.", 422);
  }
  return {
    messageId: message.id,
    clientId: message.clientId,
    targetKind: message.targetKind,
    targetId: message.targetId,
    googleSubject: message.googleSubject,
    recipient,
    subject: message.subject,
    inReplyTo: rfcIds[0],
    references: replyReferences(messageIds(header.get("references") || ""), rfcIds[0]),
    threadId: message.gmailThreadId,
  };
}
