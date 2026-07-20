import { PoliciesLive } from "@/components/hub/screens/operations";
import { getPoliciesRepository } from "@/lib/repositories/policies";

export const dynamic = "force-dynamic";

/** Policies register — wired to the policies table. */
export default async function Page() {
  const rows = await getPoliciesRepository().list();
  return <PoliciesLive rows={rows} />;
}
