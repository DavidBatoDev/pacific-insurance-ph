import type { ExternalContact, ExternalContactUpdate, NewExternalContact } from "./external-contact.entity";

export interface ExternalContactFilters {
  status?: "Active" | "Inactive";
  contactTypes?: string[];
  departments?: string[];
}

export interface ExternalContactsRepository {
  findById(id: string): Promise<ExternalContact | null>;
  list(filters?: ExternalContactFilters): Promise<ExternalContact[]>;
  create(input: NewExternalContact): Promise<ExternalContact>;
  update(id: string, input: ExternalContactUpdate): Promise<ExternalContact>;
}
