export const EXTERNAL_COVERAGE_TYPES = [
  "HMO",
  "Corporate HMO",
  "Employer Health Plan",
  "Other Insurance",
  "Unknown",
] as const;
export type ExternalCoverageType = (typeof EXTERNAL_COVERAGE_TYPES)[number];

export const EXTERNAL_COVERAGE_STATUSES = ["Active", "Inactive"] as const;
export type ExternalCoverageStatus = (typeof EXTERNAL_COVERAGE_STATUSES)[number];

/**
 * Cover the client already holds somewhere else — for FlexiShield, the *first-layer* HMO plan the
 * product sits on top of. `maximumBenefitLimit` is the figure the whole second-layer product turns
 * on: FlexiShield pays once the first layer's limit is exhausted.
 *
 * `policyId` is null until a Pacific Cross policy is actually issued; the declaration is captured at
 * application time, which is well before that. `policies.first_layer_coverage_id` is the other half
 * of that link, set once the policy exists.
 */
export interface ExternalCoverage {
  id: string;
  clientId: string;
  policyId: string | null;
  coverageType: ExternalCoverageType | null;
  providerName: string | null;
  planName: string | null;
  maximumBenefitLimit: number | null;
  currency: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  status: ExternalCoverageStatus;
  /** The Certificate of Coverage, once it has been uploaded against the requirement. */
  proofDocumentId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewExternalCoverage {
  clientId: string;
  policyId?: string | null;
  coverageType?: ExternalCoverageType | null;
  providerName?: string | null;
  planName?: string | null;
  maximumBenefitLimit?: number | null;
  currency?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  status?: ExternalCoverageStatus;
  proofDocumentId?: string | null;
  notes?: string | null;
}

export type ExternalCoverageUpdate = Partial<Omit<NewExternalCoverage, "clientId">>;
