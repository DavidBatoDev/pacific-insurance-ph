import "server-only";

import { recordAudit } from "@/lib/audit/log";
import { getDocumentsRepository, type DocumentRecord, type ProposalReceiptInput } from "@/lib/repositories/documents";
import { getObjectInfo, removeObject } from "@/lib/supabase/storage";
import type { Json } from "@/lib/supabase/types";

export const PDF_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

/** Storage key for a client PDF uploaded straight from the browser via a signed URL. */
export const pdfUploadPath = (clientId: string, id: string) => `${clientId}/${id}.pdf`;

const UPLOAD_EXTENSIONS = ["pdf", "jpg", "png"];

/**
 * Turn a browser-uploaded PDF into a `documents` row. The browser wrote the object
 * itself, so the path and size are re-checked here rather than trusted.
 */
export async function registerUploadedPdf(input: {
  path: string;
  name: string;
  clientId: string;
  documentType: string;
  actorId: string;
  travelRequestId?: string | null;
  travelRequirementId?: string | null;
  policyId?: string | null;
  applicationId?: string | null;
}): Promise<DocumentRecord> {
  await verifyUploadedDocument(input.path, input.clientId);

  const doc = await getDocumentsRepository().create({
    name: input.name,
    filePath: input.path,
    clientId: input.clientId,
    policyId: input.policyId ?? null,
    applicationId: input.applicationId ?? null,
    travelRequestId: input.travelRequestId ?? null,
    travelRequirementId: input.travelRequirementId ?? null,
    documentType: input.documentType,
    visibility: "Internal Only",
    uploadedBy: input.actorId,
  });
  await recordAudit({
    actorId: input.actorId,
    action: "create",
    tableName: "documents",
    recordId: doc.id,
    newValue: { name: input.name, path: input.path, documentType: input.documentType } as unknown as Json,
  });
  return doc;
}

async function verifyUploadedDocument(path: string, clientId: string): Promise<void> {
  if (!path.startsWith(`${clientId}/`) || !UPLOAD_EXTENSIONS.some((ext) => path.endsWith(`.${ext}`)))
    throw new Error("Invalid upload path.");
  const info = await getObjectInfo(path);
  if (Number(info.size) > PDF_UPLOAD_MAX_BYTES) {
    await removeObject(path).catch(() => undefined);
    throw new Error("Uploaded file exceeds 25 MB.");
  }
}

/** Portal upload-back and Gmail filing use the same locked proposal receipt transaction. */
export async function registerUploadedProposalReceipt(input: ProposalReceiptInput & { clientId: string }): Promise<DocumentRecord> {
  await verifyUploadedDocument(input.storagePath, input.clientId);
  const { clientId: _clientId, ...receipt } = input;
  return getDocumentsRepository().registerProposalReceipt(receipt);
}
