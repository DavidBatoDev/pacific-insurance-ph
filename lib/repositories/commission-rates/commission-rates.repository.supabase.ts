import "server-only";

import type { CommissionBusinessType } from "@/lib/db-enums";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type {
  CommissionRate,
  CommissionRateUpdate,
  NewCommissionRate,
} from "./commission-rate.entity";
import type { CommissionRatesRepository } from "./commission-rates.repository";

type RateRow = Database["public"]["Tables"]["commission_rates"]["Row"];
type RateJoined = RateRow & { products: { name: string } | null };

const SELECT = "*, products (name)";

function toDomain(row: RateJoined): CommissionRate {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.products?.name ?? "—",
    businessType: row.business_type as CommissionBusinessType,
    // numeric columns can arrive as strings from PostgREST
    ratePct: row.rate_pct == null ? null : Number(row.rate_pct),
    effectiveDate: row.effective_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link CommissionRatesRepository}. */
export class SupabaseCommissionRatesRepository implements CommissionRatesRepository {
  async listAll(): Promise<CommissionRate[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("commission_rates")
      .select(SELECT)
      .returns<RateJoined[]>();
    if (error) throw toRepositoryError("CommissionRatesRepository.listAll", error);
    return (data ?? []).map(toDomain).sort(
      (a, b) =>
        a.productName.localeCompare(b.productName) ||
        a.businessType.localeCompare(b.businessType) ||
        b.effectiveDate.localeCompare(a.effectiveDate),
    );
  }

  async findEffective(
    productId: string,
    businessType: CommissionBusinessType,
    onDate: string,
  ): Promise<CommissionRate | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("commission_rates")
      .select(SELECT)
      .eq("product_id", productId)
      .eq("business_type", businessType)
      .lte("effective_date", onDate)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle<RateJoined>();
    if (error) throw toRepositoryError("CommissionRatesRepository.findEffective", error);
    return data ? toDomain(data) : null;
  }

  async create(input: NewCommissionRate): Promise<CommissionRate> {
    const { data, error } = await getSupabaseAdmin()
      .from("commission_rates")
      .insert({
        product_id: input.productId,
        business_type: input.businessType,
        rate_pct: input.ratePct,
        effective_date: input.effectiveDate,
        notes: input.notes ?? null,
      })
      .select(SELECT)
      .single<RateJoined>();
    if (error) throw toRepositoryError("CommissionRatesRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: CommissionRateUpdate): Promise<CommissionRate> {
    const patch: Database["public"]["Tables"]["commission_rates"]["Update"] = {};
    if (input.ratePct !== undefined) patch.rate_pct = input.ratePct;
    if (input.effectiveDate !== undefined) patch.effective_date = input.effectiveDate;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await getSupabaseAdmin()
      .from("commission_rates")
      .update(patch)
      .eq("id", id)
      .select(SELECT)
      .single<RateJoined>();
    if (error) throw toRepositoryError("CommissionRatesRepository.update", error);
    return toDomain(data);
  }
}
