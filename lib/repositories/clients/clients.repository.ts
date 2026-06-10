import type { ListParams, Paginated } from "../types";
import type { Client, ClientUpdate, NewClient } from "./client.entity";

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
  create(input: NewClient): Promise<Client>;
  update(id: string, input: ClientUpdate): Promise<Client>;
  delete(id: string): Promise<void>;
}
