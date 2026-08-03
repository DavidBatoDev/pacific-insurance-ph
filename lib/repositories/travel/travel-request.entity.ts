/**
 * Domain types for a TravelRequest — a client's travel-insurance request
 * (docs/modules Travel; table defined in supabase/migrations/0005_operations.sql).
 */

export interface TravelRequest {
  id: string;
  referenceNo: string | null;
  clientId: string;
  productVersionId: string | null;
  planOptionId: string | null;
  /** Joined convenience: client's full name. */
  clientName: string | null;
  destination: string | null;
  departureDate: string | null;
  returnDate: string | null;
  travelerCount: number | null;
  travelPurpose: string | null;
  itinerary: string | null;
  applicantIsTraveler: boolean;
  /** Workflow-driven (default 'Travel Request Created' in the database). */
  status: string;
  quotedPremium: number | null;
  currency: string | null;
  paymentChannelId: string | null;
  paymentInstructionLoggedAt: string | null;
  paymentAcknowledgementLoggedAt: string | null;
  portalPaymentStatus: string;
  portalPaymentReference: string | null;
  portalPaymentAmount: number | null;
  portalProcessingStatus: string;
  carrierFormLibraryId: string | null;
  carrierFormAgeBand: string;
  carrierFormMatchStatus: string;
  policyNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewTravelRequest {
  clientId: string;
  productVersionId?: string | null;
  planOptionId?: string | null;
  destination?: string | null;
  departureDate?: string | null;
  returnDate?: string | null;
  travelerCount?: number | null;
  travelPurpose?: string | null;
  itinerary?: string | null;
  applicantIsTraveler?: boolean;
  status?: string;
  quotedPremium?: number | null;
  notes?: string | null;
  paymentChannelId?: string | null;
  portalPaymentStatus?: string;
  portalPaymentReference?: string | null;
  portalPaymentAmount?: number | null;
  portalProcessingStatus?: string;
  carrierFormLibraryId?: string | null;
  carrierFormAgeBand?: string;
  carrierFormMatchStatus?: string;
}

export interface TravelRequestUpdate {
  status?: string;
  quotedPremium?: number | null;
  policyNumber?: string | null;
  notes?: string | null;
  planOptionId?: string | null;
  destination?: string | null;
  departureDate?: string | null;
  returnDate?: string | null;
  travelerCount?: number | null;
  travelPurpose?: string | null;
  itinerary?: string | null;
  applicantIsTraveler?: boolean;
  paymentChannelId?: string | null;
  paymentInstructionLoggedAt?: string | null;
  paymentAcknowledgementLoggedAt?: string | null;
  portalPaymentStatus?: string;
  portalPaymentReference?: string | null;
  portalPaymentAmount?: number | null;
  portalProcessingStatus?: string;
  carrierFormLibraryId?: string | null;
  carrierFormAgeBand?: string;
  carrierFormMatchStatus?: string;
}
