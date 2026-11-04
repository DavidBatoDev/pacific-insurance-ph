import "server-only";

import type { OutboundEmailRepository } from "./outbound-email.repository";
import { SupabaseOutboundEmailRepository } from "./outbound-email.repository.supabase";

let instance: OutboundEmailRepository | null = null;

export function getOutboundEmailRepository(): OutboundEmailRepository {
  if (!instance) instance = new SupabaseOutboundEmailRepository();
  return instance;
}

export type { OutboundEmailRepository } from "./outbound-email.repository";
export type { OutboundClaim, OutboundEmail, OutboundResult, PrepareOutboundInput } from "./outbound-email.entity";
