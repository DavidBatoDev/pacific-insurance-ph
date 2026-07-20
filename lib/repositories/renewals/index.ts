import type { RenewalsRepository } from "./renewals.repository";
import { SupabaseRenewalsRepository } from "./renewals.repository.supabase";

let instance: RenewalsRepository | null = null;

/** Resolve the Renewals repository (see clients/index.ts for the pattern). */
export function getRenewalsRepository(): RenewalsRepository {
  if (!instance) {
    instance = new SupabaseRenewalsRepository();
  }
  return instance;
}

export type { RenewalsRepository } from "./renewals.repository";
export type { Renewal, NewRenewal, RenewalUpdate } from "./renewal.entity";
