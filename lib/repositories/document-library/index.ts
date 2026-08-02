import type { DocumentLibraryRepository } from "./document-library.repository";
import { SupabaseDocumentLibraryRepository } from "./document-library.repository.supabase";
let instance: DocumentLibraryRepository | null = null;
export function getDocumentLibraryRepository(): DocumentLibraryRepository {
  return instance ??= new SupabaseDocumentLibraryRepository();
}
export type { DocumentLibraryRepository, EligibleLibraryInput } from "./document-library.repository";
export type { LibraryDocument, LibraryDocumentUpdate, NewLibraryDocument } from "./document-library.entity";
export { LIBRARY_AGE_BANDS, LIBRARY_APPROVAL_STATUSES, LIBRARY_DOCUMENT_TYPES } from "./document-library.entity";
