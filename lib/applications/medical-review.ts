export type MedicalReviewStatus = "Not required" | "Pending" | "Cleared";

export interface MedicalReviewEligibility {
  productName: string | null;
  principalPreExistingStatus: string | null;
  dependents: ReadonlyArray<{ preExistingStatus?: string | null }>;
}

/** Exact product identity only; custom labels and Group HMO never imply medical eligibility. */
export function medicalReviewRequired(input: MedicalReviewEligibility): boolean {
  const product = input.productName?.trim().replace(/\s+/g, " ").toLowerCase();
  return (product === "select" || product === "blue royale" || product === "flexishield")
    && (input.principalPreExistingStatus === "Yes" || input.dependents.some((person) => person.preExistingStatus === "Yes"));
}

/** Clearance evidence is invalidated transactionally whenever material persisted inputs change. */
export function medicalReviewStatus(input: MedicalReviewEligibility & {
  medicalClass: string | null;
  clearedAt: string | null;
  clearedBy: string | null;
}): MedicalReviewStatus {
  if (!medicalReviewRequired(input)) return "Not required";
  const assessment = input.medicalClass?.trim() ?? "";
  return assessment.length > 0 && assessment.length <= 500 && input.clearedBy && input.clearedAt
    && Number.isFinite(Date.parse(input.clearedAt)) ? "Cleared" : "Pending";
}

export interface MedicalReviewSubject {
  key: string;
  name: string;
  questionnaireRequirementId: string | null;
  medicalNotes: string | null;
}

export interface ApplicationMedicalReview {
  status: MedicalReviewStatus;
  subjects: MedicalReviewSubject[];
  medicalClass: string | null;
  clearedAt: string | null;
  clearedBy: string | null;
  canClear: boolean;
  blockers: string[];
}
