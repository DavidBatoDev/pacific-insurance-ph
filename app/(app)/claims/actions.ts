"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { getClaimsRepository, type Claim, type NewClaim } from "@/lib/repositories/claims";
import { getPoliciesRepository } from "@/lib/repositories/policies";
import type { Json } from "@/lib/supabase/types";

/** A contact's policies, for the File Claim drawer's policy picker. */
export async function listClientPoliciesAction(
  clientId: string,
): Promise<{ id: string; label: string }[]> {
  const policies = await getPoliciesRepository().listByClient(clientId);
  return policies.map((p) => ({
    id: p.id,
    label: [p.referenceNo, p.productName].filter(Boolean).join(" · ") || p.id.slice(0, 8),
  }));
}

/** File Claim (modals.md §6) — creates a claim linked to client + policy. */
export async function fileClaimAction(input: NewClaim): Promise<ActionResult<Claim>> {
  const actor = await getActor();
  if (!input.clientId) return { ok: false, error: "A claimant is required." };

  try {
    const created = await getClaimsRepository().create({
      ...input,
      status: input.status ?? "Documents Pending",
    });
    await recordActivity({
      scopeType: "client",
      scopeId: input.clientId,
      activityType: "claim.filed",
      summary: `Claim filed — ${created.referenceNo ?? "new claim"} (${created.claimType ?? "claim"})`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "create",
      tableName: "claims",
      recordId: created.id,
      newValue: created as unknown as Json,
    });
    revalidatePath("/claims");
    revalidatePath(`/clients/${input.clientId}`);
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to file claim." };
  }
}
