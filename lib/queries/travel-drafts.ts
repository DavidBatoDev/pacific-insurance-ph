import "server-only";

import { parseAmount } from "@/components/hub/overlays/wizard/wizard-data";
import { ownerScopedSelect, ownerScopeFilter } from "@/lib/repositories/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

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

type DraftRow = {
  id: string;
  reference_no: string | null;
  client_id: string;
  updated_at: string;
  wizard_state: Json | null;
  clients: { first_name: string; last_name: string } | null;
};

/** `ownerUserId` (Phase J9 agent scope) keeps only drafts for clients assigned to that user. */
export async function listTravelDrafts(ownerUserId?: string | null): Promise<TravelDraft[]> {
  const select = "id, reference_no, client_id, updated_at, wizard_state, clients (first_name, last_name)";
  const { data, error } = await ownerScopeFilter(
    getSupabaseAdmin().from("applications").select(ownerScopedSelect(select, ownerUserId)),
    ownerUserId,
  )
    .eq("status", "Lead")
    .eq("wizard_state->>category", "travel")
    .order("updated_at", { ascending: false })
    .limit(200)
    .returns<DraftRow[]>();
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
