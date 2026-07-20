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
  paymentMethod: string | null;
  paymentDate: string | null;
  status: string;
  orNumber: string | null;
  orReceivedDate: string | null;
  sentToPacificCross: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentUpdate {
  status?: string;
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
