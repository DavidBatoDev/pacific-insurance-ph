"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import {
  getTravelRepository,
  type NewTravelRequest,
  type TravelRequest,
} from "@/lib/repositories/travel";
import type { Json } from "@/lib/supabase/types";

/** New Travel Quote (modals.md §7) — creates a per-trip travel request. */
export async function createTravelQuoteAction(
  input: NewTravelRequest,
): Promise<ActionResult<TravelRequest>> {
  const actor = await getActor();
  if (!input.clientId) return { ok: false, error: "A traveler is required." };
  if (!input.destination?.trim()) return { ok: false, error: "Destination is required." };

  try {
    const created = await getTravelRepository().create({
      ...input,
      status: input.status ?? "Awaiting Payment",
    });
    await recordActivity({
      scopeType: "client",
      scopeId: input.clientId,
      activityType: "travel.quoted",
      summary: `Travel quote created — ${created.referenceNo ?? ""} ${created.destination ?? ""}`.trim(),
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "create",
      tableName: "travel_requests",
      recordId: created.id,
      newValue: created as unknown as Json,
    });
    revalidatePath("/travel");
    revalidatePath(`/clients/${input.clientId}`);
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create travel quote." };
  }
}
