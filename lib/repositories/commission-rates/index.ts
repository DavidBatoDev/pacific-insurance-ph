import type { CommissionRatesRepository } from "./commission-rates.repository";
import { SupabaseCommissionRatesRepository } from "./commission-rates.repository.supabase";

let instance: CommissionRatesRepository | null = null;

/** Resolve the Commission Rates repository (see clients/index.ts for the pattern). */
export function getCommissionRatesRepository(): CommissionRatesRepository {
  if (!instance) {
    instance = new SupabaseCommissionRatesRepository();
  }
  return instance;
}

export type { CommissionRatesRepository } from "./commission-rates.repository";
export type {
  CommissionRate,
  NewCommissionRate,
  CommissionRateUpdate,
} from "./commission-rate.entity";
