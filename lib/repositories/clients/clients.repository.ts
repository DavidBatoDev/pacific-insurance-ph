import type { ListParams, Paginated } from "../types";
import type { Client, ClientUpdate, NewClient } from "./client.entity";

/** Signals used to detect a likely-duplicate client before creating one. */
export interface DuplicateProbe {
  email?: string | null;
  mobileNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
}

/**
 * The Clients repository port.
 *
 * Application code (Server Components, Server Actions, Route Handlers) depends on
 * THIS interface — never on supabase-js directly. Every other entity
 * (applications, policies, claims, …) gets a sibling folder following this same
 * shape: entity + interface + supabase implementation + factory.
 */
export interface ClientsRepository {
  findById(id: string): Promise<Client | null>;
  list(params?: ListParams): Promise<Paginated<Client>>;
  /** Active leads — contacts at lifecycle_stage 'Lead' (feeds the Lead Lifecycle board). */
  listLeads(): Promise<Client[]>;
  create(input: NewClient): Promise<Client>;
  update(id: string, input: ClientUpdate): Promise<Client>;
  delete(id: string): Promise<void>;
  /** Fuzzy search by name, email, mobile, or reference number. */
  search(query: string, limit?: number): Promise<Client[]>;
  /** Existing clients matching the same email, mobile, or name + date of birth. */
  findPotentialDuplicates(input: DuplicateProbe): Promise<Client[]>;
}
