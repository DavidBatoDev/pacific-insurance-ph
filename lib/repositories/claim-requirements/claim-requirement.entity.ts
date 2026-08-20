export const CLAIM_REQUIREMENT_STATUSES = ["Pending", "Received", "Incomplete", "Verified"] as const;
export type ClaimRequirementStatus = (typeof CLAIM_REQUIREMENT_STATUSES)[number];

/**
 * The two claim-requirement checklists generated from the medical NOC's page-4
 * "Claims Reimbursement Checklist" (TO-BE-UPDATE-PLAN.md Phase G, item G8). Travel is
 * deliberately absent: the TravelSafe NOC carries its requirements inside the form
 * itself, so there is no discrete list to template.
 */
export const CLAIM_CHECKLIST_TYPES = ["In-Patient", "Out-Patient"] as const;
export type ClaimChecklistType = (typeof CLAIM_CHECKLIST_TYPES)[number];

export interface ClaimRequirement {
  id: string;
  claimId: string;
  requiredDocumentItemId: string | null;
  documentName: string;
  appliesTo: string | null;
  notes: string | null;
  isRequired: boolean;
  status: ClaimRequirementStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NewClaimRequirement {
  claimId: string;
  requiredDocumentItemId?: string | null;
  documentName: string;
  appliesTo?: string | null;
  notes?: string | null;
  isRequired?: boolean;
  status?: ClaimRequirementStatus;
  sortOrder?: number;
}
