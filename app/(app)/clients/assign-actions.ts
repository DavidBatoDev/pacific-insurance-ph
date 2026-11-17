"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { toAppRole } from "@/lib/auth/permissions";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getUsersRepository } from "@/lib/repositories/users";

/**
 * Sets a client's assigned agent (`clients.assigned_user_id`), which decides which Agent sees the
 * client and all its records (Phase J9). Admin-only per `docs/web/permissions.md` ("assigned-agent
 * reassignment — Admin only"); the real DB role decides, never the persona preview. `null` unassigns.
 */
export async function assignClientAgentAction(
  clientId: string,
  userId: string | null,
): Promise<ActionResult<{ assignedUserId: string | null }>> {
  const actor = await getActor();
  if (toAppRole(actor.role) !== "admin") return { ok: false, error: "Only an Admin can change a client's assigned agent." };

  try {
    const clients = getClientsRepository();
    const client = await clients.findById(clientId);
    if (!client) return { ok: false, error: "Client not found." };
    const previousId = client.assignedUserId ?? null;
    if (previousId === userId) return { ok: true, data: { assignedUserId: userId } };

    const users = getUsersRepository();
    const [next, previous] = await Promise.all([
      userId ? users.findById(userId) : Promise.resolve(null),
      previousId ? users.findById(previousId) : Promise.resolve(null),
    ]);
    if (userId && (!next || next.status !== "Active")) return { ok: false, error: "Choose an active team member." };

    await clients.update(clientId, { assignedUserId: userId });
    await recordActivity({
      scopeType: "client",
      scopeId: clientId,
      activityType: "client.assigned",
      summary: `Assigned agent: ${previous?.fullName ?? "Unassigned"} → ${next?.fullName ?? "Unassigned"}`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "reassign",
      tableName: "clients",
      recordId: clientId,
      previousValue: { assigned_user_id: previousId },
      newValue: { assigned_user_id: userId },
    });

    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/clients");
    revalidatePath("/prospects");
    return { ok: true, data: { assignedUserId: userId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to change the assigned agent." };
  }
}
