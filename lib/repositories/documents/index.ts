import type { DocumentsRepository } from "./documents.repository";
import { SupabaseDocumentsRepository } from "./documents.repository.supabase";

let instance: DocumentsRepository | null = null;

/** Resolve the Documents repository (swappable behind the interface). */
export function getDocumentsRepository(): DocumentsRepository {
  if (!instance) {
    instance = new SupabaseDocumentsRepository();
  }
  return instance;
}

export type { DocumentsRepository } from "./documents.repository";
export type {
  DocumentRecord,
  NewDocumentRecord,
  DocumentRecordUpdate,
} from "./document.entity";
