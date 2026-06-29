import type { ListParams, Paginated } from "../types";
import type {
  DocumentRecord,
  DocumentRecordUpdate,
  NewDocumentRecord,
} from "./document.entity";

/** The Documents repository port. Follows the canonical repository shape. */
export interface DocumentsRepository {
  list(params?: ListParams): Promise<Paginated<DocumentRecord>>;
  listByClient(clientId: string): Promise<DocumentRecord[]>;
  findById(id: string): Promise<DocumentRecord | null>;
  create(input: NewDocumentRecord): Promise<DocumentRecord>;
  update(id: string, input: DocumentRecordUpdate): Promise<DocumentRecord>;
  delete(id: string): Promise<void>;
}
