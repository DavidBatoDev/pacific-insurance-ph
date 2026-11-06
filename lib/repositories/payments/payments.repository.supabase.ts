import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { DEFAULT_LIST_LIMIT, RepositoryError, statusListLiteral, toRepositoryError, type ListOptions } from "../types";
import type { Commission, CommissionUpdate, FileCommissionVoucherInput, NewCommission } from "./commission.entity";
import type { NewPayment, Payment, PaymentSource, PaymentUpdate } from "./payment.entity";
import type { CommissionsRepository, PaymentsRepository } from "./payments.repository";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type CommissionRow = Database["public"]["Tables"]["commissions"]["Row"];

type PaymentJoined = PaymentRow & {
  clients: { first_name: string; last_name: string } | null;
  applications: { reference_no: string | null } | null;
  renewals: { reference_no: string | null } | null;
  travel_requests: { reference_no: string | null } | null;
  policies: { reference_no: string | null } | null;
};

const PAYMENT_SELECT = `*,
  clients (first_name, last_name),
  applications (reference_no),
  renewals (reference_no),
  travel_requests (reference_no),
  policies (reference_no)`;

function paymentToDomain(row: PaymentJoined): Payment {
  const source: PaymentSource = row.application_id
    ? "Application"
    : row.renewal_id
      ? "Renewal"
      : row.travel_request_id
        ? "Travel"
        : row.policy_id
          ? "Policy"
          : "Other";
  return {
    id: row.id,
    referenceNo: row.reference_no,
    clientId: row.client_id,
    clientName: row.clients
      ? [row.clients.first_name, row.clients.last_name].filter(Boolean).join(" ")
      : null,
    policyId: row.policy_id,
    applicationId: row.application_id,
    renewalId: row.renewal_id,
    travelRequestId: row.travel_request_id,
    source,
    sourceRef:
      row.applications?.reference_no ??
      row.renewals?.reference_no ??
      row.travel_requests?.reference_no ??
      row.policies?.reference_no ??
      null,
    amount: row.amount,
    currency: row.currency,
    installmentNumber: row.installment_number,
    installmentCount: row.installment_count,
    paymentMethod: row.payment_method,
    paymentDate: row.payment_date,
    status: row.status,
    orNumber: row.or_number,
    orReceivedDate: row.or_received_date,
    sentToPacificCross: row.sent_to_pacific_cross,
    proofDocumentId: row.proof_document_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link PaymentsRepository}. */
export class SupabasePaymentsRepository implements PaymentsRepository {
  async findById(id: string): Promise<Payment | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("payments")
      .select(PAYMENT_SELECT)
      .eq("id", id)
      .maybeSingle<PaymentJoined>();
    if (error) throw toRepositoryError("PaymentsRepository.findById", error);
    return data ? paymentToDomain(data) : null;
  }

  async findByIds(ids: string[]): Promise<Payment[]> {
    if (ids.length === 0) return [];
    const { data, error } = await getSupabaseAdmin()
      .from("payments")
      .select(PAYMENT_SELECT)
      .in("id", ids)
      .returns<PaymentJoined[]>();
    if (error) throw toRepositoryError("PaymentsRepository.findByIds", error);
    return (data ?? []).map(paymentToDomain);
  }

  async list(opts: ListOptions = {}): Promise<Payment[]> {
    let query = getSupabaseAdmin().from("payments").select(PAYMENT_SELECT);
    if (opts.statusIn) query = query.in("status", opts.statusIn);
    if (opts.statusNotIn) query = query.not("status", "in", statusListLiteral(opts.statusNotIn));
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? DEFAULT_LIST_LIMIT)
      .returns<PaymentJoined[]>();
    if (error) throw toRepositoryError("PaymentsRepository.list", error);
    return (data ?? []).map(paymentToDomain);
  }

  async listByTravelRequest(travelRequestId: string): Promise<Payment[]> {
    const { data, error } = await getSupabaseAdmin().from("payments").select(PAYMENT_SELECT)
      .eq("travel_request_id", travelRequestId).order("created_at").returns<PaymentJoined[]>();
    if (error) throw toRepositoryError("PaymentsRepository.listByTravelRequest", error);
    return (data ?? []).map(paymentToDomain);
  }

  async listByApplication(applicationId: string): Promise<Payment[]> {
    const { data, error } = await getSupabaseAdmin().from("payments").select(PAYMENT_SELECT)
      .eq("application_id", applicationId).order("created_at").returns<PaymentJoined[]>();
    if (error) throw toRepositoryError("PaymentsRepository.listByApplication", error);
    return (data ?? []).map(paymentToDomain);
  }

  async create(input: NewPayment): Promise<Payment> {
    const { data, error } = await getSupabaseAdmin()
      .from("payments")
      .insert({
        client_id: input.clientId ?? null,
        policy_id: input.policyId ?? null,
        application_id: input.applicationId ?? null,
        renewal_id: input.renewalId ?? null,
        travel_request_id: input.travelRequestId ?? null,
        amount: input.amount ?? null,
        payment_method: input.paymentMethod ?? null,
        ...(input.status !== undefined ? { status: input.status } : {}),
        notes: input.notes ?? null,
      })
      .select(PAYMENT_SELECT)
      .single<PaymentJoined>();
    if (error) throw toRepositoryError("PaymentsRepository.create", error);
    return paymentToDomain(data);
  }

  async update(id: string, input: PaymentUpdate): Promise<Payment> {
    const patch: Database["public"]["Tables"]["payments"]["Update"] = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.amount !== undefined) patch.amount = input.amount;
    if (input.policyId !== undefined) patch.policy_id = input.policyId;
    if (input.paymentMethod !== undefined) patch.payment_method = input.paymentMethod;
    if (input.paymentDate !== undefined) patch.payment_date = input.paymentDate;
    if (input.orNumber !== undefined) patch.or_number = input.orNumber;
    if (input.orReceivedDate !== undefined) patch.or_received_date = input.orReceivedDate;
    if (input.sentToPacificCross !== undefined) patch.sent_to_pacific_cross = input.sentToPacificCross;
    if (input.proofDocumentId !== undefined) patch.proof_document_id = input.proofDocumentId;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await getSupabaseAdmin()
      .from("payments")
      .update(patch)
      .eq("id", id)
      .select(PAYMENT_SELECT)
      .single<PaymentJoined>();
    if (error) throw toRepositoryError("PaymentsRepository.update", error);
    return paymentToDomain(data);
  }
}

