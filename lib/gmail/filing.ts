import "server-only";

import { createHash } from "node:crypto";
import { PDF_UPLOAD_MAX_BYTES } from "@/lib/documents/uploaded-pdf";
import { getInboxRepository } from "@/lib/repositories/inbox";
import type { FilingPurpose } from "@/lib/repositories/inbox/inbox.entity";
import { downloadObject, getObjectInfo, uploadObject } from "@/lib/supabase/storage";
import { getGmailAttachment } from "./api";
import { getInboxRequirements, getScopedInboxMessage, inboxPurposeOptions, InboxReviewError, requireInboxActor } from "./review";

const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");

function digest(bytes: Buffer | string): string { return createHash("sha256").update(bytes).digest("hex"); }

/** A deterministic private object is retained on metadata failure so a retry can complete atomically. */
async function storeOriginal(path: string, bytes: Buffer): Promise<void> {
  try {
    await uploadObject(path, bytes, "application/pdf");
    return;
  } catch {
    // A concurrent/repeated filing can own the same key. Do not overwrite it or trust only its name.
    try {
      const info = await getObjectInfo(path);
      if (Number(info.size) !== bytes.length) throw new Error("size mismatch");
      const existing = await downloadObject(path);
      if (existing.size !== bytes.length || digest(Buffer.from(await existing.arrayBuffer())) !== digest(bytes))
        throw new Error("content mismatch");
    } catch {
      throw new InboxReviewError("The original PDF could not be stored safely. No document was filed. Try again or contact an Admin.", 503);
    }
  }
}

export async function fileInboxAttachment(
  messageId: string,
  partId: string,
  purpose: FilingPurpose,
  requirementId: string | null,
  actorId: string,
): Promise<string> {
  const actor = await requireInboxActor(actorId);
  if (actor.appRole === "agent") throw new InboxReviewError("Only Admin and Staff can file correspondence attachments.", 403);
  const message = await getScopedInboxMessage(messageId, actor.id);
  if (!message.targetKind || !message.targetId || !message.clientId)
    throw new InboxReviewError("An Admin must link this correspondence to a record before filing.");
  const attachment = message.attachments.find((part) => part.partId === partId);
  if (!attachment) throw new InboxReviewError("Attachment not found.", 404);
  const option = inboxPurposeOptions(message.targetKind).find((item) => item.value === purpose);
  if (!option) throw new InboxReviewError("This document purpose is not available for the linked record.");
  if (option.requiresRequirement) {
    if (!requirementId || !(await getInboxRequirements(message)).some((item) => item.id === requirementId))
      throw new InboxReviewError("Choose a checklist item belonging to this linked record.");
  } else if (requirementId !== null) {
    throw new InboxReviewError("This document purpose does not accept a checklist item.");
  }
  const storagePath = `${message.clientId}/gmail/${message.id}/${digest(partId)}.pdf`;
  // Repeated calls still reach the locked RPC, which rejects a different purpose or requirement.
  if (Object.hasOwn(message.filedParts, partId)) {
    return getInboxRepository().fileAttachment({ messageId, partId, actorId: actor.id, storagePath, fileName: attachment.fileName, purpose, requirementId });
  }
  if (attachment.size > PDF_UPLOAD_MAX_BYTES)
    throw new InboxReviewError("This attachment exceeds the app’s 25 MB limit. Ask an Admin with mailbox access to retrieve it in Gmail.");
  if (attachment.mimeType !== "application/pdf" && !attachment.fileName.toLowerCase().endsWith(".pdf"))
    throw new InboxReviewError("Only original PDF attachments can be filed here. Download this original and use the record's supported upload flow.");
  const original = await getGmailAttachment(message, partId);
  if (original.bytes.length > PDF_UPLOAD_MAX_BYTES)
    throw new InboxReviewError("This attachment exceeds the app’s 25 MB limit. Ask an Admin with mailbox access to retrieve it in Gmail.");
  if (original.bytes.length < 5 || original.bytes.compare(PDF_SIGNATURE, 0, 5, 0, 5) !== 0)
    throw new InboxReviewError("This attachment is not a supported PDF. Download the original instead; no substitute document was filed.");
  await storeOriginal(storagePath, original.bytes);
  // This transaction owns the document, requirement association, receipt transition and audit.
  // Never registerUploadedPdf separately: that would create duplicate/orphan metadata on retry.
  return getInboxRepository().fileAttachment({ messageId, partId, actorId: actor.id, storagePath, fileName: original.fileName, purpose, requirementId });
}
