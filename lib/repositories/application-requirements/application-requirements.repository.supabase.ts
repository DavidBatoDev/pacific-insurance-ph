import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type { ApplicationRequirement, ApplicationRequirementStatus, NewApplicationRequirement } from "./application-requirement.entity";
import type { ApplicationRequirementsRepository } from "./application-requirements.repository";

type Row = Database["public"]["Tables"]["application_requirements"]["Row"];

const toDomain = (row: Row): ApplicationRequirement => ({
  id: row.id,
  applicationId: row.application_id,
  requiredDocumentItemId: row.required_document_item_id,
  documentName: row.document_name,
  appliesTo: row.applies_to,
  notes: row.notes,
  isRequired: row.is_required,
  status: row.status as ApplicationRequirementStatus,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class SupabaseApplicationRequirementsRepository implements ApplicationRequirementsRepository {
  async listByApplication(applicationId: string): Promise<ApplicationRequirement[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("application_requirements")
      .select("*")
      .eq("application_id", applicationId)
      .order("sort_order")
      .order("created_at");
    if (error) throw toRepositoryError("ApplicationRequirementsRepository.listByApplication", error);
    return (data ?? []).map(toDomain);
  }

  async createMany(items: NewApplicationRequirement[]): Promise<ApplicationRequirement[]> {
    if (items.length === 0) return [];
    const { data, error } = await getSupabaseAdmin().from("application_requirements").insert(
      items.map((item) => ({
        application_id: item.applicationId,
        required_document_item_id: item.requiredDocumentItemId ?? null,
        document_name: item.documentName,
        applies_to: item.appliesTo ?? null,
        notes: item.notes ?? null,
        is_required: item.isRequired ?? true,
        status: item.status ?? "Pending",
        sort_order: item.sortOrder ?? 0,
      })),
    ).select("*");
    if (error) throw toRepositoryError("ApplicationRequirementsRepository.createMany", error);
    return (data ?? []).map(toDomain);
  }

  async updateStatus(id: string, status: ApplicationRequirementStatus): Promise<ApplicationRequirement> {
    const { data, error } = await getSupabaseAdmin()
      .from("application_requirements")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw toRepositoryError("ApplicationRequirementsRepository.updateStatus", error);
    return toDomain(data);
  }

  async updateRequired(id: string, isRequired: boolean): Promise<ApplicationRequirement> {
    const { data, error } = await getSupabaseAdmin()
      .from("application_requirements").update({ is_required: isRequired })
      .eq("id", id).select("*").single();
    if (error) throw toRepositoryError("ApplicationRequirementsRepository.updateRequired", error);
    return toDomain(data);
  }
}
