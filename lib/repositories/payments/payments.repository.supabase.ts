import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type { Commission, CommissionUpdate, NewCommission } from "./commission.entity";
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
    paymentMethod: row.payment_method,
    paymentDate: row.payment_date,
    status: row.status,
    orNumber: row.or_number,
    orReceivedDate: row.or_received_date,
    sentToPacificCross: row.sent_to_pacific_cross,
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

  async list(): Promise<Payment[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("payments")
      .select(PAYMENT_SELECT)
      .order("created_at", { ascending: false })
      .returns<PaymentJoined[]>();
    if (error) throw toRepositoryError("PaymentsRepository.list", error);
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
  clients: { first_name: string; last_name: string } | null;
  policies: { reference_no: string | null } | null;
};

const COMMISSION_SELECT = `*,
  clients (first_name, last_name),
  policies (reference_no)`;

function commissionToDomain(row: CommissionJoined): Commission {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients
      ? [row.clients.first_name, row.clients.last_name].filter(Boolean).join(" ")
      : null,
    policyId: row.policy_id,
    policyRef: row.policies?.reference_no ?? null,
    paymentId: row.payment_id,
    orNumber: row.or_number,
    status: row.voucher_status,
    estimatedAmount: row.estimated_amount,
    amount: row.amount,
    followUpDate: row.follow_up_date,
    receivedDate: row.received_date,
    paidDate: row.paid_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

  async list(): Promise<Commission[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("commissions")
      .select(COMMISSION_SELECT)
      .order("created_at", { ascending: false })
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
        or_number: input.orNumber ?? null,
        ...(input.status !== undefined ? { voucher_status: input.status } : {}),
        estimated_amount: input.estimatedAmount ?? null,
        follow_up_date: input.followUpDate ?? null,
        notes: input.notes ?? null,
      })
      .select(COMMISSION_SELECT)
      .single<CommissionJoined>();
    if (error) throw toRepositoryError("CommissionsRepository.create", error);
    return commissionToDomain(data);
  }

  async update(id: string, input: CommissionUpdate): Promise<Commission> {
    const patch: Database["public"]["Tables"]["commissions"]["Update"] = {};
    if (input.status !== undefined) patch.voucher_status = input.status;
    if (input.estimatedAmount !== undefined) patch.estimated_amount = input.estimatedAmount;
    if (input.amount !== undefined) patch.amount = input.amount;
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
