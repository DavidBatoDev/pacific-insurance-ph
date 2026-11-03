import "server-only";

import type { InboxRepository } from "./inbox.repository";
import { SupabaseInboxRepository } from "./inbox.repository.supabase";

let instance: InboxRepository | null = null;

export function getInboxRepository(): InboxRepository {
  if (!instance) instance = new SupabaseInboxRepository();
  return instance;
}

export type { InboxRepository } from "./inbox.repository";
export type {
  InboxActor,
  InboxTargetKind,
  InboxTarget,
  InboxAttachment,
  IncomingMessage,
  InboxMessage,
  InboxSyncState,
  FilingPurpose,
  EnableInboxSyncInput,
  CommitInboxSyncInput,
  InboxNotificationInput,
  FileInboxAttachmentInput,
} from "./inbox.entity";
