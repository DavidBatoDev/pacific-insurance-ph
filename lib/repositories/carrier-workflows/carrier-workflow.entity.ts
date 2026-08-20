export interface ApplicationDependentInput {
  id?: string | null;
  name: string;
  dateOfBirth?: string | null;
  relationship?: string | null;
  email?: string | null;
  preExistingStatus?: string | null;
  medicalNotes?: string | null;
  /** Underwriting inputs for the conditional medical panels (G3). Height is total inches. */
  smokerStatus?: string | null;
  heightInches?: number | null;
  weightLbs?: number | null;
  /** This dependent's own nominated beneficiary (G4). Relationship is to the dependent. */
  beneficiaryName?: string | null;
  beneficiaryBirthdate?: string | null;
  beneficiaryRelation?: string | null;
  beneficiaryContact?: string | null;
}

export interface CarrierFormAssignmentInput {
  dependentId?: string | null;
  personName: string;
  variant?: string | null;
  ageBand: "0-70" | "71-100" | "All Ages";
  documentLibraryId?: string | null;
  matchStatus: "Matched" | "Unavailable";
}
export interface CarrierFormAssignmentRecord extends CarrierFormAssignmentInput { id: string; applicationId: string }

export interface TravelerInput {
  fullName: string;
  dateOfBirth?: string | null;
  nationality?: string | null;
  gender?: string | null;
  contactNumber?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  planOptionId?: string | null;
  beneficiaryName?: string | null;
  beneficiaryBirthdate?: string | null;
  beneficiaryRelation?: string | null;
  beneficiaryContact?: string | null;
}
export interface TravelerRecord extends TravelerInput { id: string; travelRequestId: string; sortOrder: number }

export interface TravelRequirementInput {
  documentName: string;
  appliesTo?: string | null;
  notes?: string | null;
  isRequired?: boolean;
  sortOrder?: number;
}
export interface TravelRequirementRecord extends TravelRequirementInput { id: string; travelRequestId: string; status: "Pending" | "Received" | "Incomplete" | "Verified" }
