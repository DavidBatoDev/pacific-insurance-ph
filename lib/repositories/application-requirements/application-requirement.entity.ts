import type { RequirementSection } from "@/lib/applications/requirement-sections";
export type { RequirementSection } from "@/lib/applications/requirement-sections";

export const REQUIREMENT_PHASES = ["For proposal", "Once the group agrees"] as const;
/**
 * Which gate a requirement belongs to. `null` means it applies throughout, which is every
 * non-phased template. Post-agreement items are snapshotted `isRequired: false` so they are visible
 * as forthcoming without counting as outstanding — see `activateRequirementPhaseAction`.
 */
export type RequirementPhase = (typeof REQUIREMENT_PHASES)[number];

export const APPLICATION_REQUIREMENT_STATUSES = ["Pending", "Received", "Incomplete", "Verified"] as const;
export type ApplicationRequirementStatus = (typeof APPLICATION_REQUIREMENT_STATUSES)[number];

export interface ApplicationRequirement {
  id: string;
  applicationId: string;
  requiredDocumentItemId: string | null;
  documentName: string;
  appliesTo: string | null;
  notes: string | null;
  isRequired: boolean;
  status: ApplicationRequirementStatus;
  sortOrder: number;
  phase: RequirementPhase | null;
  section: RequirementSection | null;
  medicalReviewSubject: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewApplicationRequirement {
  /** Optional preassigned ID for callers holding a stable requirement identity. */
  id?: string;
  applicationId: string;
  requiredDocumentItemId?: string | null;
  documentName: string;
  appliesTo?: string | null;
  notes?: string | null;
  isRequired?: boolean;
  status?: ApplicationRequirementStatus;
  sortOrder?: number;
  phase?: RequirementPhase | null;
  section?: RequirementSection | null;
  medicalReviewSubject?: string | null;
}
