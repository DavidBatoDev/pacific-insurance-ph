import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { DEFAULT_LIST_LIMIT, statusListLiteral, toRepositoryError, type ListOptions } from "../types";
import type { Policy, NewPolicy, PolicyUpdate } from "./policy.entity";
import type { PoliciesRepository } from "./policies.repository";

type PolicyRow = Database["public"]["Tables"]["policies"]["Row"];
type PolicyInsert = Database["public"]["Tables"]["policies"]["Insert"];
type PolicyPatch = Database["public"]["Tables"]["policies"]["Update"];

/** Row plus the joined display names the lists render. */
type JoinedRow = PolicyRow & {
  clients: {
    first_name: string;
    last_name: string;
    group_members: { group_accounts: { id: string; name: string } | null }[];
  } | null;
  product_versions: { product: { name: string } | null } | null;
  plan_options: { plan_name: string } | null;
};

const SELECT = `*,
  clients (first_name, last_name, group_members (group_accounts (id, name))),
  product_versions (product:products (name)),
  plan_options (plan_name)`;

function toDomain(row: JoinedRow): Policy {
  return {
    id: row.id,
    referenceNo: row.reference_no,
    clientId: row.client_id,
    clientName: row.clients
      ? [row.clients.first_name, row.clients.last_name].filter(Boolean).join(" ")
      : null,
    groupId: row.clients?.group_members?.[0]?.group_accounts?.id ?? null,
    groupName: row.clients?.group_members?.[0]?.group_accounts?.name ?? null,
    productName: row.product_versions?.product?.name ?? null,
    planName: row.plan_options?.plan_name ?? null,
    policyNumber: row.policy_number,
    status: row.status,
    effectiveDate: row.effective_date,
    expiryDate: row.expiry_date,
    renewalDate: row.renewal_date,
    currency: row.currency,
    premiumAmount: row.premium_amount,
    paymentMode: row.payment_mode,
    assignedUserId: row.assigned_user_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link PoliciesRepository}. */
export class SupabasePoliciesRepository implements PoliciesRepository {
  async findById(id: string): Promise<Policy | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("policies")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle<JoinedRow>();

    if (error) throw toRepositoryError("PoliciesRepository.findById", error);
    return data ? toDomain(data) : null;
  }

  async list(opts: ListOptions = {}): Promise<Policy[]> {
    let query = getSupabaseAdmin().from("policies").select(SELECT);
    if (opts.statusIn) query = query.in("status", opts.statusIn);
    if (opts.statusNotIn) query = query.not("status", "in", statusListLiteral(opts.statusNotIn));
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? DEFAULT_LIST_LIMIT)
      .returns<JoinedRow[]>();

    if (error) throw toRepositoryError("PoliciesRepository.list", error);
    return (data ?? []).map(toDomain);
  }

  async listByClient(clientId: string): Promise<Policy[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("policies")
      .select(SELECT)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .returns<JoinedRow[]>();

    if (error) throw toRepositoryError("PoliciesRepository.listByClient", error);
    return (data ?? []).map(toDomain);
  }

  async create(input: NewPolicy): Promise<Policy> {
    const insert: PolicyInsert = {
      client_id: input.clientId,
      product_version_id: input.productVersionId ?? null,
      plan_option_id: input.planOptionId ?? null,
      policy_number: input.policyNumber ?? null,
      effective_date: input.effectiveDate ?? null,
      expiry_date: input.expiryDate ?? null,
      renewal_date: input.renewalDate ?? null,
      premium_amount: input.premiumAmount ?? null,
      payment_mode: input.paymentMode ?? null,
      notes: input.notes ?? null,
    };
    if (input.status !== undefined) insert.status = input.status;

    const { data, error } = await getSupabaseAdmin()
      .from("policies")
      .insert(insert)
      .select(SELECT)
      .single<JoinedRow>();

    if (error) throw toRepositoryError("PoliciesRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: PolicyUpdate): Promise<Policy> {
    const patch: PolicyPatch = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.policyNumber !== undefined) patch.policy_number = input.policyNumber;
    if (input.effectiveDate !== undefined) patch.effective_date = input.effectiveDate;
    if (input.expiryDate !== undefined) patch.expiry_date = input.expiryDate;
    if (input.renewalDate !== undefined) patch.renewal_date = input.renewalDate;
    if (input.premiumAmount !== undefined) patch.premium_amount = input.premiumAmount;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await getSupabaseAdmin()
      .from("policies")
      .update(patch)
      .eq("id", id)
      .select(SELECT)
      .single<JoinedRow>();

    if (error) throw toRepositoryError("PoliciesRepository.update", error);
    return toDomain(data);
  }
}
