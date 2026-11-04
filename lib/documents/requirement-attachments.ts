import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { getGmailAttachment } from "@/lib/gmail/api";
import { safeGmailFileName } from "@/lib/gmail/mime";
import { getScopedInboxMessage, InboxReviewError, requireInboxActor, validateInboxId } from "@/lib/gmail/review";
import { getRequirementAttachmentsRepository, type RequirementUploadMetadata } from "@/lib/repositories/requirement-attachments";
import { RepositoryError } from "@/lib/repositories/types";
import { createSignedUpload, downloadObject, getObjectInfo, uploadObject } from "@/lib/supabase/storage";
import { PDF_UPLOAD_MAX_BYTES } from "./uploaded-pdf";
import type { AttachmentPickerScope, RequirementAttachmentReceipt, RequirementReceiptSource, RequirementTarget } from "./requirement-attachment.types";

const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function validateTarget(target: RequirementTarget): void {
  if (!target || !["application", "claim", "travel"].includes(target.kind)) throw new InboxReviewError("Choose a valid checklist item.");
  validateInboxId(target.recordId);
  validateInboxId(target.requirementId);
}
function validateScope(scope: AttachmentPickerScope): void {
  if (scope?.type === "requirement") validateTarget(scope.target);
  else if (scope?.type === "client") validateInboxId(scope.clientId);
  else throw new InboxReviewError("Choose a client or checklist item.");
}
function uploadMetadata(input: RequirementUploadMetadata): RequirementUploadMetadata {
  if (!input || typeof input.fileName !== "string" || !input.fileName.trim() || input.fileName.length > 1024
    || typeof input.mimeType !== "string" || input.mimeType.length > 255)
    throw new InboxReviewError("Choose a valid document to upload.");
  if (!Number.isSafeInteger(input.size) || input.size <= 0) throw new InboxReviewError("Choose a file to upload.");
  if (input.size > PDF_UPLOAD_MAX_BYTES) throw new InboxReviewError("Files must be 25 MB or smaller.", 413);
  return { fileName: safeGmailFileName(input.fileName), mimeType: input.mimeType || "application/octet-stream", size: input.size };
}

/** Do not serialize arbitrary storage/provider/Postgres failures into a client response. */
export function requirementAttachmentError(error: unknown): string {
  return error instanceof InboxReviewError || error instanceof RepositoryError
    ? error.message : "The attachment is temporarily unavailable. Please try again.";
}

export async function listRequirementEmailAttachments(scope: AttachmentPickerScope, options?: { search?: string; offset?: number }) {
  const actor = await requireInboxActor();
  validateScope(scope);
  const search = options?.search?.trim() ?? "";
  const offset = options?.offset ?? 0;
  if (search.length > 200 || !Number.isSafeInteger(offset) || offset < 0 || offset > 2_147_483_600)
    throw new InboxReviewError("Choose a valid search or page.");
  return getRequirementAttachmentsRepository().listEmailAttachments(actor.id, scope, search, offset);
}

export async function beginRequirementAttachmentUpload(target: RequirementTarget, input: RequirementUploadMetadata) {
  const actor = await requireInboxActor();
  validateTarget(target);
  const metadata = uploadMetadata(input);
  const repository = getRequirementAttachmentsRepository();
  const { clientId } = await repository.resolveScope(actor.id, { type: "requirement", target });
  // Keep all existing native document formats (including CET Excel workbooks).
  // Formats are private downloads; only signature-verified PDF/JPEG/PNG preview inline.
  const extension = metadata.fileName.split(".").pop()?.toLowerCase();
  const ext = metadata.fileName.includes(".") && extension && /^[a-z0-9]{1,12}$/.test(extension) ? extension : "bin";
  const path = `${clientId}/requirements/${randomUUID()}.${ext}`;
  await repository.beginUpload(actor.id, target, { path, ...metadata });
  return createSignedUpload(path);
}

/** Immutable deterministic object: concurrent/retried requests may only reuse identical bytes. */
async function storeRequirementOriginal(path: string, bytes: Buffer, mimeType: string): Promise<void> {
  try {
    await uploadObject(path, bytes, mimeType);
  } catch {
    try {
      const info = await getObjectInfo(path);
      if (Number(info.size) !== bytes.length) throw new Error("size mismatch");
      const existing = await downloadObject(path);
      if (existing.size !== bytes.length) throw new Error("size mismatch");
      const storedHash = createHash("sha256").update(Buffer.from(await existing.arrayBuffer())).digest("hex");
      if (storedHash !== createHash("sha256").update(bytes).digest("hex")) throw new Error("content mismatch");
    } catch {
      throw new InboxReviewError("The original attachment could not be stored safely. No checklist receipt was saved. Please try again.", 503);
    }
  }
}

