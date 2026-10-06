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

/**
 * Claim types (TO-BE-UPDATE-PLAN.md H7a). `claims.claim_type` is free text; this is the
 * canonical list the File Claim drawer offers.
 */
export const CLAIM_TYPES = [
  "IP",
  "OP",
  "ER",
  "Reimbursement",
  "Overseas IP",
  "Overseas OP",
  "Overseas ER",
  "Overseas Reimbursement",
  "Travel",
] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

/**
 * Which checklist template a claim type generates (DH13, interim). The ER and
 * Reimbursement mappings are assumptions pending Eman -- see INTERIM_CHECKLIST_TYPES.
 * Travel has no template: work from the TravelSafe NOC form.
 */
export const CLAIM_TYPE_CHECKLIST: Record<ClaimType, ClaimChecklistType | null> = {
  IP: "In-Patient",
  "Overseas IP": "In-Patient",
  ER: "In-Patient",
  "Overseas ER": "In-Patient",
  OP: "Out-Patient",
  "Overseas OP": "Out-Patient",
  Reimbursement: "Out-Patient",
  "Overseas Reimbursement": "Out-Patient",
  Travel: null,
};

/** Claim types whose checklist mapping is interim -- pending Eman (DH13). */
export const INTERIM_CHECKLIST_TYPES: readonly ClaimType[] = [
  "ER",
  "Overseas ER",
  "Reimbursement",
  "Overseas Reimbursement",
];

const LEGACY_CLAIM_CHECKLIST: Record<string, ClaimChecklistType> = {
  Hospitalization: "In-Patient",
  Outpatient: "Out-Patient",
  Emergency: "In-Patient",
};

/** Checklist template for a claim type, also understanding pre-H7a legacy values. */
export function checklistForClaimType(claimType: string | null): ClaimChecklistType | null {
  if (!claimType) return null;
  if (claimType in CLAIM_TYPE_CHECKLIST) return CLAIM_TYPE_CHECKLIST[claimType as ClaimType];
  return LEGACY_CLAIM_CHECKLIST[claimType] ?? null;
}

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
