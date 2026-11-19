import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { DEFAULT_LIST_LIMIT, ownerScopedSelect, ownerScopeFilter, RepositoryError, statusListLiteral, toRepositoryError, type ListOptions } from "../types";
import type { Renewal, NewRenewal, RenewalUpdate, RenewalSyncResult } from "./renewal.entity";
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
    currency: string | null;
  } | null;
};

const SELECT = `*,
  clients (first_name, last_name),
  policies (reference_no, policy_number, premium_amount, currency)`;

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
    currency: row.policies?.currency ?? null,
    renewalNoticeDate: row.renewal_notice_date,
    noticeReceivedDate: row.notice_received_date,
    policyExpiryDate: row.policy_expiry_date,
    renewalDueDate: row.renewal_due_date,
    renewalCompletedDate: row.renewal_completed_date,
    status: row.status,
    earlyPaymentFlag: row.early_payment_flag,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPatch(input: RenewalUpdate): RenewalPatch {
  const patch: RenewalPatch = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.noticeReceivedDate !== undefined) patch.notice_received_date = input.noticeReceivedDate;
  if (input.renewalPaymentDate !== undefined) patch.renewal_payment_date = input.renewalPaymentDate;
  if (input.renewalCompletedDate !== undefined)
    patch.renewal_completed_date = input.renewalCompletedDate;
  if (input.notes !== undefined) patch.notes = input.notes;
  return patch;
}

const RENEWAL_CONFLICT = "This renewal changed. Reload and try again.";

/** Business errors raised by complete_renewal / lapse_renewal; anything else is SQL internals. */
const LIFECYCLE_SAFE_MESSAGES: readonly string[] = [
  "Not authenticated.",
  "Your account is inactive.",
  "Record not found.",
  RENEWAL_CONFLICT,
  "Only a paid renewal can be marked renewed.",
  "New expiry must be after the current renewal dates and today.",
  "A newer renewal cycle already exists. Review the policy before completing this renewal.",
  "Next renewal cycle was not created.",
  "A paid or renewed renewal cannot be lapsed.",
  "Only an overdue renewal can be marked lapsed.",
];

function lifecycleMutationError(message: string | undefined, fallback: string): RepositoryError {
  return new RepositoryError(message && LIFECYCLE_SAFE_MESSAGES.includes(message) ? message : fallback, {
    code: message === RENEWAL_CONFLICT ? "renewal_conflict" : "renewal_lifecycle_failed",
  });
}

/** supabase-js (service role) implementation of {@link RenewalsRepository}. */
export class SupabaseRenewalsRepository implements RenewalsRepository {
  async synchronizeFromPolicies(): Promise<RenewalSyncResult[]> {
    const { data, error } = await getSupabaseAdmin().rpc("sync_policy_renewals");
    if (error) throw toRepositoryError("RenewalsRepository.synchronizeFromPolicies", error);
    return (data ?? []).map((row) => ({
      policyId: row.policy_id,
      renewalId: row.renewal_id ?? null,
      outcome: row.outcome as RenewalSyncResult["outcome"],
    }));
  }

  async findById(id: string): Promise<Renewal | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("renewals")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle<JoinedRow>();

    if (error) throw toRepositoryError("RenewalsRepository.findById", error);
    return data ? toDomain(data) : null;
  }

  async list(opts: ListOptions = {}): Promise<Renewal[]> {
    let query = ownerScopeFilter(getSupabaseAdmin().from("renewals").select(ownerScopedSelect(SELECT, opts.ownerUserId)), opts.ownerUserId);
    if (opts.statusIn) query = query.in("status", opts.statusIn);
    if (opts.statusNotIn) query = query.not("status", "in", statusListLiteral(opts.statusNotIn));
    const { data, error } = await query
      .order("renewal_due_date", { ascending: true, nullsFirst: false })
      .limit(opts.limit ?? DEFAULT_LIST_LIMIT)
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
      notice_received_date: input.noticeReceivedDate ?? null,
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
    const { data, error } = await getSupabaseAdmin()
      .from("renewals")
      .update(toPatch(input))
      .eq("id", id)
      .select(SELECT)
      .single<JoinedRow>();

    if (error) throw toRepositoryError("RenewalsRepository.update", error);
    return toDomain(data);
  }

  async transition(id: string, from: readonly string[], input: RenewalUpdate): Promise<Renewal | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("renewals")
      .update(toPatch(input))
      .eq("id", id)
      .in("status", from)
      .select(SELECT)
      .maybeSingle<JoinedRow>();

    if (error) throw toRepositoryError("RenewalsRepository.transition", error);
    return data ? toDomain(data) : null;
  }

  async completeRenewal(id: string, actorId: string, expectedUpdatedAt: string, newExpiryDate: string): Promise<Renewal> {
    const { data, error } = await getSupabaseAdmin().rpc("complete_renewal", {
      p_actor_id: actorId,
      p_renewal_id: id,
      p_expected_updated_at: expectedUpdatedAt,
      p_new_expiry_date: newExpiryDate,
    });
    if (error || !data) throw lifecycleMutationError(error?.message, "The renewal could not be marked renewed.");
    return this.reloadAfterLifecycle(data, "The renewal was marked renewed but could not be loaded. Refresh the page.");
  }

  async lapseRenewal(id: string, actorId: string, expectedUpdatedAt: string): Promise<Renewal> {
    const { data, error } = await getSupabaseAdmin().rpc("lapse_renewal", {
      p_actor_id: actorId,
      p_renewal_id: id,
      p_expected_updated_at: expectedUpdatedAt,
    });
    if (error || !data) throw lifecycleMutationError(error?.message, "The renewal could not be marked lapsed.");
    return this.reloadAfterLifecycle(data, "The renewal was marked lapsed but could not be loaded. Refresh the page.");
  }

  private async reloadAfterLifecycle(id: string, missingMessage: string): Promise<Renewal> {
    const renewal = await this.findById(id);
    if (!renewal) throw new RepositoryError(missingMessage, { code: "renewal_lifecycle_unavailable" });
    return renewal;
  }
}
