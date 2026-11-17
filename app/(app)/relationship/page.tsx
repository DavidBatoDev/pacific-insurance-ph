import { RelationshipLive } from "@/components/hub/screens/relationship-live";
import { getAgentScope } from "@/lib/auth/agent-scope";
import { getRelationshipTouchpoints } from "@/lib/queries/relationship";

export const dynamic = "force-dynamic";

/** Relationship Management — touchpoints derived from real client records. */
export default async function Page() {
  const touchpoints = await getRelationshipTouchpoints(undefined, await getAgentScope());
  return <RelationshipLive touchpoints={touchpoints} />;
}
