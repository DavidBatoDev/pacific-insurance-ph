/**
 * Domain types for a TravelRequest — a client's travel-insurance request
 * (docs/modules Travel; table defined in supabase/migrations/0005_operations.sql).
 */

export interface TravelRequest {
  id: string;
  referenceNo: string | null;
  clientId: string;
  /** Joined convenience: client's full name. */
  clientName: string | null;
  destination: string | null;
  departureDate: string | null;
  returnDate: string | null;
  travelerCount: number | null;
  /** Workflow-driven (default 'Travel Request Created' in the database). */
  status: string;
  quotedPremium: number | null;
  currency: string | null;
  policyNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewTravelRequest {
  clientId: string;
  productVersionId?: string | null;
  destination?: string | null;
  departureDate?: string | null;
  returnDate?: string | null;
  travelerCount?: number | null;
  status?: string;
  quotedPremium?: number | null;
  notes?: string | null;
}

export interface TravelRequestUpdate {
  status?: string;
  quotedPremium?: number | null;
  policyNumber?: string | null;
  notes?: string | null;
}
