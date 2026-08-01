import type { ExternalContactsRepository } from "./external-contacts.repository";
import { SupabaseExternalContactsRepository } from "./external-contacts.repository.supabase";

let instance: ExternalContactsRepository | null = null;
export function getExternalContactsRepository(): ExternalContactsRepository {
  return instance ??= new SupabaseExternalContactsRepository();
}
export type { ExternalContactsRepository, ExternalContactFilters } from "./external-contacts.repository";
export type { ExternalContact, ExternalContactStatus, ExternalContactUpdate, NewExternalContact } from "./external-contact.entity";
export { EXTERNAL_CONTACT_TYPES } from "./external-contact.entity";
