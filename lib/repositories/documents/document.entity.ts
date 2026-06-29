/**
 * Domain types for a Document. Named `DocumentRecord` to avoid clashing with the
 * DOM `Document` global. camelCase, decoupled from the row shape.
 */

export interface DocumentRecord {
  id: string;
  referenceNo: string | null;
  clientId: string | null;
  policyId: string | null;
  applicationId: string | null;
  claimId: string | null;
  renewalId: string | null;
  travelRequestId: string | null;
  documentType: string | null;
  name: string;
  filePath: string | null;
  version: number;
  visibility: string;
  status: string;
  uploadedBy: string | null;
  uploadedAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewDocumentRecord {
  name: string;
  filePath: string;
  clientId?: string | null;
  policyId?: string | null;
  applicationId?: string | null;
  claimId?: string | null;
  renewalId?: string | null;
  travelRequestId?: string | null;
  documentType?: string | null;
  visibility?: string;
  status?: string;
  uploadedBy?: string | null;
  notes?: string | null;
}

export interface DocumentRecordUpdate {
  name?: string;
  documentType?: string | null;
  visibility?: string;
  status?: string;
  notes?: string | null;
}
