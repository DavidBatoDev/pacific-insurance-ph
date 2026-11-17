import { TravelLive } from "@/components/hub/screens/operations";
import { getAgentScope } from "@/lib/auth/agent-scope";
import { listTravelDrafts } from "@/lib/queries/travel-drafts";
import { getTravelRepository } from "@/lib/repositories/travel";

export const dynamic = "force-dynamic";

/** Travel insurance queue — travel_requests plus quotes still saved as drafts. */
export default async function Page() {
  const ownerUserId = await getAgentScope();
  const [rows, drafts] = await Promise.all([getTravelRepository().list({ ownerUserId }), listTravelDrafts(ownerUserId)]);
  return <TravelLive rows={rows} drafts={drafts} />;
}
