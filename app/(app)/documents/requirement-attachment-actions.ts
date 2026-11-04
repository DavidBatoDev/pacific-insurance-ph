"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/context";
import { attachRequirementDocument, beginRequirementAttachmentUpload, listRequirementEmailAttachments, requirementAttachmentError } from "@/lib/documents/requirement-attachments";
import type { AttachmentPickerScope, RequirementAttachmentPage, RequirementAttachmentReceipt, RequirementReceiptSource, RequirementTarget } from "@/lib/documents/requirement-attachment.types";

export async function listRequirementEmailAttachmentsAction(scope: AttachmentPickerScope, options?: { search?: string; offset?: number }): Promise<ActionResult<RequirementAttachmentPage>> {
  try { return { ok: true, data: await listRequirementEmailAttachments(scope, options) }; }
  catch (error) { return { ok: false, error: requirementAttachmentError(error) }; }
}

export async function beginRequirementAttachmentUploadAction(target: RequirementTarget, input: { fileName: string; mimeType: string; size: number }): Promise<ActionResult<{ path: string; token: string }>> {
  try { return { ok: true, data: await beginRequirementAttachmentUpload(target, input) }; }
  catch (error) { return { ok: false, error: requirementAttachmentError(error) }; }
}

export async function attachRequirementDocumentAction(target: RequirementTarget, source: RequirementReceiptSource): Promise<ActionResult<RequirementAttachmentReceipt>> {
  try {
    const receipt = await attachRequirementDocument(target, source);
    revalidatePath("/documents");
    revalidatePath(target.kind === "application" ? "/applications" : target.kind === "claim" ? "/claims" : "/travel");
    if (receipt.document.clientId) revalidatePath(`/clients/${receipt.document.clientId}`);
    return { ok: true, data: receipt };
  } catch (error) { return { ok: false, error: requirementAttachmentError(error) }; }
}
