import "server-only";

import { getDocumentLibraryRepository } from "@/lib/repositories/document-library";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface OutboundEmailLog {
  clientId: string;
  subject: string;
  summary: string;
  notes?: string | null;
  actorId: string;
  externalContactId?: string | null;
  libraryDocumentIds?: string[];
}

/** Records an intended outbound email. No provider or binary delivery occurs. */
export async function logOutboundEmail(input: OutboundEmailLog): Promise<string> {
  const db = getSupabaseAdmin();
  const { data: communication, error } = await db.from("communications").insert({
    client_id: input.clientId, direction: "Outbound", channel: "Gmail",
    subject: input.subject, summary: input.summary, notes: input.notes ?? null,
    related_user_id: input.actorId, external_contact_id: input.externalContactId ?? null,
    delivery_status: "logged",
  }).select("id").single();
  if (error) throw new Error(error.message);

  const ids = [...new Set(input.libraryDocumentIds ?? [])];
  if (ids.length === 0) return communication.id;
  try {
    const repo = getDocumentLibraryRepository();
    const assets = await Promise.all(ids.map((id) => repo.findById(id)));
    if (assets.some((asset) => !asset?.filePath)) throw new Error("One or more library assets no longer exist.");
    const { error: linkError } = await db.from("communication_library_documents").insert(assets.map((asset) => ({
      communication_id: communication.id,
      document_library_id: asset!.id,
      document_name_snapshot: asset!.documentName,
      version_label_snapshot: asset!.versionLabel,
      file_path_snapshot: asset!.filePath!,
    })));
    if (linkError) throw new Error(linkError.message);
    return communication.id;
  } catch (error) {
    await db.from("communications").delete().eq("id", communication.id);
    throw error;
  }
}
