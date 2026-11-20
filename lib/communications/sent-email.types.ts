/** Isomorphic Email → Sent wire types and URL contract: safe for client components. */

import type { EmailOrigin, EmailSendState, EmailSendView } from "./outbound-email.types";

export const SENT_EMAIL_PATH = "/inbox/sent";
export const SENT_EMAIL_PAGE_SIZE = 50;
export const SENT_EMAIL_MAX_PAGE = 2001;
export const SENT_EMAIL_MAX_QUERY = 200;

export const SENT_EMAIL_STATUSES = ["sent", "all", "prepared", "sending", "failed", "unknown"] as const;
export type SentEmailStatus = (typeof SENT_EMAIL_STATUSES)[number];

export const SENT_EMAIL_STATUS_LABELS: Record<SentEmailStatus, string> = {
  sent: "Sent",
  all: "All outcomes",
  prepared: "Prepared",
  sending: "Sending",
  failed: "Not sent",
  unknown: "Outcome unknown",
};

/** Short list labels; detail uses the full `emailSendStatusLabel` wording. */
export const SEND_STATE_SHORT_LABELS: Record<EmailSendState, string> = {
  accepted: "Sent",
  prepared: "Prepared",
  sending: "Sending",
  failed: "Not sent",
  unknown: "Outcome unknown",
};

export const ORIGIN_LABELS: Record<EmailOrigin["type"], string> = {
  contact: "Contact email",
  application_missing: "Missing application documents",
  claim_missing: "Missing claim documents",
  billing: "Billing",
  submission: "Pacific Cross submission",
  proposal_request: "Proposal request",
  proposal_delivery: "Proposal delivery",
  renewal_draft: "Renewal notice",
  reply: "Reply",
};

export function originLabel(type: string): string {
  return (ORIGIN_LABELS as Record<string, string>)[type] ?? "Email";
}

/** Dates are inclusive YYYY-MM-DD Philippine calendar days. */
export interface SentEmailFilters {
  query: string;
  status: SentEmailStatus;
  from: string | null;
  to: string | null;
  page: number;
}

export const DEFAULT_SENT_EMAIL_FILTERS: SentEmailFilters = { query: "", status: "sent", from: null, to: null, page: 1 };

export interface SentEmailSummary {
  id: string;
  clientId: string;
  clientName: string;
  clientReference: string | null;
  actorName: string;
  recipient: string;
  subject: string;
  targetKind: string;
  targetId: string;
  originType: string;
  effectiveState: EmailSendState;
  occurredAt: string;
  createdAt: string;
  acceptedAt: string | null;
  attachmentCount: number;
  effectsPending: boolean;
  threadMismatch: boolean;
}

export interface SentEmailPage {
  messages: SentEmailSummary[];
  page: number;
  hasNext: boolean;
}

export interface SentEmailDetail {
  email: EmailSendView;
  clientId: string;
  clientName: string;
  clientReference: string | null;
  actorName: string;
  targetKind: string;
  targetId: string;
  createdAt: string;
  dispatchStartedAt: string | null;
}

/** Canonical link for a filtered Sent view; defaults and empty values are omitted. */
export function sentEmailUrl(filters: SentEmailFilters, messageId?: string): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.status !== "sent") params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.page !== 1) params.set("page", String(filters.page));
  if (messageId) params.set("message", messageId);
  const search = params.toString();
  return search ? `${SENT_EMAIL_PATH}?${search}` : SENT_EMAIL_PATH;
}
