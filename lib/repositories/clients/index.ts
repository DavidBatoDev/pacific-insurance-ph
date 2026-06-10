import type { ClientsRepository } from "./clients.repository";
import { SupabaseClientsRepository } from "./clients.repository.supabase";

let instance: ClientsRepository | null = null;

/**
 * Resolve the Clients repository. Application code calls this and depends only
 * on the {@link ClientsRepository} interface, so the implementation can be
 * swapped (e.g. an in-memory fake in tests) without changing callers.
 */
export function getClientsRepository(): ClientsRepository {
  if (!instance) {
    instance = new SupabaseClientsRepository();
  }
  return instance;
}

export type { ClientsRepository } from "./clients.repository";
export type { Client, NewClient, ClientUpdate } from "./client.entity";
