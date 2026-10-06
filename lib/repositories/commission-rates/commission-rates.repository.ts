import type { CommissionBusinessType } from "@/lib/db-enums";
import type {
  CommissionRate,
  CommissionRateUpdate,
  NewCommissionRate,
} from "./commission-rate.entity";

/** The Commission Rates repository port (same shape as ClientsRepository). */
export interface CommissionRatesRepository {
  /** All rows (including history), by product name, business type, newest first. */
  listAll(): Promise<CommissionRate[]>;
  /** Latest row for the product + business type with effective_date <= onDate. */
  findEffective(
    productId: string,
    businessType: CommissionBusinessType,
    onDate: string,
  ): Promise<CommissionRate | null>;
  create(input: NewCommissionRate): Promise<CommissionRate>;
  update(id: string, input: CommissionRateUpdate): Promise<CommissionRate>;
}
