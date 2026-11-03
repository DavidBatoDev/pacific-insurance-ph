import type {
  CommitInboxSyncInput,
  EnableInboxSyncInput,
  FileInboxAttachmentInput,
  InboxMessage,
  InboxNotificationInput,
  InboxSyncState,
  InboxTarget,
  InboxTargetKind,
} from "./inbox.entity";

/** Private service-role port. Actor access and lifecycle guards are enforced in SQL. */
export interface InboxRepository {
  getSyncState(): Promise<InboxSyncState | null>;
  enableSync(input: EnableInboxSyncInput, actorId: string): Promise<InboxSyncState>;
  updateWatch(googleSubject: string, expiresAt: string): Promise<void>;
  claimSync(leaseToken: string): Promise<InboxSyncState | null>;
  commitSync(input: CommitInboxSyncInput): Promise<void>;
  releaseSync(leaseToken: string, errorCode: string | null): Promise<void>;
  enqueueNotification(input: InboxNotificationInput): Promise<void>;
  listVisible(actorId: string, offset?: number): Promise<InboxMessage[]>;
  getVisible(id: string, actorId: string): Promise<InboxMessage | null>;
  listTargets(actorId: string): Promise<InboxTarget[]>;
  linkMessage(messageId: string, target: { kind: InboxTargetKind; id: string }, actorId: string): Promise<string>;
  getThreadTarget(googleSubject: string, gmailThreadId: string): Promise<InboxTarget | null>;
  fileAttachment(input: FileInboxAttachmentInput): Promise<string>;
}
