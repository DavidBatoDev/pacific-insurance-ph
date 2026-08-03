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
  createdAt: string;
  updatedAt: string;
}

export interface NewApplicationRequirement {
  applicationId: string;
  requiredDocumentItemId?: string | null;
  documentName: string;
  appliesTo?: string | null;
  notes?: string | null;
  isRequired?: boolean;
  status?: ApplicationRequirementStatus;
  sortOrder?: number;
}
