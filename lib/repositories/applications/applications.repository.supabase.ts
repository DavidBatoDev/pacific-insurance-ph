import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { DEFAULT_LIST_LIMIT, statusListLiteral, toRepositoryError, type ListOptions } from "../types";
import type { Application, ApplicationRequirementProgress, NewApplication, ApplicationUpdate } from "./application.entity";
import type { ApplicationsRepository } from "./applications.repository";

type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];
type ApplicationInsert = Database["public"]["Tables"]["applications"]["Insert"];
type ApplicationPatch = Database["public"]["Tables"]["applications"]["Update"];

/** Row plus the joined display names the lists render. */
type JoinedRow = ApplicationRow & {
  clients: { first_name: string; last_name: string } | null;
  product_versions: { product: { name: string } | null } | null;
  application_requirements: Array<{ is_required: boolean; status: string }> | null;
};

const SELECT = `*,
  clients (first_name, last_name),
  product_versions (product:products (name)),
  application_requirements (is_required, status)`;

function requirementProgress(row: JoinedRow): ApplicationRequirementProgress {
  const all = row.application_requirements ?? [];
  const required = all.filter((item) => item.is_required);
  const count = (status: string) => required.filter((item) => item.status === status).length;
  return {
    initialized: all.length > 0,
    required: required.length,
    pending: count("Pending"),
    received: count("Received"),
    incomplete: count("Incomplete"),
    verified: count("Verified"),
  };
}

