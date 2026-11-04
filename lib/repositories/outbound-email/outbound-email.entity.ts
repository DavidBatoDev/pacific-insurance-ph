import type { AttachmentManifestEntry } from "@/lib/communications/email-attachments";
import type { EmailOrigin, EmailSendState } from "@/lib/communications/outbound-email.types";
import type { InboxTargetKind } from "@/lib/repositories/inbox/inbox.entity";

/** Private ledger row. Never serialize: carries the dispatch token and storage paths. */
export interface OutboundEmail {
  id: string;
  communicationId: string;
  preparedBy: string;
  actorId: string;
  googleSubject: string;
  oauthClientId: string;
  clientId: string;
  origin: EmailOrigin;
  sourceKey: string;
  recipientEmail: string;
  subject: string;
  body: string;
  templateName: string | null;
  externalContactId: string | null;
  replyToMessageId: string | null;
  targetKind: InboxTargetKind;
  targetId: string;
  rfcMessageId: string;
  inReplyTo: string | null;
  references: string[];
  requestedThreadId: string | null;
  attachments: AttachmentManifestEntry[];
  payloadHash: string;
  generation: number;
  repeatOf: string | null;
  state: EmailSendState;
  dispatchToken: string | null;
  dispatchStartedAt: string | null;
  acceptedAt: string | null;
  gmailMessageId: string | null;
  gmailThreadId: string | null;
  errorCode: string | null;
  providerHttpStatus: number | null;
  effectsAppliedAt: string | null;
  acceptanceMetadata: Record<string, unknown>;
  createdAt: string;
}

/** Server-normalized prepare payload; SQL derives actor, state, generation, Date and RFC ID. */
export interface PrepareOutboundInput {
  id: string;
  origin: EmailOrigin;
  clientId: string;
  targetKind: InboxTargetKind;
  targetId: string;
  recipient: string;
  subject: string;
  body: string;
  summary: string;
  templateName: string | null;
  externalContactId: string | null;
  inReplyTo: string | null;
  references: string[];
  requestedThreadId: string | null;
  attachments: AttachmentManifestEntry[];
  payloadHash: string;
  repeatOfId: string | null;
  googleSubject: string;
  oauthClientId: string;
}

export type OutboundResult =
  | { state: "accepted"; gmailMessageId: string; gmailThreadId: string; errorCode?: "gmail_send_thread_mismatch"; providerHttpStatus?: number; acceptedAt?: string; occurredAt?: string }
  | { state: "failed" | "unknown"; errorCode: string; providerHttpStatus?: number };

export interface OutboundClaim {
  claimed: boolean;
  dispatchToken: string | null;
  message: OutboundEmail;
  blockedBy: OutboundEmail | null;
  problem: string | null;
}
