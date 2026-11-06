"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toAppRole } from "@/lib/auth/permissions";
import { getClientsRepository } from "@/lib/repositories/clients";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { PDF_UPLOAD_MAX_BYTES, pdfUploadPath } from "@/lib/documents/uploaded-pdf";
import { getDocumentsRepository } from "@/lib/repositories/documents";
import { getRequirementAttachmentsRepository } from "@/lib/repositories/requirement-attachments";
import { createSignedUpload, removeObject, uploadObject } from "@/lib/supabase/storage";
import type { Json } from "@/lib/supabase/types";
import { COMMISSION_VOUCHER_DOCUMENT_TYPE, isCommissionVoucher } from "@/lib/commissions/voucher";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s === "" ? undefined : s;
}

/**
 * Signed URL for a browser-to-Storage PDF upload. Server Actions cap request
 * bodies at 1 MB, which a carrier-issued PDF can exceed, so the bytes bypass them.
 */
export async function beginPdfUploadAction(input: {
  clientId: string;
  fileName: string;
  mimeType: string;
  size: number;
}): Promise<ActionResult<{ path: string; token: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not authenticated." };
    if (user.status !== "Active") return { ok: false, error: "Your account is inactive." };
    if (!input.clientId) return { ok: false, error: "Missing client." };
    if (toAppRole(user.role) === "agent") {
      const client = await getClientsRepository().findById(input.clientId);
      if (!client || client.assignedUserId !== user.id) return { ok: false, error: "Client not found." };
    }
    if (input.size <= 0) return { ok: false, error: "Choose a file to upload." };
    if (input.size > PDF_UPLOAD_MAX_BYTES) return { ok: false, error: "PDFs must be 25 MB or smaller." };
    const isPdf = input.mimeType === "application/pdf" || input.fileName.toLowerCase().endsWith(".pdf");
    if (!isPdf) return { ok: false, error: "Only PDF files can be uploaded here." };
    return { ok: true, data: await createSignedUpload(pdfUploadPath(input.clientId, randomUUID())) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn’t start upload." };
  }
}

export async function uploadDocumentAction(formData: FormData) {
  const actor = await getActor();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const clientId = str(formData, "clientId") ?? null;
  const documentType = str(formData, "documentType") ?? null;
  if (documentType === COMMISSION_VOUCHER_DOCUMENT_TYPE) throw new Error("File commission vouchers from Commissions.");
  const visibility = str(formData, "visibility") ?? "Internal Only";
  const name = str(formData, "name") ?? file.name;
  const applicationId = str(formData, "applicationId") ?? null;
  const travelRequestId = str(formData, "travelRequestId") ?? null;
  const claimId = str(formData, "claimId") ?? null;
  const sourceLibraryDocumentId = str(formData, "sourceLibraryDocumentId") ?? null;

  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "bin";
  const path = `${clientId ?? "unfiled"}/${randomUUID()}.${ext || "bin"}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  await uploadObject(path, bytes, file.type || undefined);

  const doc = await getDocumentsRepository().create({
    name,
    filePath: path,
    clientId,
    applicationId,
    travelRequestId,
    claimId,
    sourceLibraryDocumentId,
    documentType,
    visibility,
    uploadedBy: actor.id,
  });

  await recordAudit({
    actorId: actor.id,
    action: "create",
    tableName: "documents",
    recordId: doc.id,
    newValue: { name, path, visibility } as unknown as Json,
  });

  if (clientId) {
    await recordActivity({
      scopeType: "client",
      scopeId: clientId,
      activityType: "document.uploaded",
      summary: `Document “${name}” uploaded`,
      actorId: actor.id,
    });
    revalidatePath(`/clients/${clientId}`);
  }
  revalidatePath("/documents");
  if (applicationId) revalidatePath("/applications");
  if (travelRequestId) revalidatePath("/travel");
  if (claimId) revalidatePath("/claims");
  return { id: doc.id };
}

export async function deleteDocumentAction(formData: FormData) {
  const actor = await getActor();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const repo = getDocumentsRepository();
  const doc = await repo.findById(id);
  if (doc && isCommissionVoucher(doc)) throw new Error("Commission voucher originals cannot be deleted. Replace the voucher from Commissions.");
  // The transaction removes only the authorized association and decides whether
  // bytes are unreferenced. Never remove Storage before a restrictive FK check.
  const deletion = await getRequirementAttachmentsRepository().deleteDocument(actor.id, id);
  if (deletion.storagePath) {
    try {
      await removeObject(deletion.storagePath);
    } catch {
      // Logical deletion succeeded; an unreferenced object can be collected later.
    }
  }

  if (doc?.clientId) {
    await recordActivity({
      scopeType: "client",
      scopeId: doc.clientId,
      activityType: "document.deleted",
      summary: deletion.originalPreserved ? `Checklist attachment “${doc.name}” removed; email original retained` : `Document “${doc.name}” removed`,
      actorId: actor.id,
    });
    revalidatePath(`/clients/${doc.clientId}`);
  }
  revalidatePath("/documents");
  if (doc?.applicationId) revalidatePath("/applications");
  if (doc?.claimId) revalidatePath("/claims");
  if (doc?.travelRequestId) revalidatePath("/travel");
}
