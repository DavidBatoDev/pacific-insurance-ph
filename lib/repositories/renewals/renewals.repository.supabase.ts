import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type { Renewal, NewRenewal, RenewalUpdate } from "./renewal.entity";
import type { RenewalsRepository } from "./renewals.repository";

type RenewalRow = Database["public"]["Tables"]["renewals"]["Row"];
type RenewalInsert = Database["public"]["Tables"]["renewals"]["Insert"];
type RenewalPatch = Database["public"]["Tables"]["renewals"]["Update"];

/** Row plus the joined display names/refs the lists render. */
type JoinedRow = RenewalRow & {
  clients: { first_name: string; last_name: string } | null;
  policies: {
    reference_no: string | null;
    policy_number: string | null;
    premium_amount: number | null;
  } | null;
};

const SELECT = `*,
  clients (first_name, last_name),
  policies (reference_no, policy_number, premium_amount)`;

function toDomain(row: JoinedRow): Renewal {
  return {
    id: row.id,
    referenceNo: row.reference_no,
    policyId: row.policy_id,
    clientId: row.client_id,
    clientName: row.clients
      ? [row.clients.first_name, row.clients.last_name].filter(Boolean).join(" ")
      : null,
    policyRef: row.policies?.reference_no ?? null,
    policyNumber: row.policies?.policy_number ?? null,
    premiumAmount: row.policies?.premium_amount ?? null,
    renewalNoticeDate: row.renewal_notice_date,
    policyExpiryDate: row.policy_expiry_date,
    renewalDueDate: row.renewal_due_date,
    status: row.status,
    earlyPaymentFlag: row.early_payment_flag,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link RenewalsRepository}. */
export class SupabaseRenewalsRepository implements RenewalsRepository {
  async findById(id: string): Promise<Renewal | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("renewals")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle<JoinedRow>();

    if (error) throw toRepositoryError("RenewalsRepository.findById", error);
    return data ? toDomain(data) : null;
  }

  async list(): Promise<Renewal[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("renewals")
      .select(SELECT)
      .order("renewal_due_date", { ascending: true, nullsFirst: false })
      .returns<JoinedRow[]>();

    if (error) throw toRepositoryError("RenewalsRepository.list", error);
    return (data ?? []).map(toDomain);
  }

  async listByClient(clientId: string): Promise<Renewal[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("renewals")
      .select(SELECT)
      .eq("client_id", clientId)
      .order("renewal_due_date", { ascending: true, nullsFirst: false })
      .returns<JoinedRow[]>();

    if (error) throw toRepositoryError("RenewalsRepository.listByClient", error);
    return (data ?? []).map(toDomain);
  }

  async create(input: NewRenewal): Promise<Renewal> {
    const insert: RenewalInsert = {
      policy_id: input.policyId,
      client_id: input.clientId,
      renewal_notice_date: input.renewalNoticeDate ?? null,
      policy_expiry_date: input.policyExpiryDate ?? null,
      renewal_due_date: input.renewalDueDate ?? null,
      notes: input.notes ?? null,
    };
    if (input.status !== undefined) insert.status = input.status;

    const { data, error } = await getSupabaseAdmin()
      .from("renewals")
      .insert(insert)
      .select(SELECT)
      .single<JoinedRow>();

    if (error) throw toRepositoryError("RenewalsRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: RenewalUpdate): Promise<Renewal> {
    const patch: RenewalPatch = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.renewalPaymentDate !== undefined) patch.renewal_payment_date = input.renewalPaymentDate;
    if (input.renewalCompletedDate !== undefined)
      patch.renewal_completed_date = input.renewalCompletedDate;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await getSupabaseAdmin()
      .from("renewals")
      .update(patch)
      .eq("id", id)
      .select(SELECT)
      .single<JoinedRow>();

    if (error) throw toRepositoryError("RenewalsRepository.update", error);
    return toDomain(data);
  }
}
