export const LIBRARY_DOCUMENT_TYPES = [
  "Brochure", "Application Form", "Attestation Letter", "Medical Questionnaire",
  "Renewal Form", "Claim Form", "Email Template Attachment",
] as const;
export const LIBRARY_AGE_BANDS = ["All Ages", "0-70", "71-100"] as const;
export const LIBRARY_APPROVAL_STATUSES = ["Draft", "Pending Approval", "Approved", "Rejected"] as const;

export interface LibraryDocument {
  id: string;
  productVersionId: string | null;
  productName: string | null;
  productVersionName: string | null;
  documentName: string;
  documentType: string | null;
  versionLabel: string;
  variant: string | null;
  ageBand: string;
  filePath: string | null;
  originalFileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  status: string;
  approvalStatus: string;
  notes: string | null;
  distributionNotes: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewLibraryDocument {
  productVersionId: string;
  documentName: string;
  documentType: string;
  versionLabel: string;
  variant?: string | null;
  ageBand?: string;
  filePath: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  status?: string;
  approvalStatus?: string;
  notes?: string | null;
  distributionNotes?: string | null;
  uploadedBy?: string | null;
}

export interface LibraryDocumentUpdate {
  documentName?: string;
  documentType?: string;
  versionLabel?: string;
  variant?: string | null;
  ageBand?: string;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  status?: string;
  approvalStatus?: string;
  notes?: string | null;
  distributionNotes?: string | null;
}
