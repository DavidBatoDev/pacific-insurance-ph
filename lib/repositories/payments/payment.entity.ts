/**
 * Domain types for the premium-collection ledger (design payments-page.md
 * Collections tab): every expected/received premium across Applications,
 * Renewals & Travel, tracked Awaiting → Received → Verified (+ Overdue).
 */

export type PaymentSource = "Application" | "Renewal" | "Travel" | "Policy" | "Other";

export interface Payment {
  id: string;
  referenceNo: string | null;
  clientId: string | null;
  clientName: string | null;
  policyId: string | null;
  applicationId: string | null;
  renewalId: string | null;
  travelRequestId: string | null;
  /** Derived from whichever source FK is set. */
  source: PaymentSource;
  /** Reference number of the source record, if any. */
  sourceRef: string | null;
  amount: number | null;
  currency: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  paymentMethod: string | null;
  paymentDate: string | null;
  status: string;
  orNumber: string | null;
  orReceivedDate: string | null;
  sentToPacificCross: boolean;
  proofDocumentId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * "installment n/m" only when the schedule really has several installments. An Annual renewal is
 * stored as installment 1 of 1 (trigger `0050`), which says nothing to staff (QA L16).
 */
export function installmentLabel(payment: Pick<Payment, "installmentNumber" | "installmentCount">): string | null {
  return payment.installmentNumber && payment.installmentCount && payment.installmentCount > 1
    ? `installment ${payment.installmentNumber}/${payment.installmentCount}`
    : null;
}

export interface PaymentUpdate {
  status?: string;
  amount?: number | null;
  policyId?: string | null;
  paymentMethod?: string | null;
  paymentDate?: string | null;
  orNumber?: string | null;
  orReceivedDate?: string | null;
  sentToPacificCross?: boolean;
  proofDocumentId?: string | null;
  notes?: string | null;
}

export interface NewPayment {
  clientId?: string | null;
  policyId?: string | null;
  applicationId?: string | null;
  renewalId?: string | null;
  travelRequestId?: string | null;
  amount?: number | null;
  paymentMethod?: string | null;
  status?: string;
  notes?: string | null;
}
