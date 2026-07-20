"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordAudit } from "@/lib/audit/log";
import { toAppRole } from "@/lib/auth/permissions";
import { getUsersRepository, type User } from "@/lib/repositories/users";
import type { Json } from "@/lib/supabase/types";

async function requireAdmin() {
  const actor = await getActor();
  if (toAppRole(actor.role) !== "admin") throw new Error("Team changes are Admin-only.");
  return actor;
}

/** Change a team member's role (Settings → Team; Admin-only). */
export async function updateUserRoleAction(
  userId: string,
  role: string,
): Promise<ActionResult<User>> {
  try {
    const actor = await requireAdmin();
    if (!["Owner", "Admin", "Assistant", "Viewer"].includes(role))
      return { ok: false, error: "Unknown role." };
    if (userId === actor.id) return { ok: false, error: "You can’t change your own role." };

    const updated = await getUsersRepository().update(userId, { role });
    await recordAudit({
      actorId: actor.id,
      action: "update",
      tableName: "users",
      recordId: userId,
      newValue: updated as unknown as Json,
    });
    revalidatePath("/settings");
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update role." };
  }
}

/** Soft activate/deactivate a team member (history preserved). */
export async function toggleUserStatusAction(userId: string): Promise<ActionResult<User>> {
  try {
    const actor = await requireAdmin();
    if (userId === actor.id) return { ok: false, error: "You can’t deactivate yourself." };
    const repo = getUsersRepository();
    const user = await repo.findById(userId);
    if (!user) return { ok: false, error: "User not found." };
    const updated = await repo.update(userId, {
      status: user.status === "Active" ? "Inactive" : "Active",
    });
    revalidatePath("/settings");
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update user." };
  }
}
