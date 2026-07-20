import type { CommissionsRepository, PaymentsRepository } from "./payments.repository";
import {
  SupabaseCommissionsRepository,
  SupabasePaymentsRepository,
} from "./payments.repository.supabase";

let payments: PaymentsRepository | null = null;
let commissions: CommissionsRepository | null = null;

/** Resolve the Payments (collections) repository. */
export function getPaymentsRepository(): PaymentsRepository {
  if (!payments) {
    payments = new SupabasePaymentsRepository();
  }
  return payments;
}

/** Resolve the Commissions repository. */
export function getCommissionsRepository(): CommissionsRepository {
  if (!commissions) {
    commissions = new SupabaseCommissionsRepository();
  }
  return commissions;
}

export type { PaymentsRepository, CommissionsRepository } from "./payments.repository";
export type { Payment, NewPayment, PaymentUpdate, PaymentSource } from "./payment.entity";
export type { Commission, NewCommission, CommissionUpdate } from "./commission.entity";
