/**
 * Domain types for a Renewal — the tracked renewal cycle of a policy
 * (docs/data-model; table defined in supabase/migrations/0005_operations.sql).
 */

export interface Renewal {
  id: string;
  referenceNo: string | null;
  policyId: string;
  clientId: string;
  /** Joined convenience: client's full name. */
  clientName: string | null;
  /** Joined convenience: linked policy's reference number. */
  policyRef: string | null;
  /** Joined convenience: linked policy's policy number. */
  policyNumber: string | null;
  /** Joined convenience: linked policy's premium amount. */
  premiumAmount: number | null;
  renewalNoticeDate: string | null;
  policyExpiryDate: string | null;
  renewalDueDate: string | null;
  status: string;
  earlyPaymentFlag: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewRenewal {
  policyId: string;
  clientId: string;
  renewalNoticeDate?: string | null;
  policyExpiryDate?: string | null;
  renewalDueDate?: string | null;
  /** Defaults to 'Upcoming' in the database. */
  status?: string;
  notes?: string | null;
}

export interface RenewalUpdate {
  status?: string;
  renewalPaymentDate?: string | null;
  renewalCompletedDate?: string | null;
  notes?: string | null;
}
