/**
 * Domain types for commission payments and independently filed carrier vouchers.
 */

export interface Commission {
  id: string;
  clientId: string | null;
  clientName: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  policyId: string | null;
  policyRef: string | null;
  paymentId: string | null;
  pacificCrossContactId: string | null;
  pacificCrossContactName: string | null;
  pacificCrossContactEmail: string | null;
  pacificCrossContactStatus: string | null;
  orNumber: string | null;
  voucherDocumentId: string | null;
  voucherReference: string | null;
  voucherReceivedAt: string | null;
  voucherFileName: string | null;
  /** DB voucher_status: Not Started / Waiting for OR / Voucher Pending /
   *  Issue · Follow-Up Required / Received / Paid. */
  status: string;
  estimatedAmount: number | null;
  /** Rate (% of premium) the estimate used; null = pending/unknown. */
  ratePct: number | null;
  commissionRateId: string | null;
  /** Joined from the payment: the premium the commission is computed on (H9c breakdown). */
  premiumAmount: number | null;
  premiumCurrency: string | null;
  /** Joined from the rate row the estimate used. */
  rateProductName: string | null;
  rateBusinessType: string | null;
  rateEffectiveDate: string | null;
  amount: number | null;
  /** Currency of the recorded commission amount; copied from its payment at creation. */
  currency: string | null;
  followUpDate: string | null;
  receivedDate: string | null;
  paidDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Verified upload finalized atomically with the current voucher pointer. */
export interface FileCommissionVoucherInput {
  actorId: string;
  commissionId: string;
  storagePath: string;
  fileName: string;
  voucherReference: string | null;
  expectedDocumentId: string | null;
}

export interface NewCommission {
  clientId?: string | null;
  policyId?: string | null;
  paymentId?: string | null;
  pacificCrossContactId?: string | null;
  orNumber?: string | null;
  status?: string;
  estimatedAmount?: number | null;
  ratePct?: number | null;
  commissionRateId?: string | null;
  currency?: string | null;
  followUpDate?: string | null;
  notes?: string | null;
}

export interface CommissionUpdate {
  pacificCrossContactId?: string | null;
  status?: string;
  estimatedAmount?: number | null;
  amount?: number | null;
  currency?: string | null;
  followUpDate?: string | null;
  receivedDate?: string | null;
  paidDate?: string | null;
  notes?: string | null;
}
