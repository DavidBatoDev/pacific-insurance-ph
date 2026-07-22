import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { DEFAULT_LIST_LIMIT, statusListLiteral, toRepositoryError, type ListOptions } from "../types";
import type { Claim, NewClaim, ClaimUpdate } from "./claim.entity";
import type { ClaimsRepository } from "./claims.repository";

type ClaimRow = Database["public"]["Tables"]["claims"]["Row"];
type ClaimInsert = Database["public"]["Tables"]["claims"]["Insert"];
type ClaimPatch = Database["public"]["Tables"]["claims"]["Update"];

/** Row plus the joined display names/refs the lists render. */
type JoinedRow = ClaimRow & {
  clients: {
    first_name: string;
    last_name: string;
    group_members: { group_accounts: { id: string; name: string } | null }[];
  } | null;
  policies: { reference_no: string | null } | null;
};

const SELECT = `*,
  clients (first_name, last_name, group_members (group_accounts (id, name))),
  policies (reference_no)`;

function toDomain(row: JoinedRow): Claim {
  return {
    id: row.id,
    referenceNo: row.reference_no,
    clientId: row.client_id,
    clientName: row.clients
      ? [row.clients.first_name, row.clients.last_name].filter(Boolean).join(" ")
      : null,
    groupId: row.clients?.group_members?.[0]?.group_accounts?.id ?? null,
    groupName: row.clients?.group_members?.[0]?.group_accounts?.name ?? null,
    policyId: row.policy_id,
    policyRef: row.policies?.reference_no ?? null,
    claimType: row.claim_type,
    incidentDate: row.incident_date,
    status: row.status,
    amountClaimed: row.amount_claimed,
    amountApproved: row.amount_approved,
    currency: row.currency,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link ClaimsRepository}. */
export class SupabaseClaimsRepository implements ClaimsRepository {
  async findById(id: string): Promise<Claim | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("claims")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle<JoinedRow>();

    if (error) throw toRepositoryError("ClaimsRepository.findById", error);
    return data ? toDomain(data) : null;
  }

  async list(opts: ListOptions = {}): Promise<Claim[]> {
    let query = getSupabaseAdmin().from("claims").select(SELECT);
    if (opts.statusIn) query = query.in("status", opts.statusIn);
    if (opts.statusNotIn) query = query.not("status", "in", statusListLiteral(opts.statusNotIn));
    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(opts.limit ?? DEFAULT_LIST_LIMIT)
      .returns<JoinedRow[]>();

    if (error) throw toRepositoryError("ClaimsRepository.list", error);
    return (data ?? []).map(toDomain);
  }

  async listByClient(clientId: string): Promise<Claim[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("claims")
      .select(SELECT)
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .returns<JoinedRow[]>();

    if (error) throw toRepositoryError("ClaimsRepository.listByClient", error);
    return (data ?? []).map(toDomain);
  }

  async create(input: NewClaim): Promise<Claim> {
    const insert: ClaimInsert = {
      client_id: input.clientId,
      policy_id: input.policyId ?? null,
      claim_type: input.claimType ?? null,
      incident_date: input.incidentDate ?? null,
      amount_claimed: input.amountClaimed ?? null,
      notes: input.notes ?? null,
    };
    if (input.status !== undefined) insert.status = input.status;

    const { data, error } = await getSupabaseAdmin()
      .from("claims")
      .insert(insert)
      .select(SELECT)
      .single<JoinedRow>();

    if (error) throw toRepositoryError("ClaimsRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: ClaimUpdate): Promise<Claim> {
    const patch: ClaimPatch = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.amountApproved !== undefined) patch.amount_approved = input.amountApproved;
    if (input.outcome !== undefined) patch.outcome = input.outcome;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await getSupabaseAdmin()
      .from("claims")
      .update(patch)
      .eq("id", id)
      .select(SELECT)
      .single<JoinedRow>();

    if (error) throw toRepositoryError("ClaimsRepository.update", error);
    return toDomain(data);
  }
}
