import type { PoliciesRepository } from "./policies.repository";
import { SupabasePoliciesRepository } from "./policies.repository.supabase";

let instance: PoliciesRepository | null = null;

/** Resolve the Policies repository (see clients/index.ts for the pattern). */
export function getPoliciesRepository(): PoliciesRepository {
  if (!instance) {
    instance = new SupabasePoliciesRepository();
  }
  return instance;
}

export type { PoliciesRepository } from "./policies.repository";
export type { Policy, NewPolicy, PolicyUpdate } from "./policy.entity";
