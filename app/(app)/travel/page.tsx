import { TravelLive } from "@/components/hub/screens/operations";
import { listTravelDrafts } from "@/lib/queries/travel-drafts";
import { getTravelRepository } from "@/lib/repositories/travel";

export const dynamic = "force-dynamic";

/** Travel insurance queue — travel_requests plus quotes still saved as drafts. */
export default async function Page() {
  const [rows, drafts] = await Promise.all([getTravelRepository().list(), listTravelDrafts()]);
  return <TravelLive rows={rows} drafts={drafts} />;
}
