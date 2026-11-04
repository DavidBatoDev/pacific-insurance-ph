import "server-only";

import type { AttachmentPickerScope, RequirementAttachmentPage, RequirementAttachmentReceipt, RequirementTarget } from "@/lib/documents/requirement-attachment.types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { getDocumentsRepository } from "../documents";
import { RepositoryError } from "../types";
import type { RequirementAttachmentsRepository, RequirementUploadMetadata, StoredRequirementSource } from "./requirement-attachments.repository";

function persistenceError(code?: string, message?: string): RepositoryError {
  // Only recognized machine errors are exposed; never retain PostgreSQL details,
  // failing rows, correspondence, paths, provider responses, or tokens.
  const error = message === "attachment_acknowledgement_required"
    ? "Confirm that this attachment is also used for another record."
    : message === "attachment_original_is_immutable"
      ? "The original email filing cannot be deleted. Remove an individual checklist attachment instead."
      : code === "42501"
        ? "This attachment or checklist is not available to your account."
        : "The attachment could not be saved. Refresh the record and try again.";
  return new RepositoryError(error, { code: code && /^[a-zA-Z0-9_-]{1,64}$/.test(code) ? code : "attachment_persistence_failed" });
}
function json(value: unknown): Json { return value as Json; }

export class SupabaseRequirementAttachmentsRepository implements RequirementAttachmentsRepository {
  async resolveScope(actorId: string, scope: AttachmentPickerScope) {
    const { data, error } = await getSupabaseAdmin().rpc("resolve_requirement_attachment_scope", { p_actor_id: actorId, p_scope: json(scope) });
    if (error || !data) throw persistenceError(error?.code, error?.message);
    return data as { clientId: string; label: string | null; status: string | null };
  }
  async listEmailAttachments(actorId: string, scope: AttachmentPickerScope, search: string, offset: number): Promise<RequirementAttachmentPage> {
    const { data, error } = await getSupabaseAdmin().rpc("list_requirement_email_attachments", { p_actor_id: actorId, p_scope: json(scope), p_search: search, p_offset: offset });
    if (error || !data) throw persistenceError(error?.code, error?.message);
    return data as unknown as RequirementAttachmentPage;
  }
  async beginUpload(actorId: string, target: RequirementTarget, upload: RequirementUploadMetadata & { path: string }): Promise<void> {
    const { error } = await getSupabaseAdmin().rpc("begin_requirement_attachment_upload", { p_actor_id: actorId, p_target: json(target), p_upload: json(upload) });
    if (error) throw persistenceError(error.code, error.message);
  }
  async receive(actorId: string, target: RequirementTarget, source: StoredRequirementSource): Promise<RequirementAttachmentReceipt> {
    const { data, error } = await getSupabaseAdmin().rpc("receive_requirement_attachment", { p_actor_id: actorId, p_target: json(target), p_source: json(source) });
    if (error || !data) throw persistenceError(error?.code, error?.message);
    const receipt = data as { documentId: string; requirementStatus: RequirementAttachmentReceipt["requirementStatus"]; alreadyAttached: boolean };
    const document = await getDocumentsRepository().findById(receipt.documentId).catch(() => {
      throw new RepositoryError("The attachment was saved but could not be loaded. Refresh the record.", { code: "attachment_receipt_unavailable" });
    });
    if (!document) throw new RepositoryError("The attachment was saved but could not be loaded. Refresh the record.", { code: "attachment_receipt_unavailable" });
    return { document, requirementStatus: receipt.requirementStatus, alreadyAttached: receipt.alreadyAttached };
  }
  async getOriginalPath(actorId: string, messageId: string, partId: string): Promise<string | null> {
    const { data, error } = await getSupabaseAdmin().rpc("get_requirement_attachment_original", { p_actor_id: actorId, p_message_id: messageId, p_part_id: partId });
    if (error) throw persistenceError(error.code, error.message);
    return data;
  }
  async deleteDocument(actorId: string, documentId: string): Promise<{ storagePath: string | null; originalPreserved?: boolean }> {
    const { data, error } = await getSupabaseAdmin().rpc("delete_document_safely", { p_actor_id: actorId, p_document_id: documentId });
    if (error || !data) throw persistenceError(error?.code, error?.message);
    return data as { storagePath: string | null; originalPreserved?: boolean };
  }
}
