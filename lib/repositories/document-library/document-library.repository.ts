import type {
  LibraryAgeBand, LibraryDocument, LibraryDocumentType, LibraryDocumentUpdate, NewLibraryDocument,
} from "./document-library.entity";

export interface EligibleLibraryInput {
  productName: string;
  productVersionId?: string;
  variant?: string | null;
  /**
   * Types to consider — always explicit, never "omit to mean every type". This
   * query is the sole authority behind a *required* attachment, so a dropped
   * field must fail to compile rather than silently widen what may satisfy it.
   */
  documentTypes: readonly [LibraryDocumentType, ...LibraryDocumentType[]];
  ageBand: LibraryAgeBand;
  onDate?: string;
}

export interface DocumentLibraryRepository {
  findById(id: string): Promise<LibraryDocument | null>;
  list(): Promise<LibraryDocument[]>;
  listEligible(input: EligibleLibraryInput): Promise<LibraryDocument[]>;
  create(input: NewLibraryDocument): Promise<LibraryDocument>;
  update(id: string, input: LibraryDocumentUpdate): Promise<LibraryDocument>;
  approve(id: string): Promise<LibraryDocument>;
  archive(id: string): Promise<LibraryDocument>;
}
