/** Domain types for a Dependent / insured person attached to a client. */

export interface Dependent {
  id: string;
  primaryClientId: string;
  policyId: string | null;
  fullName: string;
  relationship: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  email: string | null;
  mobileNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewDependent {
  primaryClientId: string;
  fullName: string;
  relationship?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
  notes?: string | null;
  policyId?: string | null;
}

export interface DependentUpdate {
  fullName?: string;
  relationship?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
  notes?: string | null;
  policyId?: string | null;
}
