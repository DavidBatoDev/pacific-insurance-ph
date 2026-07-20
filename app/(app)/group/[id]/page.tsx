import { notFound } from "next/navigation";

import { GroupLive } from "@/components/hub/screens/group-live";
import { getActivity } from "@/lib/activity/read";
import { getGroupsRepository } from "@/lib/repositories/groups";

export const dynamic = "force-dynamic";

/** Group Account detail — company-level Group HMO view (wired). */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = getGroupsRepository();
  const group = await repo.findById(id);
  if (!group) notFound();

  const [members, activity] = await Promise.all([
    repo.membersOf(id),
    getActivity("group_account", id, 20),
  ]);
  return <GroupLive group={group} members={members} activity={activity} />;
}
