/**
 * Domain types for an Application — a client's in-flight product application
 * (docs/data-model; table defined in supabase/migrations/0005_operations.sql).
 */

import type { Json } from "@/lib/supabase/types";

export interface ApplicationRequirementProgress {
  initialized: boolean;
  required: number;
  pending: number;
  received: number;
  incomplete: number;
  verified: number;
}

export interface Application {
  id: string;
  referenceNo: string | null;
  clientId: string;
  productVersionId: string | null;
  planOptionId: string | null;
  /** Joined convenience: client's full name. */
  clientName: string | null;
  /** Joined convenience: product name via product_versions → products. */
  productName: string | null;
  applicationType: string;
  /** Workflow-driven, free text (default 'Lead' in the database). */
  status: string;
  assignedUserId: string | null;
  dateStarted: string | null;
  dateSubmitted: string | null;
  coverageType: string | null;
  desiredStartDate: string | null;
  preferredPaymentMode: string | null;
  estimatedPremium: number | null;
  remoteSale: boolean;
  /** Principal applicant's underwriting inputs (G3). Height is total inches, weight pounds. */
  smokerStatus: string | null;
  heightInches: number | null;
  weightLbs: number | null;
  /** Principal applicant's nominated beneficiary (G4); dependents carry their own. */
  beneficiaryName: string | null;
  beneficiaryBirthdate: string | null;
  beneficiaryRelation: string | null;
  beneficiaryContact: string | null;
  preExistingStatus: string | null;
  medicalNotes: string | null;
  notes: string | null;
  wizardState: Json | null;
  /** Derived from the persisted C4 checklist; optional items are excluded from status counts. */
  requirementProgress: ApplicationRequirementProgress;
  createdAt: string;
  updatedAt: string;
}

export interface NewApplication {
  clientId: string;
  productVersionId?: string | null;
  planOptionId?: string | null;
  applicationType?: string;
  status?: string;
  assignedUserId?: string | null;
  dateStarted?: string | null;
  notes?: string | null;
  wizardState?: Json | null;
  coverageType?: string | null;
  desiredStartDate?: string | null;
  preferredPaymentMode?: string | null;
  estimatedPremium?: number | null;
  remoteSale?: boolean;
  smokerStatus?: string | null;
  heightInches?: number | null;
  weightLbs?: number | null;
  beneficiaryName?: string | null;
  beneficiaryBirthdate?: string | null;
  beneficiaryRelation?: string | null;
  beneficiaryContact?: string | null;
  preExistingStatus?: string | null;
  medicalNotes?: string | null;
}

export interface ApplicationUpdate {
  status?: string;
  dateSubmitted?: string | null;
  notes?: string | null;
  assignedUserId?: string | null;
  productVersionId?: string | null;
  planOptionId?: string | null;
  applicationType?: string;
  dateStarted?: string | null;
  wizardState?: Json | null;
  coverageType?: string | null;
  desiredStartDate?: string | null;
  preferredPaymentMode?: string | null;
  estimatedPremium?: number | null;
  remoteSale?: boolean;
  smokerStatus?: string | null;
  heightInches?: number | null;
  weightLbs?: number | null;
  beneficiaryName?: string | null;
  beneficiaryBirthdate?: string | null;
  beneficiaryRelation?: string | null;
  beneficiaryContact?: string | null;
  preExistingStatus?: string | null;
  medicalNotes?: string | null;
}
