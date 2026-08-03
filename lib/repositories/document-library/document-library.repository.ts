import type { LibraryDocument, LibraryDocumentUpdate, NewLibraryDocument } from "./document-library.entity";

export interface EligibleLibraryInput {
  productName: string;
  productVersionId?: string;
  variant?: string | null;
  documentType: "Brochure" | "Application Form";
  ageBand: "All Ages" | "0-70" | "71-100";
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