export async function attachRequirementDocument(target: RequirementTarget, source: RequirementReceiptSource, actorId?: string): Promise<RequirementAttachmentReceipt> {
  const actor = await requireInboxActor(actorId);
  validateTarget(target);
  const repository = getRequirementAttachmentsRepository();
  const { clientId } = await repository.resolveScope(actor.id, { type: "requirement", target });
  if (source?.type === "upload") {
    const metadata = uploadMetadata(source);
    if (typeof source.path !== "string" || !new RegExp(`^${clientId}/requirements/[0-9a-f-]{36}\\.[a-z0-9]{1,12}$`).test(source.path))
      throw new InboxReviewError("This upload does not belong to the checklist item.");
    const info = await getObjectInfo(source.path);
    if (Number(info.size) !== metadata.size || Number(info.size) > PDF_UPLOAD_MAX_BYTES)
      throw new InboxReviewError("The uploaded file does not match the selected document. Upload it again.");
    return repository.receive(actor.id, target, { type: "upload", path: source.path, ...metadata });
  }
  if (source?.type !== "email") throw new InboxReviewError("Choose a document source.");
  if (actor.appRole === "agent") throw new InboxReviewError("Only Admin and Staff can file email attachments.", 403);
  if (typeof source.partId !== "string" || source.partId.length > 255 || typeof source.confirmOtherRecord !== "boolean")
    throw new InboxReviewError("Choose a valid email attachment.");
  const message = await getScopedInboxMessage(source.messageId, actor.id);
  const attachment = message.attachments.find((part) => part.partId === source.partId);
  if (message.clientId !== clientId || !message.targetId || !attachment)
    throw new InboxReviewError("This email attachment is not available for the checklist's client.", 404);
  if (attachment.size <= 0 || attachment.size > PDF_UPLOAD_MAX_BYTES)
    throw new InboxReviewError("Choose an attachment between 1 byte and 25 MB.", 413);
  // First reject the obvious cross-record selection before any provider request;
  // the RPC repeats this check and checks ALL existing usages while holding locks.
  if (message.targetKind !== "client" && (message.targetKind !== target.kind || message.targetId !== target.recordId) && !source.confirmOtherRecord)
    throw new InboxReviewError("Confirm that this email attachment belongs to another record.");
  const storedPath = await repository.getOriginalPath(actor.id, message.id, source.partId);
  if (storedPath) {
    // No Gmail access/connection check for an original already in private Storage.
    const info = await getObjectInfo(storedPath);
    if (Number(info.size) <= 0 || Number(info.size) > PDF_UPLOAD_MAX_BYTES)
      throw new InboxReviewError("The stored original is not available.", 503);
    return repository.receive(actor.id, target, { ...source });
  }
  const original = await getGmailAttachment(message, source.partId);
  if (original.bytes.length <= 0 || original.bytes.length > PDF_UPLOAD_MAX_BYTES)
    throw new InboxReviewError("Choose an attachment between 1 byte and 25 MB.", 413);
  const path = `${clientId}/gmail/${message.id}/${createHash("sha256").update(source.partId).digest("hex")}.bin`;
  await storeRequirementOriginal(path, original.bytes, original.mimeType);
  return repository.receive(actor.id, target, { ...source, storagePath: path, fileName: safeGmailFileName(original.fileName) });
}

/** Scope metadata before reading bytes; a missing stored original never falls back to Gmail. */
export async function getRequirementAttachmentOriginal(messageId: string, partId: string) {
  const actor = await requireInboxActor();
  const message = await getScopedInboxMessage(messageId, actor.id);
  if (!message.clientId || !message.targetId) throw new InboxReviewError("Attachment not found.", 404);
  const attachment = message.attachments.find((part) => part.partId === partId);
  if (!attachment) throw new InboxReviewError("Attachment not found.", 404);
  if (attachment.size > PDF_UPLOAD_MAX_BYTES) throw new InboxReviewError("This attachment exceeds the 25 MB limit.", 413);
  const path = await getRequirementAttachmentsRepository().getOriginalPath(actor.id, messageId, partId);
  let bytes: Buffer;
  if (path) {
    const info = await getObjectInfo(path);
    if (Number(info.size) > PDF_UPLOAD_MAX_BYTES) throw new InboxReviewError("This attachment exceeds the 25 MB limit.", 413);
    const original = await downloadObject(path);
    if (original.size > PDF_UPLOAD_MAX_BYTES) throw new InboxReviewError("This attachment exceeds the 25 MB limit.", 413);
    bytes = Buffer.from(await original.arrayBuffer());
  } else {
    bytes = (await getGmailAttachment(message, partId)).bytes;
  }
  return { actorId: actor.id, messageId: message.id, fileName: safeGmailFileName(attachment.fileName), bytes };
}

/** External MIME/extension is never an authority for inline content. */
export function requirementAttachmentPreviewMime(bytes: Buffer): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (bytes.length >= PDF_SIGNATURE.length && bytes.compare(PDF_SIGNATURE, 0, PDF_SIGNATURE.length, 0, PDF_SIGNATURE.length) === 0) return "application/pdf";
  if (bytes.length >= PNG_SIGNATURE.length && bytes.compare(PNG_SIGNATURE, 0, PNG_SIGNATURE.length, 0, PNG_SIGNATURE.length) === 0) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}
