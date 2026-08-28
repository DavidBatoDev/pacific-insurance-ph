import type { ListOptions } from "../types";
import type { NewCommission, Commission, CommissionUpdate } from "./commission.entity";
import type { NewPayment, Payment, PaymentUpdate } from "./payment.entity";

/** The Payments (collections ledger) repository port. */
export interface PaymentsRepository {
  findById(id: string): Promise<Payment | null>;
  findByIds(ids: string[]): Promise<Payment[]>;
  list(opts?: ListOptions): Promise<Payment[]>;
  listByTravelRequest(travelRequestId: string): Promise<Payment[]>;
  create(input: NewPayment): Promise<Payment>;
  update(id: string, input: PaymentUpdate): Promise<Payment>;
}

/** The Commissions repository port. */
export interface CommissionsRepository {
  findById(id: string): Promise<Commission | null>;
  list(opts?: ListOptions): Promise<Commission[]>;
  create(input: NewCommission): Promise<Commission>;
  update(id: string, input: CommissionUpdate): Promise<Commission>;
}
