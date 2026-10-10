import type { RenewalEmailDraft, RenewalEmailDraftEdit, RenewalEmailRule, RenewalEmailRuleUpdate, RenewalQueueCounts } from "./renewal-automation.entity";

export interface RenewalAutomationRepository {
  listRules(): Promise<RenewalEmailRule[]>;
  findRule(id: string): Promise<RenewalEmailRule | null>;
  updateRule(id: string, input: RenewalEmailRuleUpdate): Promise<RenewalEmailRule>;
  findDraft(id: string): Promise<RenewalEmailDraft | null>;
  updateDraft(id: string, actorId: string, operation: "save" | "log" | "dismiss", revision: string, edits?: RenewalEmailDraftEdit): Promise<RenewalEmailDraft>;
  queueDue(): Promise<RenewalQueueCounts>;
}
