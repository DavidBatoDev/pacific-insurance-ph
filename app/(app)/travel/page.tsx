import { TravelLive } from "@/components/hub/screens/operations";
import { getTravelRepository } from "@/lib/repositories/travel";

export const dynamic = "force-dynamic";

/** Travel insurance queue — wired to the travel_requests table. */
export default async function Page() {
  const rows = await getTravelRepository().list();
  return <TravelLive rows={rows} />;
}
