import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError, type ListParams, type Paginated } from "../types";
import type {
  DocumentRecord,
  DocumentRecordUpdate,
  NewDocumentRecord,
} from "./document.entity";
import type { DocumentsRepository } from "./documents.repository";

type DocRow = Database["public"]["Tables"]["documents"]["Row"];
type DocPatch = Database["public"]["Tables"]["documents"]["Update"];

function toDomain(row: DocRow): DocumentRecord {
  return {
    id: row.id,
    referenceNo: row.reference_no,
    clientId: row.client_id,
    policyId: row.policy_id,
    applicationId: row.application_id,
    claimId: row.claim_id,
    renewalId: row.renewal_id,
    travelRequestId: row.travel_request_id,
    sourceLibraryDocumentId: row.source_library_document_id,
    applicationRequirementId: row.application_requirement_id,
    travelRequirementId: row.travel_requirement_id,
    claimRequirementId: row.claim_requirement_id,
    documentType: row.document_type,
    name: row.name,
    filePath: row.file_path,
    version: row.version,
    visibility: row.visibility,
    status: row.status,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link DocumentsRepository}. */
export class SupabaseDocumentsRepository implements DocumentsRepository {
  async list(params: ListParams = {}): Promise<Paginated<DocumentRecord>> {
    const { limit = 50, offset = 0, orderBy = "created_at", ascending = false } = params;
    const { data, error, count } = await getSupabaseAdmin()
      .from("documents")
      .select("*", { count: "exact" })
      .order(orderBy, { ascending })
      .range(offset, offset + limit - 1);

    if (error) throw toRepositoryError("DocumentsRepository.list", error);
    return { rows: (data ?? []).map(toDomain), total: count ?? 0 };
  }

  async listByClient(clientId: string): Promise<DocumentRecord[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("documents")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) throw toRepositoryError("DocumentsRepository.listByClient", error);
    return (data ?? []).map(toDomain);
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("documents")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw toRepositoryError("DocumentsRepository.findById", error);
    return data ? toDomain(data) : null;
  }

  async create(input: NewDocumentRecord): Promise<DocumentRecord> {
    const { data, error } = await getSupabaseAdmin()
      .from("documents")
      .insert({
        name: input.name,
        file_path: input.filePath,
        client_id: input.clientId ?? null,
        policy_id: input.policyId ?? null,
        application_id: input.applicationId ?? null,
        claim_id: input.claimId ?? null,
        renewal_id: input.renewalId ?? null,
        travel_request_id: input.travelRequestId ?? null,
        source_library_document_id: input.sourceLibraryDocumentId ?? null,
        application_requirement_id: input.applicationRequirementId ?? null,
        travel_requirement_id: input.travelRequirementId ?? null,
        claim_requirement_id: input.claimRequirementId ?? null,
        document_type: input.documentType ?? null,
        uploaded_by: input.uploadedBy ?? null,
        notes: input.notes ?? null,
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      })
      .select("*")
      .single();

    if (error) throw toRepositoryError("DocumentsRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: DocumentRecordUpdate): Promise<DocumentRecord> {
    const patch: DocPatch = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.documentType !== undefined) patch.document_type = input.documentType;
    if (input.visibility !== undefined) patch.visibility = input.visibility;
    if (input.status !== undefined) patch.status = input.status;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await getSupabaseAdmin()
      .from("documents")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw toRepositoryError("DocumentsRepository.update", error);
    return toDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from("documents").delete().eq("id", id);
    if (error) throw toRepositoryError("DocumentsRepository.delete", error);
  }
}
