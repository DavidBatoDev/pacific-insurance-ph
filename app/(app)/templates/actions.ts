"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordAudit } from "@/lib/audit/log";
import { can, toAppRole } from "@/lib/auth/permissions";
import {
  getTemplatesRepository,
  type EmailTemplate,
  type EmailTemplateUpdate,
} from "@/lib/repositories/templates";
import type { Json } from "@/lib/supabase/types";

/** Active templates for client-side composers (Engage, wizard, campaigns). */
export async function listActiveTemplatesAction(): Promise<EmailTemplate[]> {
  return getTemplatesRepository().list(true);
}

export async function createTemplateAction(
  name: string,
): Promise<ActionResult<EmailTemplate>> {
  const actor = await getActor();
  if (!can(toAppRole(actor.role), "templates", "create")) {
    return { ok: false, error: "Your role can’t create templates." };
  }
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Template name is required." };

  try {
    const repo = getTemplatesRepository();
    if (await repo.findByName(trimmed)) {
      return { ok: false, error: `A template named “${trimmed}” already exists.` };
    }
    const created = await repo.create({
      name: trimmed,
      subject: "",
      body: "Hi {{first_name}},\n\n\n\n{{agent}}\nPacific Insurance PH",
    });
    await recordAudit({
      actorId: actor.id,
      action: "create",
      tableName: "email_templates",
      recordId: created.id,
      newValue: created as unknown as Json,
    });
    revalidatePath("/templates");
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create template." };
  }
}

export async function updateTemplateAction(
  id: string,
  patch: EmailTemplateUpdate,
): Promise<ActionResult<EmailTemplate>> {
  const actor = await getActor();
  if (!can(toAppRole(actor.role), "templates", "edit")) {
    return { ok: false, error: "Your role can’t edit templates." };
  }
  if (patch.name !== undefined && !patch.name.trim()) {
    return { ok: false, error: "Template name can’t be empty." };
  }

  try {
    const updated = await getTemplatesRepository().update(id, patch);
    await recordAudit({
      actorId: actor.id,
      action: "update",
      tableName: "email_templates",
      recordId: id,
      newValue: updated as unknown as Json,
    });
    revalidatePath("/templates");
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update template." };
  }
}
