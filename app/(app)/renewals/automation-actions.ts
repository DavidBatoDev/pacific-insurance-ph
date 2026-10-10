"use server";

import { revalidatePath } from "next/cache";
import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordAudit } from "@/lib/audit/log";
import { toAppRole } from "@/lib/auth/permissions";
import { getExternalContactsRepository } from "@/lib/repositories/external-contacts";
import { getTemplatesRepository } from "@/lib/repositories/templates";
import { getRenewalAutomationRepository, type RenewalEmailDraft, type RenewalEmailDraftEdit, type RenewalEmailRule, type RenewalEmailRuleUpdate, type RenewalQueueCounts } from "@/lib/repositories/renewal-automation";
import type { Json } from "@/lib/supabase/types";

export async function saveRenewalEmailRuleAction(id: string, input: RenewalEmailRuleUpdate): Promise<ActionResult<RenewalEmailRule>> {
  try {
    const actor = await getActor();
    if (toAppRole(actor.role) !== "admin") return { ok: false, error: "Renewal rule changes are Admin-only." };
    const repo = getRenewalAutomationRepository();
    const before = await repo.findRule(id);
    if (!before) return { ok: false, error: "Renewal rule not found." };
    if (!Number.isInteger(input.offsetDays) || input.offsetDays < -32768 || input.offsetDays > 32767) {
      return { ok: false, error: "Enter a whole day offset between -32768 and 32767." };
    }
    if (!["renewal_due_date", "notice_received_date"].includes(input.dateBasis) || typeof input.active !== "boolean") {
      return { ok: false, error: "Choose a valid date basis and active setting." };
    }
    if (before.key === "notice_received" && (input.dateBasis !== "notice_received_date" || input.offsetDays !== 0)) {
      return { ok: false, error: "Notice receipt must be immediate: notice received date, offset 0." };
    }
    if (before.key === "missing_notice" && input.dateBasis !== "renewal_due_date") {
      return { ok: false, error: "Missing notice must use the renewal due date." };
    }
    const template = await getTemplatesRepository().findById(input.templateId);
    if (!template?.active || template.channel !== "Email") return { ok: false, error: "Choose an active Email template." };
    const externalContactId = before.recipient === "carrier" ? input.externalContactId : null;
    if (before.recipient === "carrier") {
      const contact = externalContactId ? await getExternalContactsRepository().findById(externalContactId) : null;
      if (contact?.status !== "Active" || !contact.email?.trim()) return { ok: false, error: "Choose an active carrier contact with an email address." };
    }
    const updated = await repo.updateRule(id, { ...input, externalContactId });
    await recordAudit({ actorId: actor.id, action: "update", tableName: "renewal_email_rules", recordId: id,
      previousValue: before as unknown as Json, newValue: updated as unknown as Json });
    revalidatePath("/settings");
    return { ok: true, data: updated };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save renewal rule." };
  }
}

export async function queueDueRenewalEmailsAction(): Promise<ActionResult<RenewalQueueCounts>> {
  try {
    const actor = await getActor();
    if (toAppRole(actor.role) !== "admin") return { ok: false, error: "Only admins can run the renewal queue." };
    const counts = await getRenewalAutomationRepository().queueDue();
    await recordAudit({ actorId: actor.id, action: "queue_due", tableName: "renewal_email_drafts", newValue: { ...counts } });
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { ok: true, data: counts };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not queue renewal drafts." };
  }
}

export async function getRenewalEmailDraftAction(id: string): Promise<ActionResult<RenewalEmailDraft>> {
  try {
    const actor = await getActor();
    if (toAppRole(actor.role) === "agent") return { ok: false, error: "Renewal drafts are available to Admin and Staff only." };
    const draft = await getRenewalAutomationRepository().findDraft(id);
    return draft ? { ok: true, data: draft } : { ok: false, error: "Renewal draft not found." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not load renewal draft." };
  }
}

async function mutateDraft(id: string, operation: "save" | "log" | "dismiss", revision: string, edits?: RenewalEmailDraftEdit): Promise<ActionResult<RenewalEmailDraft>> {
  try {
    const actor = await getActor();
    if (toAppRole(actor.role) === "agent") return { ok: false, error: "Renewal drafts are available to Admin and Staff only." };
    const repo = getRenewalAutomationRepository();
    const before = await repo.findDraft(id);
    if (!before) return { ok: false, error: "Renewal draft not found." };
    const updated = await repo.updateDraft(id, actor.id, operation, revision, edits);
    if (updated.updatedAt !== before.updatedAt) {
      await recordAudit({ actorId: actor.id, action: operation, tableName: "renewal_email_drafts", recordId: id,
        previousValue: before as unknown as Json, newValue: updated as unknown as Json });
    }
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    revalidatePath(`/clients/${updated.clientId}`);
    return { ok: true, data: updated };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not update renewal draft." };
  }
}

export async function saveRenewalEmailDraftAction(id: string, edits: RenewalEmailDraftEdit): Promise<ActionResult<RenewalEmailDraft>> {
  return mutateDraft(id, "save", edits.updatedAt, edits);
}
export async function logRenewalEmailDraftAction(id: string, edits: RenewalEmailDraftEdit): Promise<ActionResult<RenewalEmailDraft>> {
  return mutateDraft(id, "log", edits.updatedAt, edits);
}
export async function dismissRenewalEmailDraftAction(id: string, updatedAt: string): Promise<ActionResult<RenewalEmailDraft>> {
  return mutateDraft(id, "dismiss", updatedAt);
}
