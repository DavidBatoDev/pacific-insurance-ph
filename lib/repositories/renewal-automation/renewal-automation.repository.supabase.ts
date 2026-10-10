import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { fillTemplate, type MergeContext } from "@/lib/templates/merge";
import { toRepositoryError } from "../types";
import type { RenewalAutomationRepository } from "./renewal-automation.repository";
import type { RenewalEmailDraft, RenewalEmailDraftEdit, RenewalEmailRule, RenewalEmailRuleUpdate, RenewalQueueCounts } from "./renewal-automation.entity";

type RuleRow = Database["public"]["Tables"]["renewal_email_rules"]["Row"];
type DraftRow = Database["public"]["Tables"]["renewal_email_drafts"]["Row"];
type JoinedDraft = DraftRow & {
  renewal_email_rules: { name: string };
  renewals: { client_id: string; policy_id: string };
};
const DRAFT_SELECT = "*, renewal_email_rules(name), renewals(client_id, policy_id)";

function ruleToDomain(row: RuleRow): RenewalEmailRule {
  return {
    id: row.id, key: row.rule_key as RenewalEmailRule["key"], name: row.name,
    dateBasis: row.date_basis as RenewalEmailRule["dateBasis"], offsetDays: row.offset_days,
    recipient: row.recipient as RenewalEmailRule["recipient"], externalContactId: row.external_contact_id,
    templateId: row.template_id, active: row.active,
  };
}
function draftToDomain(row: JoinedDraft): RenewalEmailDraft {
  const context = row.merge_context as MergeContext;
  return {
    id: row.id, taskId: row.task_id, renewalId: row.renewal_id,
    clientId: row.renewals.client_id, policyId: row.renewals.policy_id,
    ruleName: row.renewal_email_rules.name, dueDate: row.due_date,
    recipientEmail: row.recipient_email, externalContactId: row.external_contact_id,
    subject: row.edited_subject ?? fillTemplate(row.subject, context),
    body: row.edited_body ?? fillTemplate(row.body, context),
    status: row.status as RenewalEmailDraft["status"], dismissalReason: row.dismissal_reason,
    communicationId: row.communication_id, updatedAt: row.updated_at,
  };
}

export class SupabaseRenewalAutomationRepository implements RenewalAutomationRepository {
  async listRules(): Promise<RenewalEmailRule[]> {
    const { data, error } = await getSupabaseAdmin().from("renewal_email_rules").select("*").order("rule_key");
    if (error) throw toRepositoryError("RenewalAutomationRepository.listRules", error);
    return (data ?? []).map(ruleToDomain);
  }
  async findRule(id: string): Promise<RenewalEmailRule | null> {
    const { data, error } = await getSupabaseAdmin().from("renewal_email_rules").select("*").eq("id", id).maybeSingle();
    if (error) throw toRepositoryError("RenewalAutomationRepository.findRule", error);
    return data ? ruleToDomain(data) : null;
  }
  async updateRule(id: string, input: RenewalEmailRuleUpdate): Promise<RenewalEmailRule> {
    const { data, error } = await getSupabaseAdmin().from("renewal_email_rules").update({
      date_basis: input.dateBasis, offset_days: input.offsetDays, external_contact_id: input.externalContactId,
      template_id: input.templateId, active: input.active,
    }).eq("id", id).select("*").single();
    if (error) throw toRepositoryError("RenewalAutomationRepository.updateRule", error);
    return ruleToDomain(data);
  }
  async findDraft(id: string): Promise<RenewalEmailDraft | null> {
    const { data, error } = await getSupabaseAdmin().from("renewal_email_drafts").select(DRAFT_SELECT).eq("id", id).maybeSingle<JoinedDraft>();
    if (error) throw toRepositoryError("RenewalAutomationRepository.findDraft", error);
    return data ? draftToDomain(data) : null;
  }
  async updateDraft(id: string, actorId: string, operation: "save" | "log" | "dismiss", revision: string, edits?: RenewalEmailDraftEdit): Promise<RenewalEmailDraft> {
    const { data, error } = await getSupabaseAdmin().rpc("update_renewal_email_draft", {
      p_draft_id: id, p_actor_id: actorId, p_operation: operation, p_expected_updated_at: revision,
      ...(edits && { p_recipient_email: edits.recipientEmail, p_subject: edits.subject, p_body: edits.body }),
    }).select(DRAFT_SELECT).single<JoinedDraft>();
    if (error) throw toRepositoryError("RenewalAutomationRepository.updateDraft", error);
    return draftToDomain(data);
  }
  async queueDue(): Promise<RenewalQueueCounts> {
    const { data, error } = await getSupabaseAdmin().rpc("queue_due_renewal_emails");
    if (error) throw toRepositoryError("RenewalAutomationRepository.queueDue", error);
    const counts: RenewalQueueCounts = { queued: 0, refreshed: 0, dismissed: 0, unchanged: 0 };
    for (const result of data ?? []) counts[result.outcome as keyof RenewalQueueCounts] += 1;
    return counts;
  }
}
