import type { AttachmentPickerScope, RequirementAttachmentPage, RequirementAttachmentReceipt, RequirementTarget } from "@/lib/documents/requirement-attachment.types";

export interface RequirementUploadMetadata {
  fileName: string;
  mimeType: string;
  size: number;
}
export type StoredRequirementSource =
  | ({ type: "upload"; path: string } & RequirementUploadMetadata)
  | { type: "email"; messageId: string; partId: string; confirmOtherRecord: boolean; storagePath?: string; fileName?: string };

export interface RequirementAttachmentsRepository {
  resolveScope(actorId: string, scope: AttachmentPickerScope): Promise<{ clientId: string; label: string | null; status: string | null }>;
  listEmailAttachments(actorId: string, scope: AttachmentPickerScope, search: string, offset: number): Promise<RequirementAttachmentPage>;
  beginUpload(actorId: string, target: RequirementTarget, upload: RequirementUploadMetadata & { path: string }): Promise<void>;
  receive(actorId: string, target: RequirementTarget, source: StoredRequirementSource): Promise<RequirementAttachmentReceipt>;
  getOriginalPath(actorId: string, messageId: string, partId: string): Promise<string | null>;
  deleteDocument(actorId: string, documentId: string): Promise<{ storagePath: string | null; originalPreserved?: boolean }>;
}
