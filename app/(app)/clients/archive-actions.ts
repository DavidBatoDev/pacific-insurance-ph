"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { getClientsRepository, type Client } from "@/lib/repositories/clients";
import type { Json } from "@/lib/supabase/types";

/**
 * Archive / restore a client. Clients who left are archived, never deleted: they drop out of
 * active lists, pickers and counts but stay searchable and their profile still opens.
 */
async function setClientStatus(
  id: string,
  next: "Active" | "Archived",
  note?: string,
): Promise<ActionResult<Client>> {
  const actor = await getActor();
  const repo = getClientsRepository();
  const archiving = next === "Archived";

  try {
    const client = await repo.findById(id);
    if (!client) return { ok: false, error: "Client not found." };
    if (client.status === next)
      return { ok: false, error: `${client.fullName} is already ${archiving ? "archived" : "active"}.` };

    const updated = await repo.update(id, { status: next });
    const trimmed = note?.trim();

    await recordActivity({
      scopeType: "client",
      scopeId: id,
      activityType: archiving ? "client.archived" : "client.restored",
      summary: archiving
        ? `Client archived${trimmed ? ` — ${trimmed}` : ""}`
        : `Client restored${trimmed ? ` — ${trimmed}` : ""}`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: archiving ? "archive" : "restore",
      tableName: "clients",
      recordId: id,
      previousValue: client as unknown as Json,
      newValue: updated as unknown as Json,
    });

    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    revalidatePath("/prospects");
    return { ok: true, data: updated };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : `Failed to ${archiving ? "archive" : "restore"} the client.`,
    };
  }
}

export async function archiveClientAction(id: string, note?: string): Promise<ActionResult<Client>> {
  return setClientStatus(id, "Archived", note);
}

export async function restoreClientAction(id: string): Promise<ActionResult<Client>> {
  return setClientStatus(id, "Active");
}
