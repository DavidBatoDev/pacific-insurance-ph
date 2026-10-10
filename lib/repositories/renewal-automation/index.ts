import type { RenewalAutomationRepository } from "./renewal-automation.repository";
import { SupabaseRenewalAutomationRepository } from "./renewal-automation.repository.supabase";

let instance: RenewalAutomationRepository | null = null;
export function getRenewalAutomationRepository(): RenewalAutomationRepository {
  if (!instance) instance = new SupabaseRenewalAutomationRepository();
  return instance;
}
export type { RenewalAutomationRepository } from "./renewal-automation.repository";
export type { RenewalEmailRule, RenewalEmailRuleUpdate, RenewalEmailDraft, RenewalEmailDraftEdit, RenewalQueueCounts } from "./renewal-automation.entity";
