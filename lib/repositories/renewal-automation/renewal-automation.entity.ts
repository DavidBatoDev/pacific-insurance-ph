export type RenewalRuleKey = "notice_received" | "client_reminder" | "missing_notice" | "premium_breakdown";
export type RenewalDateBasis = "renewal_due_date" | "notice_received_date";

export interface RenewalEmailRule {
  id: string;
  key: RenewalRuleKey;
  name: string;
  dateBasis: RenewalDateBasis;
  offsetDays: number;
  recipient: "client" | "carrier";
  externalContactId: string | null;
  templateId: string;
  active: boolean;
}
export type RenewalEmailRuleUpdate = Pick<RenewalEmailRule, "dateBasis" | "offsetDays" | "externalContactId" | "templateId" | "active">;

export interface RenewalEmailDraft {
  id: string;
  taskId: string;
  renewalId: string;
  clientId: string;
  policyId: string;
  ruleName: string;
  dueDate: string;
  recipientEmail: string | null;
  externalContactId: string | null;
  subject: string;
  body: string;
  status: "Draft" | "Logged" | "Dismissed";
  dismissalReason: string | null;
  communicationId: string | null;
  updatedAt: string;
}
export interface RenewalEmailDraftEdit {
  recipientEmail: string;
  subject: string;
  body: string;
  /** Optimistic revision: stale forms must not overwrite another staff member. */
  updatedAt: string;
}
export interface RenewalQueueCounts {
  queued: number;
  refreshed: number;
  dismissed: number;
  unchanged: number;
}
