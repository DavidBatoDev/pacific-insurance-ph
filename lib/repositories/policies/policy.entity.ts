/**
 * Domain types for a Policy — an issued insurance contract for a client
 * (docs/data-model; table defined in supabase/migrations/0005_operations.sql).
 */

export interface Policy {
  id: string;
  referenceNo: string | null;
  clientId: string;
  /** Joined convenience: client's full name. */
  clientName: string | null;
  /** Joined convenience: product name via product_versions → products. */
  productName: string | null;
  /** Joined convenience: plan option's plan name. */
  planName: string | null;
  policyNumber: string | null;
  status: string;
  effectiveDate: string | null;
  expiryDate: string | null;
  renewalDate: string | null;
  currency: string | null;
  premiumAmount: number | null;
  paymentMode: string | null;
  assignedUserId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewPolicy {
  clientId: string;
  productVersionId?: string | null;
  planOptionId?: string | null;
  policyNumber?: string | null;
  /** Defaults to 'Pending' in the database. */
  status?: string;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  renewalDate?: string | null;
  premiumAmount?: number | null;
  paymentMode?: string | null;
  notes?: string | null;
}

export interface PolicyUpdate {
  status?: string;
  policyNumber?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  renewalDate?: string | null;
  premiumAmount?: number | null;
  notes?: string | null;
}
