import { RenewalsLive } from "@/components/hub/screens/operations";
import { getRenewalsRepository } from "@/lib/repositories/renewals";

export const dynamic = "force-dynamic";

/** Renewals queue — wired to the renewals table. */
export default async function Page() {
  const rows = await getRenewalsRepository().list();
  return <RenewalsLive rows={rows} />;
}
