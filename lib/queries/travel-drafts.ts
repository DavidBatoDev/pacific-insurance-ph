import "server-only";

import { parseAmount } from "@/components/hub/overlays/wizard/wizard-data";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Unfinished travel quotes for the Travel page. A quote saved as a draft lives in `applications`
 * (status 'Lead', wizard_state.category 'travel') until "Create & open portal" turns it into a
 * travel request, so the travel_requests list alone hides work still in progress.
 */
export interface TravelDraft {
  id: string;
  referenceNo: string | null;
  clientId: string;
  clientName: string | null;
  destination: string | null;
  departureDate: string | null;
  returnDate: string | null;
  quotedPremium: number | null;
  travelerCount: number;
  updatedAt: string;
}

type DraftState = {
  destination?: string;
  departure?: string;
  returnDate?: string;
  premium?: string;
  travelers?: { name?: string }[];
};

export async function listTravelDrafts(): Promise<TravelDraft[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("applications")
    .select("id, reference_no, client_id, updated_at, wizard_state, clients (first_name, last_name)")
    .eq("status", "Lead")
    .eq("wizard_state->>category", "travel")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const state = (row.wizard_state ?? {}) as DraftState;
    const client = row.clients as { first_name: string; last_name: string } | null;
    return {
      id: row.id,
      referenceNo: row.reference_no,
      clientId: row.client_id,
      clientName: client ? [client.first_name, client.last_name].filter(Boolean).join(" ") : null,
      destination: state.destination?.trim() || null,
      departureDate: state.departure || null,
      returnDate: state.returnDate || null,
      quotedPremium: parseAmount(state.premium ?? ""),
      travelerCount: (state.travelers ?? []).filter((traveler) => traveler.name?.trim()).length,
      updatedAt: row.updated_at,
    };
  });
}
