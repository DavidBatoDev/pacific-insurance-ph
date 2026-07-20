/**
 * Domain types for a Claim — a client's claim against a policy
 * (docs/data-model; table defined in supabase/migrations/0005_operations.sql).
 */

export interface Claim {
  id: string;
  referenceNo: string | null;
  clientId: string;
  /** Joined convenience: client's full name. */
  clientName: string | null;
  policyId: string | null;
  /** Joined convenience: linked policy's reference number. */
  policyRef: string | null;
  claimType: string | null;
  incidentDate: string | null;
  status: string;
  amountClaimed: number | null;
  amountApproved: number | null;
  currency: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewClaim {
  clientId: string;
  policyId?: string | null;
  claimType?: string | null;
  incidentDate?: string | null;
  /** Defaults to 'Draft' in the database. */
  status?: string;
  amountClaimed?: number | null;
  notes?: string | null;
}

export interface ClaimUpdate {
  status?: string;
  amountApproved?: number | null;
  outcome?: string | null;
  notes?: string | null;
}
