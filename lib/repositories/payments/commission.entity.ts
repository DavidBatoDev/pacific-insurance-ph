/**
 * Domain types for commission tracking (design payments-page.md Commissions
 * tab): OR number → voucher requested → follow-up → received → paid.
 */

export interface Commission {
  id: string;
  clientId: string | null;
  clientName: string | null;
  policyId: string | null;
  policyRef: string | null;
  paymentId: string | null;
  orNumber: string | null;
  /** DB voucher_status: Not Started / Waiting for OR / Voucher Pending /
   *  Issue · Follow-Up Required / Received / Paid. */
  status: string;
  estimatedAmount: number | null;
  amount: number | null;
  followUpDate: string | null;
  receivedDate: string | null;
  paidDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewCommission {
  clientId?: string | null;
  policyId?: string | null;
  paymentId?: string | null;
  orNumber?: string | null;
  status?: string;
  estimatedAmount?: number | null;
  followUpDate?: string | null;
  notes?: string | null;
}

export interface CommissionUpdate {
  status?: string;
  estimatedAmount?: number | null;
  amount?: number | null;
  followUpDate?: string | null;
  receivedDate?: string | null;
  paidDate?: string | null;
  notes?: string | null;
}
