import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Counts for the Associated-records card. Dependents and documents are not
 * counted here — the profile page already fetches those rows in full and uses
 * their lengths.
 */
export interface ClientRelatedCounts {
  policies: number;
  applications: number;
  claims: number;
  renewals: number;
  travelRequests: number;
}

export async function getClientRelatedCounts(clientId: string): Promise<ClientRelatedCounts> {
  const admin = getSupabaseAdmin();
  const head = { count: "exact" as const, head: true };

  const [policies, applications, claims, renewals, travel] = await Promise.all([
    admin.from("policies").select("*", head).eq("client_id", clientId),
    admin.from("applications").select("*", head).eq("client_id", clientId),
    admin.from("claims").select("*", head).eq("client_id", clientId),
    admin.from("renewals").select("*", head).eq("client_id", clientId),
    admin.from("travel_requests").select("*", head).eq("client_id", clientId),
  ]);

  return {
    policies: policies.count ?? 0,
    applications: applications.count ?? 0,
    claims: claims.count ?? 0,
    renewals: renewals.count ?? 0,
    travelRequests: travel.count ?? 0,
  };
}
