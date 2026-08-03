import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { DEFAULT_LIST_LIMIT, statusListLiteral, toRepositoryError, type ListOptions } from "../types";
import type { TravelRequest, NewTravelRequest, TravelRequestUpdate } from "./travel-request.entity";
import type { TravelRepository } from "./travel.repository";

type TravelRequestRow = Database["public"]["Tables"]["travel_requests"]["Row"];
type TravelRequestInsert = Database["public"]["Tables"]["travel_requests"]["Insert"];
type TravelRequestPatch = Database["public"]["Tables"]["travel_requests"]["Update"];

/** Row plus the joined display name the lists render. */
type JoinedRow = TravelRequestRow & {
  clients: { first_name: string; last_name: string } | null;
};

const SELECT = `*,
  clients (first_name, last_name)`;

function toDomain(row: JoinedRow): TravelRequest {
  return {
    id: row.id,
    referenceNo: row.reference_no,
    clientId: row.client_id,
    productVersionId: row.product_version_id,
    planOptionId: row.plan_option_id,
    clientName: row.clients
      ? [row.clients.first_name, row.clients.last_name].filter(Boolean).join(" ")
      : null,
    destination: row.destination,
    departureDate: row.departure_date,
    returnDate: row.return_date,
    travelerCount: row.traveler_count,
    travelPurpose: row.travel_purpose,
    itinerary: row.itinerary,
    applicantIsTraveler: row.applicant_is_traveler,
    status: row.status,
    quotedPremium: row.quoted_premium,
    currency: row.currency,
    paymentChannelId: row.payment_channel_id,
    paymentInstructionLoggedAt: row.payment_instruction_logged_at,
    paymentAcknowledgementLoggedAt: row.payment_acknowledgement_logged_at,
    portalPaymentStatus: row.portal_payment_status,
    portalPaymentReference: row.portal_payment_reference,
    portalPaymentAmount: row.portal_payment_amount,
    portalProcessingStatus: row.portal_processing_status,
    carrierFormLibraryId: row.carrier_form_library_id,
    carrierFormAgeBand: row.carrier_form_age_band,
    carrierFormMatchStatus: row.carrier_form_match_status,
    policyNumber: row.policy_number,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link TravelRepository}. */
export class SupabaseTravelRepository implements TravelRepository {
  async findById(id: string): Promise<TravelRequest | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("travel_requests")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle<JoinedRow>();

    if (error) throw toRepositoryError("TravelRepository.findById", error);
    return data ? toDomain(data) : null;
  }

  async list(opts: ListOptions = {}): Promise<TravelRequest[]> {
    let query = getSupabaseAdmin().from("travel_requests").select(SELECT);
    if (opts.statusIn) query = query.in("status", opts.statusIn);
    if (opts.statusNotIn) query = query.not("status", "in", statusListLiteral(opts.statusNotIn));
    const { data, error } = await query
      .order("departure_date", { ascending: true, nullsFirst: false })
      .limit(opts.limit ?? DEFAULT_LIST_LIMIT)
      .returns<JoinedRow[]>();

    if (error) throw toRepositoryError("TravelRepository.list", error);
    return (data ?? []).map(toDomain);
  }

  async listByClient(clientId: string): Promise<TravelRequest[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("travel_requests")
      .select(SELECT)
      .eq("client_id", clientId)
      .order("departure_date", { ascending: true, nullsFirst: false })
      .returns<JoinedRow[]>();

    if (error) throw toRepositoryError("TravelRepository.listByClient", error);
    return (data ?? []).map(toDomain);
  }

  async create(input: NewTravelRequest): Promise<TravelRequest> {
    const insert: TravelRequestInsert = {
      client_id: input.clientId,
      product_version_id: input.productVersionId ?? null,
      plan_option_id: input.planOptionId ?? null,
      destination: input.destination ?? null,
      departure_date: input.departureDate ?? null,
      return_date: input.returnDate ?? null,
      traveler_count: input.travelerCount ?? null,
      travel_purpose: input.travelPurpose ?? null,
      itinerary: input.itinerary ?? null,
      applicant_is_traveler: input.applicantIsTraveler ?? true,
      quoted_premium: input.quotedPremium ?? null,
      notes: input.notes ?? null,
      payment_channel_id: input.paymentChannelId ?? null,
      portal_payment_status: input.portalPaymentStatus ?? "Not Yet",
      portal_payment_reference: input.portalPaymentReference ?? null,
      portal_payment_amount: input.portalPaymentAmount ?? null,
      portal_processing_status: input.portalProcessingStatus ?? "Not Started",
      carrier_form_library_id: input.carrierFormLibraryId ?? null,
      carrier_form_age_band: input.carrierFormAgeBand ?? "All Ages",
      carrier_form_match_status: input.carrierFormMatchStatus ?? "Unavailable",
    };
    if (input.status !== undefined) insert.status = input.status;

    const { data, error } = await getSupabaseAdmin()
      .from("travel_requests")
      .insert(insert)
      .select(SELECT)
      .single<JoinedRow>();

    if (error) throw toRepositoryError("TravelRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: TravelRequestUpdate): Promise<TravelRequest> {
    const patch: TravelRequestPatch = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.quotedPremium !== undefined) patch.quoted_premium = input.quotedPremium;
    if (input.policyNumber !== undefined) patch.policy_number = input.policyNumber;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.planOptionId !== undefined) patch.plan_option_id = input.planOptionId;
    if (input.destination !== undefined) patch.destination = input.destination;
    if (input.departureDate !== undefined) patch.departure_date = input.departureDate;
    if (input.returnDate !== undefined) patch.return_date = input.returnDate;
    if (input.travelerCount !== undefined) patch.traveler_count = input.travelerCount;
    if (input.travelPurpose !== undefined) patch.travel_purpose = input.travelPurpose;
    if (input.itinerary !== undefined) patch.itinerary = input.itinerary;
    if (input.applicantIsTraveler !== undefined) patch.applicant_is_traveler = input.applicantIsTraveler;
    if (input.paymentChannelId !== undefined) patch.payment_channel_id = input.paymentChannelId;
    if (input.paymentInstructionLoggedAt !== undefined) patch.payment_instruction_logged_at = input.paymentInstructionLoggedAt;
    if (input.paymentAcknowledgementLoggedAt !== undefined) patch.payment_acknowledgement_logged_at = input.paymentAcknowledgementLoggedAt;
    if (input.portalPaymentStatus !== undefined) patch.portal_payment_status = input.portalPaymentStatus;
    if (input.portalPaymentReference !== undefined) patch.portal_payment_reference = input.portalPaymentReference;
    if (input.portalPaymentAmount !== undefined) patch.portal_payment_amount = input.portalPaymentAmount;
    if (input.portalProcessingStatus !== undefined) patch.portal_processing_status = input.portalProcessingStatus;
    if (input.carrierFormLibraryId !== undefined) patch.carrier_form_library_id = input.carrierFormLibraryId;
    if (input.carrierFormAgeBand !== undefined) patch.carrier_form_age_band = input.carrierFormAgeBand;
    if (input.carrierFormMatchStatus !== undefined) patch.carrier_form_match_status = input.carrierFormMatchStatus;

    const { data, error } = await getSupabaseAdmin()
      .from("travel_requests")
      .update(patch)
      .eq("id", id)
      .select(SELECT)
      .single<JoinedRow>();

    if (error) throw toRepositoryError("TravelRepository.update", error);
    return toDomain(data);
  }
}
