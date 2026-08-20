import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type { ClaimRequirement, ClaimRequirementStatus, NewClaimRequirement } from "./claim-requirement.entity";
import type { ClaimRequirementsRepository } from "./claim-requirements.repository";

type Row = Database["public"]["Tables"]["claim_requirements"]["Row"];

const toDomain = (row: Row): ClaimRequirement => ({
  id: row.id,
  claimId: row.claim_id,
  requiredDocumentItemId: row.required_document_item_id,
  documentName: row.document_name,
  appliesTo: row.applies_to,
  notes: row.notes,
  isRequired: row.is_required,
  status: row.status as ClaimRequirementStatus,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class SupabaseClaimRequirementsRepository implements ClaimRequirementsRepository {
  async listByClaim(claimId: string): Promise<ClaimRequirement[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("claim_requirements")
      .select("*")
      .eq("claim_id", claimId)
      .order("sort_order")
      .order("created_at");
    if (error) throw toRepositoryError("ClaimRequirementsRepository.listByClaim", error);
    return (data ?? []).map(toDomain);
  }

  async createMany(items: NewClaimRequirement[]): Promise<ClaimRequirement[]> {
    if (items.length === 0) return [];
    const { data, error } = await getSupabaseAdmin().from("claim_requirements").insert(
      items.map((item) => ({
        claim_id: item.claimId,
        required_document_item_id: item.requiredDocumentItemId ?? null,
        document_name: item.documentName,
        applies_to: item.appliesTo ?? null,
        notes: item.notes ?? null,
        is_required: item.isRequired ?? true,
        status: item.status ?? "Pending",
        sort_order: item.sortOrder ?? 0,
      })),
    ).select("*");
    if (error) throw toRepositoryError("ClaimRequirementsRepository.createMany", error);
    return (data ?? []).map(toDomain);
  }

  async updateStatus(id: string, status: ClaimRequirementStatus): Promise<ClaimRequirement> {
    const { data, error } = await getSupabaseAdmin()
      .from("claim_requirements")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw toRepositoryError("ClaimRequirementsRepository.updateStatus", error);
    return toDomain(data);
  }

  async updateRequired(id: string, isRequired: boolean): Promise<ClaimRequirement> {
    const { data, error } = await getSupabaseAdmin()
      .from("claim_requirements").update({ is_required: isRequired })
      .eq("id", id).select("*").single();
    if (error) throw toRepositoryError("ClaimRequirementsRepository.updateRequired", error);
    return toDomain(data);
  }
}
