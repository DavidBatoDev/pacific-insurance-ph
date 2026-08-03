import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type { LibraryDocument, LibraryDocumentUpdate, NewLibraryDocument } from "./document-library.entity";
import type { DocumentLibraryRepository, EligibleLibraryInput } from "./document-library.repository";

type Row = Database["public"]["Tables"]["document_library"]["Row"];
type Joined = Row & { product_versions: { version_name: string; products: { name: string } | null } | null };
const SELECT = "*, product_versions (version_name, products (name))";

const toDomain = (row: Joined): LibraryDocument => ({
  id: row.id, productVersionId: row.product_version_id,
  productName: row.product_versions?.products?.name ?? null,
  productVersionName: row.product_versions?.version_name ?? null,
  documentName: row.document_name, documentType: row.document_type,
  versionLabel: row.version_label, variant: row.variant, ageBand: row.age_band,
  filePath: row.file_path, originalFileName: row.original_file_name,
  mimeType: row.mime_type, fileSizeBytes: row.file_size_bytes,
  effectiveDate: row.effective_date, expiryDate: row.expiry_date,
  status: row.status, approvalStatus: row.approval_status, notes: row.notes,
  distributionNotes: row.distribution_notes, uploadedBy: row.uploaded_by,
  createdAt: row.created_at, updatedAt: row.updated_at,
});

const patch = (input: LibraryDocumentUpdate) => {
  const value: Database["public"]["Tables"]["document_library"]["Update"] = {};
  if (input.documentName !== undefined) value.document_name = input.documentName;
  if (input.documentType !== undefined) value.document_type = input.documentType;
  if (input.versionLabel !== undefined) value.version_label = input.versionLabel;
  if (input.variant !== undefined) value.variant = input.variant;
  if (input.ageBand !== undefined) value.age_band = input.ageBand;
  if (input.effectiveDate !== undefined) value.effective_date = input.effectiveDate;
  if (input.expiryDate !== undefined) value.expiry_date = input.expiryDate;
  if (input.status !== undefined) value.status = input.status;
  if (input.approvalStatus !== undefined) value.approval_status = input.approvalStatus;
  if (input.notes !== undefined) value.notes = input.notes;
  if (input.distributionNotes !== undefined) value.distribution_notes = input.distributionNotes;
  return value;
};

export class SupabaseDocumentLibraryRepository implements DocumentLibraryRepository {
  async findById(id: string) {
    const { data, error } = await getSupabaseAdmin().from("document_library").select(SELECT).eq("id", id).maybeSingle<Joined>();
    if (error) throw toRepositoryError("DocumentLibraryRepository.findById", error);
    return data ? toDomain(data) : null;
  }
  async list() {
    const { data, error } = await getSupabaseAdmin().from("document_library").select(SELECT).order("created_at", { ascending: false }).returns<Joined[]>();
    if (error) throw toRepositoryError("DocumentLibraryRepository.list", error);
    return (data ?? []).map(toDomain);
  }
  async listEligible(input: EligibleLibraryInput) {
    const date = input.onDate ?? new Date().toISOString().slice(0, 10);
    let query = getSupabaseAdmin().from("document_library").select(SELECT)
      .eq("status", "Active").eq("approval_status", "Approved").eq("document_type", input.documentType)
      .in("age_band", input.ageBand === "All Ages" ? ["All Ages"] : ["All Ages", input.ageBand])
      .or(`effective_date.is.null,effective_date.lte.${date}`).or(`expiry_date.is.null,expiry_date.gte.${date}`);
    if (input.productVersionId) query = query.eq("product_version_id", input.productVersionId);
    if (input.variant) query = query.ilike("variant", input.variant);
    const { data, error } = await query.returns<Joined[]>();
    if (error) throw toRepositoryError("DocumentLibraryRepository.listEligible", error);
    return (data ?? []).map(toDomain)
      .filter((doc) => doc.productName?.toLowerCase() === input.productName.toLowerCase())
      .sort((a, b) => Number(b.ageBand === input.ageBand) - Number(a.ageBand === input.ageBand) || (b.effectiveDate ?? "").localeCompare(a.effectiveDate ?? ""));
  }
  async create(input: NewLibraryDocument) {
    const { data, error } = await getSupabaseAdmin().from("document_library").insert({
      product_version_id: input.productVersionId, document_name: input.documentName,
      document_type: input.documentType, version_label: input.versionLabel,
      variant: input.variant ?? null, age_band: input.ageBand ?? "All Ages",
      file_path: input.filePath, original_file_name: input.originalFileName,
      mime_type: input.mimeType, file_size_bytes: input.fileSizeBytes,
      effective_date: input.effectiveDate ?? null, expiry_date: input.expiryDate ?? null,
      status: input.status ?? "Active", approval_status: input.approvalStatus ?? "Pending Approval",
      notes: input.notes ?? null, distribution_notes: input.distributionNotes ?? null,
      uploaded_by: input.uploadedBy ?? null,
    }).select(SELECT).single<Joined>();
    if (error) throw toRepositoryError("DocumentLibraryRepository.create", error);
    return toDomain(data);
  }
  async update(id: string, input: LibraryDocumentUpdate) {
    const { data, error } = await getSupabaseAdmin().from("document_library").update(patch(input)).eq("id", id).select(SELECT).single<Joined>();
    if (error) throw toRepositoryError("DocumentLibraryRepository.update", error);
    return toDomain(data);
  }
  async approve(id: string) {
    const { data, error } = await getSupabaseAdmin().rpc("approve_document_library_asset", { p_asset_id: id }).single<Row>();
    if (error) throw toRepositoryError("DocumentLibraryRepository.approve", error);
    return (await this.findById(data.id))!;
  }
  archive(id: string) { return this.update(id, { status: "Inactive" }); }
}
