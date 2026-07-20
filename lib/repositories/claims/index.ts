import type { ClaimsRepository } from "./claims.repository";
import { SupabaseClaimsRepository } from "./claims.repository.supabase";

let instance: ClaimsRepository | null = null;

/** Resolve the Claims repository (see clients/index.ts for the pattern). */
export function getClaimsRepository(): ClaimsRepository {
  if (!instance) {
    instance = new SupabaseClaimsRepository();
  }
  return instance;
}

export type { ClaimsRepository } from "./claims.repository";
export type { Claim, NewClaim, ClaimUpdate } from "./claim.entity";