type CommissionJoined = CommissionRow & {
  clients: {
    first_name: string;
    last_name: string;
    assigned_user_id: string | null;
    assigned_user: { full_name: string } | null;
  } | null;
  policies: { reference_no: string | null } | null;
  external_contacts: { name: string; email: string | null; status: string } | null;
  payments: { amount: number | null; currency: string | null } | null;
  commission_rates: { business_type: string; effective_date: string; products: { name: string } | null } | null;
  voucher_document: { name: string } | null;
};

const COMMISSION_SELECT = `*,
  clients:clients!commissions_client_id_fkey (
    first_name, last_name, assigned_user_id,
    assigned_user:users!clients_assigned_user_id_fkey (full_name)
  ),
  policies:policies!commissions_policy_id_fkey (reference_no),
  external_contacts:external_contacts!commissions_pacific_cross_contact_id_fkey (name, email, status),
  payments:payments!commissions_payment_id_fkey (amount, currency),
  commission_rates:commission_rates!commissions_commission_rate_id_fkey (business_type, effective_date, products (name)),
  voucher_document:documents!commissions_voucher_document_id_fkey (name)`;

function commissionToDomain(row: CommissionJoined): Commission {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients
      ? [row.clients.first_name, row.clients.last_name].filter(Boolean).join(" ")
      : null,
    assignedUserId: row.clients?.assigned_user_id ?? null,
    assignedUserName: row.clients?.assigned_user?.full_name ?? null,
    policyId: row.policy_id,
    policyRef: row.policies?.reference_no ?? null,
    paymentId: row.payment_id,
    pacificCrossContactId: row.pacific_cross_contact_id,
    pacificCrossContactName: row.external_contacts?.name ?? null,
    pacificCrossContactEmail: row.external_contacts?.email ?? null,
    pacificCrossContactStatus: row.external_contacts?.status ?? null,
    orNumber: row.or_number,
    voucherDocumentId: row.voucher_document_id,
    voucherReference: row.voucher_reference,
    voucherReceivedAt: row.voucher_received_at,
    voucherFileName: row.voucher_document?.name ?? null,
    status: row.voucher_status,
    estimatedAmount: row.estimated_amount,
    ratePct: row.rate_pct == null ? null : Number(row.rate_pct),
    commissionRateId: row.commission_rate_id,
    premiumAmount: row.payments?.amount == null ? null : Number(row.payments.amount),
    premiumCurrency: row.payments?.currency ?? null,
    rateProductName: row.commission_rates?.products?.name ?? null,
    rateBusinessType: row.commission_rates?.business_type ?? null,
    rateEffectiveDate: row.commission_rates?.effective_date ?? null,
    amount: row.amount,
    currency: row.currency,
    followUpDate: row.follow_up_date,
    receivedDate: row.received_date,
    paidDate: row.paid_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function commissionMutationError(message: string | undefined, fallback: string): RepositoryError {
  // RPC details can contain confidential filenames/paths. Expose only known safe errors.
  const safeMessages = [
    "Not authenticated.",
    "Your account is inactive.",
    "Commission not found.",
    "The voucher changed. Reload before replacing it.",
  ];
  return new RepositoryError(message && safeMessages.includes(message) ? message : fallback, {
    code: message === "The voucher changed. Reload before replacing it."
      ? "commission_voucher_conflict"
      : "commission_mutation_failed",
  });
}

/** supabase-js (service role) implementation of {@link CommissionsRepository}. */
export class SupabaseCommissionsRepository implements CommissionsRepository {
  async findById(id: string): Promise<Commission | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("commissions")
      .select(COMMISSION_SELECT)
      .eq("id", id)
      .maybeSingle<CommissionJoined>();
    if (error) throw toRepositoryError("CommissionsRepository.findById", error);
    return data ? commissionToDomain(data) : null;
  }

  async list(opts: ListOptions = {}): Promise<Commission[]> {
    let query = getSupabaseAdmin().from("commissions").select(COMMISSION_SELECT);
    if (opts.statusIn) query = query.in("status", opts.statusIn);
    if (opts.statusNotIn) query = query.not("status", "in", statusListLiteral(opts.statusNotIn));
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? DEFAULT_LIST_LIMIT)
      .returns<CommissionJoined[]>();
    if (error) throw toRepositoryError("CommissionsRepository.list", error);
    return (data ?? []).map(commissionToDomain);
  }

  async create(input: NewCommission): Promise<Commission> {
    const { data, error } = await getSupabaseAdmin()
      .from("commissions")
      .insert({
        client_id: input.clientId ?? null,
        policy_id: input.policyId ?? null,
        payment_id: input.paymentId ?? null,
        pacific_cross_contact_id: input.pacificCrossContactId ?? null,
        or_number: input.orNumber ?? null,
        ...(input.status !== undefined ? { voucher_status: input.status } : {}),
        estimated_amount: input.estimatedAmount ?? null,
        rate_pct: input.ratePct ?? null,
        commission_rate_id: input.commissionRateId ?? null,
        currency: input.currency ?? "PHP",
        follow_up_date: input.followUpDate ?? null,
        notes: input.notes ?? null,
      })
      .select(COMMISSION_SELECT)
      .single<CommissionJoined>();
    if (error) throw toRepositoryError("CommissionsRepository.create", error);
    return commissionToDomain(data);
  }

  async fileVoucher(input: FileCommissionVoucherInput): Promise<Commission> {
    // Supabase's generator omits SQL argument nullability. This RPC explicitly
    // accepts null for a missing carrier reference and an initial expected pointer.
    const { data, error } = await getSupabaseAdmin().rpc("file_commission_voucher", {
      p_actor_id: input.actorId,
      p_commission_id: input.commissionId,
      p_storage_path: input.storagePath,
      p_file_name: input.fileName,
      p_voucher_reference: input.voucherReference,
      p_expected_document_id: input.expectedDocumentId,
    } as Database["public"]["Functions"]["file_commission_voucher"]["Args"]);
    if (error || !data) {
      throw commissionMutationError(error?.message, "The commission voucher could not be filed.");
    }
    const commission = await this.findById(input.commissionId);
    if (!commission) {
      throw new RepositoryError("The voucher was filed but the commission could not be loaded. Refresh the record.", {
        code: "commission_voucher_unavailable",
      });
    }
    return commission;
  }

  async transition(actorId: string, id: string, step: "requested" | "follow-up" | "paid"): Promise<Commission> {
    const { data, error } = await getSupabaseAdmin().rpc("transition_commission", {
      p_actor_id: actorId,
      p_commission_id: id,
      p_step: step,
    });
    if (error || !data) {
      throw commissionMutationError(error?.message, "The commission status could not be updated.");
    }
    const commission = await this.findById(data);
    if (!commission) {
      throw new RepositoryError("The commission was updated but could not be loaded. Refresh the record.", {
        code: "commission_transition_unavailable",
      });
    }
    return commission;
  }

  async update(id: string, input: CommissionUpdate): Promise<Commission> {
    const patch: Database["public"]["Tables"]["commissions"]["Update"] = {};
    if (input.pacificCrossContactId !== undefined) patch.pacific_cross_contact_id = input.pacificCrossContactId;
    if (input.status !== undefined) patch.voucher_status = input.status;
    if (input.estimatedAmount !== undefined) patch.estimated_amount = input.estimatedAmount;
    if (input.amount !== undefined) patch.amount = input.amount;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.followUpDate !== undefined) patch.follow_up_date = input.followUpDate;
    if (input.receivedDate !== undefined) patch.received_date = input.receivedDate;
    if (input.paidDate !== undefined) patch.paid_date = input.paidDate;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await getSupabaseAdmin()
      .from("commissions")
      .update(patch)
      .eq("id", id)
      .select(COMMISSION_SELECT)
      .single<CommissionJoined>();
    if (error) throw toRepositoryError("CommissionsRepository.update", error);
    return commissionToDomain(data);
  }
}
