import "server-only";

import { recordAudit } from "@/lib/audit/log";
import { getDocumentsRepository, type DocumentRecord } from "@/lib/repositories/documents";
import { getObjectInfo, removeObject } from "@/lib/supabase/storage";
import type { Json } from "@/lib/supabase/types";

export const PDF_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

/** Storage key for a client PDF uploaded straight from the browser via a signed URL. */
export const pdfUploadPath = (clientId: string, id: string) => `${clientId}/${id}.pdf`;

/**
 * Requirement uploads (passport scans, signed forms) may be images as well as PDFs (H6d).
 * The MIME type decides the stored extension; nothing else is accepted.
 */
export const UPLOAD_MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const UPLOAD_EXTENSIONS = Object.values(UPLOAD_MIME_EXTENSIONS);

/** Storage key for a client document (PDF or image) uploaded straight from the browser. */
export const documentUploadPath = (clientId: string, id: string, ext: string) => `${clientId}/${id}.${ext}`;

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
}): Promise<DocumentRecord> {
  if (!input.path.startsWith(`${input.clientId}/`) || !UPLOAD_EXTENSIONS.some((ext) => input.path.endsWith(`.${ext}`)))
    throw new Error("Invalid upload path.");
  const info = await getObjectInfo(input.path);
  if (Number(info.size) > PDF_UPLOAD_MAX_BYTES) {
    await removeObject(input.path).catch(() => undefined);
    throw new Error("Uploaded file exceeds 25 MB.");
  }

  const doc = await getDocumentsRepository().create({
    name: input.name,
    filePath: input.path,
    clientId: input.clientId,
    policyId: input.policyId ?? null,
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
