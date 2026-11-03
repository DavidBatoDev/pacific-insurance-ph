import "server-only";

import type { GmailRepository } from "./gmail.repository";
import { SupabaseGmailRepository } from "./gmail.repository.supabase";

let instance: GmailRepository | null = null;

export function getGmailRepository(): GmailRepository {
  if (!instance) instance = new SupabaseGmailRepository();
  return instance;
}

export type { GmailRepository } from "./gmail.repository";
export type {
  GmailAttempt,
  GmailConnection,
  GmailConnectionSummary,
  NewGmailConnection,
} from "./gmail-connection.entity";
