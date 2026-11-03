import type { ListParams, Paginated } from "../types";
import type {
  DocumentRecord,
  DocumentRecordUpdate,
  NewDocumentRecord,
  ProposalReceiptInput,
} from "./document.entity";

/** The Documents repository port. Follows the canonical repository shape. */
export interface DocumentsRepository {
  list(params?: ListParams): Promise<Paginated<DocumentRecord>>;
  listWithClientName(params?: ListParams): Promise<Paginated<DocumentRecord & { clientName: string | null }>>;
  listByClient(clientId: string): Promise<DocumentRecord[]>;
  listByTravelRequest(travelRequestId: string): Promise<DocumentRecord[]>;
  findById(id: string): Promise<DocumentRecord | null>;
  create(input: NewDocumentRecord): Promise<DocumentRecord>;
  registerProposalReceipt(input: ProposalReceiptInput): Promise<DocumentRecord>;
  update(id: string, input: DocumentRecordUpdate): Promise<DocumentRecord>;
  delete(id: string): Promise<void>;
}
