import "server-only";

import type { RequirementAttachmentsRepository } from "./requirement-attachments.repository";
import { SupabaseRequirementAttachmentsRepository } from "./requirement-attachments.repository.supabase";

let instance: RequirementAttachmentsRepository | null = null;
export function getRequirementAttachmentsRepository(): RequirementAttachmentsRepository {
  if (!instance) instance = new SupabaseRequirementAttachmentsRepository();
  return instance;
}
export type { RequirementAttachmentsRepository, RequirementUploadMetadata, StoredRequirementSource } from "./requirement-attachments.repository";
