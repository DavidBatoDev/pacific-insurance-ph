/** Isomorphic outbound-email wire types: safe for client components, no server imports. */

import type { LibraryDocument } from "@/lib/repositories/document-library/document-library.entity";

export const SENDER_MAILBOX = "admin@pacificinsuranceph.com";

/** A status changes automatically; the suggested stage still requires consent. */
export interface LeadAdvanceSuggestion {
  clientId: string;
  name: string;
  referenceNo: string | null;
  currentStage: string | null;
  currentStatus: string | null;
  stage: string;
  status: string;
  label: string;
  /** What specifically triggered this — e.g. "Send brochure: Select Brochure", "Outcome: Reached". */
  detail?: string;
  /** ISO timestamp captured at write time by the same communication-driven callers. */
  occurredAt?: string;
  /** The status as it was immediately before this write — status changes automatically (unlike
   * stage), so by the time the popup opens `lead.status` already reflects the new value. */
  previousStatus?: string | null;
}

/**
 * Why the picker is blocked, when staff can unblock it themselves. Both are fields on the
 * contact record, so the UI can link straight to where they are edited. Deliberately absent
 * for "no approved asset matches": the Carrier Library is the blocker, not this contact.
 */
export type AttachmentFix = "product-interest" | "date-of-birth";

export interface EligibleLibraryDocuments {
  documents: LibraryDocument[];
  reason: string | null;
  fix?: AttachmentFix;
}

/** A stored client document offered as an email attachment. */
export interface EmailDocumentOption {
  id: string;
  name: string;
  documentType: string | null;
  uploadedAt: string;
  recordLabel: string | null;
}

export type EmailAttachmentSource =
  | { type: "library"; id: string }
  | { type: "document"; id: string }
  | { type: "email"; messageId: string; partId: string };

export type EmailRecordKind = "application" | "claim" | "renewal" | "travel" | "policy";

export type EmailOrigin =
  | { type: "contact"; clientId: string; record?: { kind: EmailRecordKind; id: string } }
  | { type: "application_missing"; id: string }
  | { type: "claim_missing"; id: string }
  | { type: "billing"; id: string }
  | { type: "submission"; kind: "application" | "claim"; id: string; contactId: string }
  | { type: "proposal_request"; clientId: string }
  | { type: "proposal_delivery"; clientId: string }
  | { type: "renewal_draft"; id: string; updatedAt: string }
  | { type: "reply"; messageId: string };

export interface EmailDraftSeed {
  origin: EmailOrigin;
  recipient: string;
  subject: string;
  body: string;
  templateName?: string;
  externalContactId?: string;
  requiredLibraryDocumentId?: string;
  optionalLibraryDocumentIds?: string[];
  documentIds?: string[];
  emailAttachments?: { messageId: string; partId: string }[];
}

export interface PrepareEmailInput {
  intentId: string;
  draft: EmailDraftSeed;
  repeatOfId?: string;
}

export type EmailSendState = "prepared" | "sending" | "accepted" | "failed" | "unknown";

export interface EmailSendView {
  origin: EmailOrigin;
  id: string;
  communicationId: string;
  state: EmailSendState;
  recipient: string;
  subject: string;
  body: string;
  attachments: { fileName: string; mimeType: string; size: number }[];
  errorCode: string | null;
  acceptedAt: string | null;
  gmailThreadId: string | null;
  effectsPending: boolean;
  /** True when Gmail accepted the message into a different thread than requested. */
  threadMismatch: boolean;
  /** Repeat (Try again / Send another copy) is allowed for this source and state. */
  canRepeat: boolean;
  advance?: LeadAdvanceSuggestion;
  /** Sanitized explanation for this specific response (e.g. reconciliation result). */
  notice?: string;
}

/** Sanitized, allowlisted explanations; never provider bodies. */
export const EMAIL_SEND_ERROR_MESSAGES: Record<string, string> = {
  gmail_send_rejected: "Gmail rejected this email. Review the recipient and attachments, then try again.",
  gmail_send_timeout: "Gmail did not answer in time. The email may have been sent.",
  gmail_send_unknown: "The sending outcome could not be confirmed. The email may have been sent.",
  gmail_send_invalid_response: "Gmail returned an unreadable response. The email may have been sent.",
  gmail_send_source_changed: "The record changed after this email was reviewed. Review a new draft before sending.",
  gmail_send_attachment_unavailable: "An attachment changed or is no longer available. Review a new draft before sending.",
  gmail_send_auth_required: "Gmail sending authorization needs an Admin to reconnect the mailbox.",
  gmail_send_persistence_unavailable: "The outcome could not be saved. The email may have been sent; check its status.",
  gmail_send_thread_mismatch: "Gmail accepted this reply in a different conversation. Do not resend; open it in Gmail.",
};

export function emailSendStatusLabel(view: Pick<EmailSendView, "state">): string {
  switch (view.state) {
    case "prepared": return "Ready to send";
    case "sending": return "Sending…";
    case "accepted": return "Sent — accepted by Gmail. Delivery and reading are not confirmed.";
    case "failed": return "Not sent";
    case "unknown": return "Sending outcome unknown. Do not resend; check Gmail status.";
  }
}

export function gmailThreadUrl(threadId: string): string {
  return `https://mail.google.com/mail/u/${encodeURIComponent(SENDER_MAILBOX)}/#all/${encodeURIComponent(threadId)}`;
}
