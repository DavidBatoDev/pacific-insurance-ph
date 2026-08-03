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
    clientName: row.clients
      ? [row.clients.first_name, row.clients.last_name].filter(Boolean).join(" ")
      : null,
    productName: row.product_versions?.product?.name ?? null,
    applicationType: row.application_type,
    status: row.status,
    assignedUserId: row.assigned_user_id,
    dateStarted: row.date_started,
    dateSubmitted: row.date_submitted,
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
      assigned_user_id: input.assignedUserId ?? null,
      date_started: input.dateStarted ?? null,
      notes: input.notes ?? null,
      wizard_state: input.wizardState ?? null,
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
    if (input.applicationType !== undefined) patch.application_type = input.applicationType;
    if (input.dateStarted !== undefined) patch.date_started = input.dateStarted;
    if (input.wizardState !== undefined) patch.wizard_state = input.wizardState;

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
