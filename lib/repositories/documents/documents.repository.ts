import type { ListOptions, ListParams, Paginated } from "../types";
import type {
  DocumentRecord,
  DocumentRecordUpdate,
  NewDocumentRecord,
  ProposalReceiptInput,
} from "./document.entity";

/** The Documents repository port. Follows the canonical repository shape. */
export interface DocumentsRepository {
  /** `ownerUserId` keeps only documents whose client is assigned to that agent (Phase J9). */
  list(params?: ListParams & Pick<ListOptions, "ownerUserId">): Promise<Paginated<DocumentRecord>>;
  listWithClientName(params?: ListParams & Pick<ListOptions, "ownerUserId">): Promise<Paginated<DocumentRecord & { clientName: string | null }>>;
  listByClient(clientId: string): Promise<DocumentRecord[]>;
  listByTravelRequest(travelRequestId: string): Promise<DocumentRecord[]>;
  findById(id: string): Promise<DocumentRecord | null>;
  create(input: NewDocumentRecord): Promise<DocumentRecord>;
  registerProposalReceipt(input: ProposalReceiptInput): Promise<DocumentRecord>;
  update(id: string, input: DocumentRecordUpdate): Promise<DocumentRecord>;
  delete(id: string): Promise<void>;
}
