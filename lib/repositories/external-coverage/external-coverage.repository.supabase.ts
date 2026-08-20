import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type {
  ExternalCoverage,
  ExternalCoverageStatus,
  ExternalCoverageType,
  ExternalCoverageUpdate,
  NewExternalCoverage,
} from "./external-coverage.entity";
import type { ExternalCoverageRepository } from "./external-coverage.repository";

type Row = Database["public"]["Tables"]["external_coverage"]["Row"];

const toDomain = (row: Row): ExternalCoverage => ({
  id: row.id,
  clientId: row.client_id,
  policyId: row.policy_id,
  coverageType: row.coverage_type as ExternalCoverageType | null,
  providerName: row.provider_name,
  planName: row.plan_name,
  maximumBenefitLimit: row.maximum_benefit_limit,
  currency: row.currency,
  effectiveDate: row.effective_date,
  expiryDate: row.expiry_date,
  status: row.status as ExternalCoverageStatus,
  proofDocumentId: row.proof_document_id,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class SupabaseExternalCoverageRepository implements ExternalCoverageRepository {
  async listByClient(clientId: string): Promise<ExternalCoverage[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("external_coverage")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw toRepositoryError("ExternalCoverageRepository.listByClient", error);
    return (data ?? []).map(toDomain);
  }

  async getById(id: string): Promise<ExternalCoverage | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("external_coverage")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw toRepositoryError("ExternalCoverageRepository.getById", error);
    return data ? toDomain(data) : null;
  }

  async create(input: NewExternalCoverage): Promise<ExternalCoverage> {
    const { data, error } = await getSupabaseAdmin()
      .from("external_coverage")
      .insert({
        client_id: input.clientId,
        policy_id: input.policyId ?? null,
        coverage_type: input.coverageType ?? null,
        provider_name: input.providerName ?? null,
        plan_name: input.planName ?? null,
        maximum_benefit_limit: input.maximumBenefitLimit ?? null,
        currency: input.currency ?? "PHP",
        effective_date: input.effectiveDate ?? null,
        expiry_date: input.expiryDate ?? null,
        status: input.status ?? "Active",
        proof_document_id: input.proofDocumentId ?? null,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();
    if (error) throw toRepositoryError("ExternalCoverageRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, patch: ExternalCoverageUpdate): Promise<ExternalCoverage> {
    const { data, error } = await getSupabaseAdmin()
      .from("external_coverage")
      .update({
        ...(patch.policyId !== undefined ? { policy_id: patch.policyId } : {}),
        ...(patch.coverageType !== undefined ? { coverage_type: patch.coverageType } : {}),
        ...(patch.providerName !== undefined ? { provider_name: patch.providerName } : {}),
        ...(patch.planName !== undefined ? { plan_name: patch.planName } : {}),
        ...(patch.maximumBenefitLimit !== undefined ? { maximum_benefit_limit: patch.maximumBenefitLimit } : {}),
        ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
        ...(patch.effectiveDate !== undefined ? { effective_date: patch.effectiveDate } : {}),
        ...(patch.expiryDate !== undefined ? { expiry_date: patch.expiryDate } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.proofDocumentId !== undefined ? { proof_document_id: patch.proofDocumentId } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw toRepositoryError("ExternalCoverageRepository.update", error);
    return toDomain(data);
  }
}
