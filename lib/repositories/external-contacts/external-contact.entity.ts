export const EXTERNAL_CONTACT_TYPES = [
  "Pacific Cross Territory Sales Manager", "Claims Contact", "Commission Contact",
  "Travel Contact", "Vendor", "Other",
] as const;

export type ExternalContactStatus = "Active" | "Inactive";

export interface ExternalContact {
  id: string;
  name: string;
  organization: string | null;
  role: string | null;
  contactType: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  status: ExternalContactStatus;
  effectiveDate: string | null;
  endDate: string | null;
  lastVerifiedDate: string | null;
  replacementContactId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewExternalContact {
  name: string;
  organization?: string | null;
  role?: string | null;
  contactType?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: ExternalContactStatus;
  effectiveDate?: string | null;
  endDate?: string | null;
  lastVerifiedDate?: string | null;
  replacementContactId?: string | null;
  notes?: string | null;
}

export type ExternalContactUpdate = Partial<NewExternalContact>;
