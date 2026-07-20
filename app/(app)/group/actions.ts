"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import {
  getGroupsRepository,
  type GroupMember,
  type NewGroupMember,
} from "@/lib/repositories/groups";

function refresh(groupId: string) {
  revalidatePath(`/group/${groupId}`);
  revalidatePath("/clients");
}

/** Add Member (modals.md §13) — enrolls a person under the group policy. */
export async function addGroupMemberAction(
  input: NewGroupMember,
): Promise<ActionResult<GroupMember>> {
  const actor = await getActor();
  if (!input.fullName?.trim()) return { ok: false, error: "Member name is required." };

  try {
    const member = await getGroupsRepository().addMember({
      ...input,
      fullName: input.fullName.trim(),
    });
    await recordActivity({
      scopeType: "group_account",
      scopeId: input.groupId,
      activityType: "group.member_added",
      summary: `Member added — ${member.fullName} (${member.relationship} · ${member.coverageTier} tier · e-card ${member.ecardStatus})`,
      actorId: actor.id,
    });
    refresh(input.groupId);
    return { ok: true, data: member };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add member." };
  }
}

/** Issue all pending e-cards for a group (batch). */
export async function issueGroupEcardsAction(groupId: string): Promise<ActionResult<number>> {
  const actor = await getActor();
  try {
    const issued = await getGroupsRepository().issuePendingEcards(groupId);
    if (issued > 0) {
      await recordActivity({
        scopeType: "group_account",
        scopeId: groupId,
        activityType: "group.ecards_issued",
        summary: `E-cards issued — ${issued} member${issued === 1 ? "" : "s"}`,
        actorId: actor.id,
      });
    }
    refresh(groupId);
    return { ok: true, data: issued };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to issue e-cards." };
  }
}
