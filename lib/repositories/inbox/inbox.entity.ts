export type InboxActor = { id: string };
export type InboxTargetKind = "client" | "application" | "claim" | "renewal" | "travel" | "policy";

export interface InboxTarget {
  kind: InboxTargetKind;
  id: string;
  clientId: string;
  label: string;
  participants: string[];
}

export interface InboxAttachment {
  partId: string;
  attachmentId: string | null;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface IncomingMessage {
  gmailMessageId: string;
  gmailThreadId: string;
  rfcMessageId: string | null;
  inReplyTo: string | null;
  references: string[];
  fromAddress: string;
  fromName: string;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string;
  bodyText: string;
  bodyTruncated: boolean;
  receivedAt: string;
  attachments: InboxAttachment[];
  isAutoReply: boolean;
  authenticationResults: string | null;
}

export interface InboxMessage extends IncomingMessage {
  id: string;
  googleSubject: string;
  targetKind: InboxTargetKind | null;
  targetId: string | null;
  clientId: string | null;
  communicationId: string | null;
  linkedBy: string | null;
  linkedAt: string | null;
  createdAt: string;
  filedParts: Record<string, string>;
}

export interface InboxSyncState {
  googleSubject: string;
  oauthClientId: string;
  enabledAt: string;
  historyId: string;
  pageToken: string | null;
  recoveryHistoryId: string | null;
  watchExpiresAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  pending: boolean;
  leaseToken: string | null;
  leaseUntil: string | null;
}

export type FilingPurpose = "document" | "proposal" | "application_requirement" | "claim_requirement" | "travel_requirement" | "travel_policy" | "travel_application_copy";

export interface EnableInboxSyncInput {
  googleSubject: string;
  oauthClientId: string;
  historyId: string;
  enabledAt: string;
  watchExpiresAt: string | null;
}

export interface CommitInboxSyncInput {
  leaseToken: string;
  messages: IncomingMessage[];
  historyId: string;
  pageToken: string | null;
  recoveryHistoryId: string | null;
  complete: boolean;
}

export interface InboxNotificationInput {
  messageId: string;
  historyId: string;
  emailAddress: string;
  subscription: string;
}

export interface FileInboxAttachmentInput {
  messageId: string;
  partId: string;
  actorId: string;
  storagePath: string;
  fileName: string;
  purpose: FilingPurpose;
  requirementId: string | null;
}
