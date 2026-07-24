"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordAudit } from "@/lib/audit/log";
import { toAppRole } from "@/lib/auth/permissions";
import {
  getIntegrationSettingsRepository,
  type PacificCrossIntegrationSettings,
} from "@/lib/repositories/integration-settings";
import {
  getPaymentChannelsRepository,
  type NewPaymentChannel,
  type PaymentChannel,
} from "@/lib/repositories/payment-channels";
import { getUsersRepository, type User } from "@/lib/repositories/users";
import type { Json } from "@/lib/supabase/types";

async function requireAdmin() {
  const actor = await getActor();
  if (toAppRole(actor.role) !== "admin") throw new Error("Settings changes are Admin-only.");
  return actor;
}

/* -------------------------- Pacific Cross portal -------------------------- */

/** Save the agency's Pacific Cross portal link (Settings → Integrations; Admin-only). */
export async function savePacificCrossPortalAction(
  portalUrl: string,
): Promise<ActionResult<PacificCrossIntegrationSettings>> {
  try {
    const actor = await requireAdmin();
    const value = portalUrl.trim();
    if (!value) return { ok: false, error: "Pacific Cross portal URL is required." };

    let normalizedUrl: string;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:") throw new Error("HTTPS required");
      normalizedUrl = parsed.toString();
    } catch {
      return { ok: false, error: "Enter a valid HTTPS URL." };
    }

    const saved = await getIntegrationSettingsRepository().savePacificCross({
      portalUrl: normalizedUrl,
    });
    await recordAudit({
      actorId: actor.id,
      action: "update",
      tableName: "integration_settings",
      recordId: saved.id,
      newValue: saved as unknown as Json,
    });
    revalidatePath("/settings");
    revalidatePath("/clients", "layout");
    return { ok: true, data: saved };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save Pacific Cross portal." };
  }
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

/* ------------------------- Official Payment Channels ------------------------ */

/** Create or update a payment channel (Settings → Payment Channels; Admin-only). */
export async function savePaymentChannelAction(
  id: string | null,
  input: NewPaymentChannel,
): Promise<ActionResult<PaymentChannel>> {
  try {
    const actor = await requireAdmin();
    if (!input.label.trim() || !input.accountNumber.trim())
      return { ok: false, error: "Label and account number are required." };

    const repo = getPaymentChannelsRepository();
    // A single default: setting one clears the others.
    if (input.isDefault) {
      for (const c of await repo.list()) {
        if (c.isDefault && c.id !== id) await repo.update(c.id, { isDefault: false });
      }
    }
    const saved = id ? await repo.update(id, input) : await repo.create(input);
    await recordAudit({
      actorId: actor.id,
      action: id ? "update" : "create",
      tableName: "payment_channels",
      recordId: saved.id,
      newValue: saved as unknown as Json,
    });
    revalidatePath("/settings");
    return { ok: true, data: saved };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save channel." };
  }
}

/** Soft activate/deactivate a payment channel. */
export async function togglePaymentChannelAction(id: string): Promise<ActionResult<PaymentChannel>> {
  try {
    await requireAdmin();
    const repo = getPaymentChannelsRepository();
    const channel = (await repo.list()).find((c) => c.id === id);
    if (!channel) return { ok: false, error: "Channel not found." };
    if (channel.isDefault && channel.active)
      return { ok: false, error: "Make another channel the default first." };
    const updated = await repo.update(id, { active: !channel.active });
    revalidatePath("/settings");
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update channel." };
  }
}