function toDomain(row: JoinedRow): Application {
  return {
    id: row.id,
    referenceNo: row.reference_no,
    clientId: row.client_id,
    productVersionId: row.product_version_id,
    planOptionId: row.plan_option_id,
    clientName: row.clients
      ? [row.clients.first_name, row.clients.last_name].filter(Boolean).join(" ")
      : null,
    productName: row.product_versions?.product?.name ?? null,
    applicationType: row.application_type,
    status: row.status,
    assignedUserId: row.assigned_user_id,
    dateStarted: row.date_started,
    dateSubmitted: row.date_submitted,
    coverageType: row.coverage_type,
    desiredStartDate: row.desired_start_date,
    preferredPaymentMode: row.preferred_payment_mode,
    estimatedPremium: row.estimated_premium,
    remoteSale: row.remote_sale,
    smokerStatus: row.smoker_status,
    heightInches: row.height_inches,
    weightLbs: row.weight_lbs,
    beneficiaryName: row.beneficiary_name,
    beneficiaryBirthdate: row.beneficiary_birthdate,
    beneficiaryRelation: row.beneficiary_relation,
    beneficiaryContact: row.beneficiary_contact,
    preExistingStatus: row.pre_existing_status,
    medicalNotes: row.medical_notes,
    notes: row.notes,
    wizardState: row.wizard_state,
    requirementProgress: requirementProgress(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link ApplicationsRepository}. */
export class SupabaseApplicationsRepository implements ApplicationsRepository {
  async findById(id: string): Promise<Application | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("applications")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle<JoinedRow>();

    if (error) throw toRepositoryError("ApplicationsRepository.findById", error);
    return data ? toDomain(data) : null;
  }

  async list(opts: ListOptions = {}): Promise<Application[]> {
    let query = getSupabaseAdmin().from("applications").select(SELECT);
    if (opts.statusIn) query = query.in("status", opts.statusIn);
    if (opts.statusNotIn) query = query.not("status", "in", statusListLiteral(opts.statusNotIn));
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? DEFAULT_LIST_LIMIT)
      .returns<JoinedRow[]>();

    if (error) throw toRepositoryError("ApplicationsRepository.list", error);
    return (data ?? []).map(toDomain);
  }

  async listByClient(clientId: string): Promise<Application[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("applications")
      .select(SELECT)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .returns<JoinedRow[]>();

    if (error) throw toRepositoryError("ApplicationsRepository.listByClient", error);
    return (data ?? []).map(toDomain);
  }

  async create(input: NewApplication): Promise<Application> {
    const insert: ApplicationInsert = {
      client_id: input.clientId,
      product_version_id: input.productVersionId ?? null,
      plan_option_id: input.planOptionId ?? null,
      assigned_user_id: input.assignedUserId ?? null,
      date_started: input.dateStarted ?? null,
      notes: input.notes ?? null,
      wizard_state: input.wizardState ?? null,
      coverage_type: input.coverageType ?? null,
      desired_start_date: input.desiredStartDate ?? null,
      preferred_payment_mode: input.preferredPaymentMode ?? null,
      estimated_premium: input.estimatedPremium ?? null,
      remote_sale: input.remoteSale ?? false,
      smoker_status: input.smokerStatus ?? null,
      height_inches: input.heightInches ?? null,
      weight_lbs: input.weightLbs ?? null,
      beneficiary_name: input.beneficiaryName ?? null,
      beneficiary_birthdate: input.beneficiaryBirthdate ?? null,
      beneficiary_relation: input.beneficiaryRelation ?? null,
      beneficiary_contact: input.beneficiaryContact ?? null,
      pre_existing_status: input.preExistingStatus ?? null,
      medical_notes: input.medicalNotes ?? null,
    };
    if (input.applicationType !== undefined) insert.application_type = input.applicationType;
    if (input.status !== undefined) insert.status = input.status;

    const { data, error } = await getSupabaseAdmin()
      .from("applications")
      .insert(insert)
      .select(SELECT)
      .single<JoinedRow>();

    if (error) throw toRepositoryError("ApplicationsRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: ApplicationUpdate): Promise<Application> {
    const patch: ApplicationPatch = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.dateSubmitted !== undefined) patch.date_submitted = input.dateSubmitted;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.assignedUserId !== undefined) patch.assigned_user_id = input.assignedUserId;
    if (input.productVersionId !== undefined) patch.product_version_id = input.productVersionId;
    if (input.planOptionId !== undefined) patch.plan_option_id = input.planOptionId;
    if (input.applicationType !== undefined) patch.application_type = input.applicationType;
    if (input.dateStarted !== undefined) patch.date_started = input.dateStarted;
    if (input.wizardState !== undefined) patch.wizard_state = input.wizardState;
    if (input.coverageType !== undefined) patch.coverage_type = input.coverageType;
    if (input.desiredStartDate !== undefined) patch.desired_start_date = input.desiredStartDate;
    if (input.preferredPaymentMode !== undefined) patch.preferred_payment_mode = input.preferredPaymentMode;
    if (input.estimatedPremium !== undefined) patch.estimated_premium = input.estimatedPremium;
    if (input.remoteSale !== undefined) patch.remote_sale = input.remoteSale;
    if (input.smokerStatus !== undefined) patch.smoker_status = input.smokerStatus;
    if (input.heightInches !== undefined) patch.height_inches = input.heightInches;
    if (input.weightLbs !== undefined) patch.weight_lbs = input.weightLbs;
    if (input.beneficiaryName !== undefined) patch.beneficiary_name = input.beneficiaryName;
    if (input.beneficiaryBirthdate !== undefined) patch.beneficiary_birthdate = input.beneficiaryBirthdate;
    if (input.beneficiaryRelation !== undefined) patch.beneficiary_relation = input.beneficiaryRelation;
    if (input.beneficiaryContact !== undefined) patch.beneficiary_contact = input.beneficiaryContact;
    if (input.preExistingStatus !== undefined) patch.pre_existing_status = input.preExistingStatus;
    if (input.medicalNotes !== undefined) patch.medical_notes = input.medicalNotes;

    const { data, error } = await getSupabaseAdmin()
      .from("applications")
      .update(patch)
      .eq("id", id)
      .select(SELECT)
      .single<JoinedRow>();

    if (error) throw toRepositoryError("ApplicationsRepository.update", error);
    return toDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from("applications")
      .delete()
      .eq("id", id);

    if (error) throw toRepositoryError("ApplicationsRepository.delete", error);
  }
}
