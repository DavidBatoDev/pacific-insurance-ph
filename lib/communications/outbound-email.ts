import "server-only";

import { createHash } from "node:crypto";

import { nextLeadStage } from "@/components/hub/lead-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getGmailReadAccess, getGmailSendAccess, type GmailAccess } from "@/lib/gmail/access";
import { gmailRequest } from "@/lib/gmail/api";
import { decodeWords, gmailObject, headers as gmailHeaders } from "@/lib/gmail/mime";
import { buildOutboundMime, MAX_BODY_BYTES, OUTBOUND_ID_HEADER, OutboundMimeError, parseSingleMailbox } from "@/lib/gmail/outbound-mime";
import { GmailAuthorizationError } from "@/lib/gmail/policy";
import { getReplyDraft } from "@/lib/gmail/reply";
import { InboxReviewError } from "@/lib/gmail/review";
import { GmailSendError, sendGmailMessage } from "@/lib/gmail/send-api";
import { getApplicationRequirementsRepository } from "@/lib/repositories/application-requirements";
import { getApplicationsRepository } from "@/lib/repositories/applications";
import { getClaimRequirementsRepository } from "@/lib/repositories/claim-requirements";
import { getClaimsRepository } from "@/lib/repositories/claims";
import { getClientsRepository, type Client } from "@/lib/repositories/clients";
import { getDocumentsRepository } from "@/lib/repositories/documents";
import { getExternalContactsRepository } from "@/lib/repositories/external-contacts";
import { getGmailRepository } from "@/lib/repositories/gmail";
import type { InboxTargetKind } from "@/lib/repositories/inbox/inbox.entity";
import { getOutboundEmailRepository, type OutboundEmail, type OutboundEmailRepository, type OutboundResult } from "@/lib/repositories/outbound-email";
import { getPaymentsRepository } from "@/lib/repositories/payments";
import { getRenewalAutomationRepository } from "@/lib/repositories/renewal-automation";
import { RepositoryError } from "@/lib/repositories/types";
import type { User } from "@/lib/repositories/users";
import { SUBMISSION_SUMMARY_PREFIX, submittedItems, zipEntryNames } from "@/lib/submissions/submission-email";
import { listSubmissionContacts, loadSubmissionSource, outstandingItems } from "@/lib/submissions/submission-files";
import {
  EmailAttachmentError, loadReviewedAttachments, resolveEmailAttachments,
  type AttachmentContext, type AttachmentManifestEntry, type LoadedAttachment,
} from "./email-attachments";
import {
  EMAIL_SEND_ERROR_MESSAGES, SENDER_MAILBOX,
  type EmailDraftSeed, type EmailOrigin, type EmailSendView, type LeadAdvanceSuggestion, type PrepareEmailInput,
} from "./outbound-email.types";

export const BILLING_SUMMARY_PREFIX = "Billing sent to client";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A dispatch older than this is treated as an uncertain outcome; it is never re-claimed. */
export const STALE_SENDING_MS = 120_000;
const RECONCILE_BUDGET_MS = 45_000;
/** Sent-mail search window around the dispatch start (Gmail stamps its own send time). */
const RECONCILE_WINDOW_BEFORE_S = 600;
const RECONCILE_WINDOW_AFTER_S = 2 * 24 * 60 * 60;
const REPEATABLE_ORIGINS: Partial<Record<EmailOrigin["type"], true>> = { contact: true, billing: true, submission: true, reply: true };

/** Every message is safe to show staff; never wraps provider or database text. */
export class OutboundEmailError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "OutboundEmailError";
  }
}

const REPOSITORY_MESSAGES: Record<string, string> = {
  outbound_forbidden: "Only active Admin and Staff accounts can send email from the agency mailbox.",
  outbound_connection: "Gmail sending is not connected. An Admin must reconnect admin@pacificinsuranceph.com.",
  outbound_intent_conflict: "This email changed after it was prepared. Review it again before sending.",
  outbound_repeat_invalid: "This email cannot be sent again from here. Check its current status.",
  outbound_record_unavailable: "The record for this email is no longer available.",
  outbound_no_outstanding: "There are no outstanding required documents to request.",
  outbound_billing_unavailable: "Record the billed amount first.",
  outbound_submission_outstanding: "Required checklist items are still outstanding.",
  outbound_contact_invalid: "Choose an active Pacific Cross contact with an email address for this department.",
  outbound_proposal_not_received: "The proposal must be Received before it can be sent.",
  outbound_proposal_document_required: "Attach the current Illustrative Proposal stored for this client.",
  outbound_renewal_changed: "This renewal draft changed. Reload it before sending.",
  outbound_renewal_not_due: "This draft is no longer due. Check the rule, contact, receipt, payment or policy status.",
  outbound_reply_unavailable: "This correspondence is no longer linked or available for a reply.",
  outbound_not_found: "Email not found.",
};

/** Maps any failure to a sanitized, staff-facing message. */
export function outboundEmailErrorMessage(error: unknown): string {
  if (error instanceof OutboundEmailError || error instanceof EmailAttachmentError || error instanceof OutboundMimeError
    || error instanceof InboxReviewError || error instanceof GmailAuthorizationError) return error.message;
  if (error instanceof RepositoryError && error.code && REPOSITORY_MESSAGES[error.code]) return REPOSITORY_MESSAGES[error.code];
  return "The email could not be processed. Nothing new was sent; check its status before trying again.";
}

/** Real DB role and status; persona previews never grant sending. */
export async function requireEmailSender(): Promise<User> {
  const user = await getCurrentUser();
  if (!user || user.status !== "Active" || !["Owner", "Admin", "Assistant"].includes(user.role)) {
    throw new OutboundEmailError(REPOSITORY_MESSAGES.outbound_forbidden, 403);
  }
  return user;
}

/* ---------------- Origin resolution (server-derived context) ---------------- */

interface ResolvedOrigin {
  client: Client;
  origin: EmailOrigin;
  targetKind: InboxTargetKind;
  targetId: string;
  summary: string;
  recipient: string;
  subject: string;
  externalContactId: string | null;
  inReplyTo: string | null;
  references: string[];
  requestedThreadId: string | null;
  googleSubject: string | null;
  /** Attachment selection after server overrides. */
  draft: EmailDraftSeed;
  fileNameOverrides?: Map<string, string>;
}

function firstLine(body: string): string {
  return (body.split("\n").find((line) => line.trim()) ?? "").trim().slice(0, 500);
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

async function requireClient(id: string): Promise<Client> {
  if (!UUID.test(id)) throw new OutboundEmailError(REPOSITORY_MESSAGES.outbound_record_unavailable, 404);
  const client = await getClientsRepository().findById(id);
  if (!client) throw new OutboundEmailError(REPOSITORY_MESSAGES.outbound_record_unavailable, 404);
  return client;
}

function requireUuid(...ids: (string | undefined)[]): void {
  if (ids.some((id) => !id || !UUID.test(id))) throw new OutboundEmailError("Choose a valid record.", 400);
}

async function resolveOrigin(draft: EmailDraftSeed): Promise<ResolvedOrigin> {
  const origin = draft.origin;
  const base = {
    origin, recipient: draft.recipient, subject: draft.subject, externalContactId: draft.externalContactId || null,
    inReplyTo: null, references: [] as string[], requestedThreadId: null, googleSubject: null, draft,
  };
  switch (origin?.type) {
    case "contact": {
      const client = await requireClient(origin.clientId);
      if (origin.record) requireUuid(origin.record.id);
      const kinds = ["application", "claim", "renewal", "travel", "policy"];
      if (origin.record && !kinds.includes(origin.record.kind)) throw new OutboundEmailError("Choose a valid record.");
      return { ...base, client, targetKind: origin.record?.kind ?? "client", targetId: origin.record?.id ?? client.id, summary: firstLine(draft.body) };
    }
    case "application_missing": {
      requireUuid(origin.id);
      const application = await getApplicationsRepository().findById(origin.id);
      if (!application || application.status === "Lead") throw new OutboundEmailError("This application is not available.", 404);
      const missing = (await getApplicationRequirementsRepository().listByApplication(origin.id))
        .filter((item) => item.isRequired && (item.status === "Pending" || item.status === "Incomplete"));
      if (!missing.length) throw new OutboundEmailError(REPOSITORY_MESSAGES.outbound_no_outstanding);
      return { ...base, client: await requireClient(application.clientId), targetKind: "application", targetId: application.id,
        summary: `Request for ${plural(missing.length, "outstanding document")}` };
    }
    case "claim_missing": {
      requireUuid(origin.id);
      const claim = await getClaimsRepository().findById(origin.id);
      if (!claim) throw new OutboundEmailError("This claim could not be found.", 404);
      const missing = (await getClaimRequirementsRepository().listByClaim(origin.id))
        .filter((item) => item.isRequired && (item.status === "Pending" || item.status === "Incomplete"));
      if (!missing.length) throw new OutboundEmailError(REPOSITORY_MESSAGES.outbound_no_outstanding);
      return { ...base, client: await requireClient(claim.clientId), targetKind: "claim", targetId: claim.id,
        summary: `Request for ${plural(missing.length, "outstanding claim document")}` };
    }
    case "billing": {
      requireUuid(origin.id);
      const application = await getApplicationsRepository().findById(origin.id);
      if (!application || application.status === "Lead") throw new OutboundEmailError("This application is not available.", 404);
      const payment = (await getPaymentsRepository().listByApplication(origin.id)).at(-1);
      if (!payment) throw new OutboundEmailError(REPOSITORY_MESSAGES.outbound_billing_unavailable);
      const amount = payment.amount != null ? `₱${payment.amount.toLocaleString("en-PH")}` : "the billed premium";
      return { ...base, client: await requireClient(application.clientId), targetKind: "application", targetId: application.id,
        summary: `${BILLING_SUMMARY_PREFIX} — ${amount}` };
    }
    case "submission": {
      requireUuid(origin.id, origin.contactId);
      if (origin.kind !== "application" && origin.kind !== "claim") throw new OutboundEmailError("Unknown submission type.");
      const source = await loadSubmissionSource(origin.kind, origin.id);
      if (!source) throw new OutboundEmailError(`This ${origin.kind} could not be found.`, 404);
      const outstanding = outstandingItems(source.items);
      if (outstanding.length) {
        throw new OutboundEmailError(`Still outstanding: ${outstanding.map((item) => item.documentName).join(", ")}.`);
      }
      const items = submittedItems(source.items);
      const withoutFile = items.filter((item) => item.isRequired && item.documents.length === 0);
      if (withoutFile.length) {
        throw new OutboundEmailError(`Upload the file for: ${withoutFile.map((item) => item.documentName).join(", ")}. Every required item must be attached.`);
      }
      const contact = (await listSubmissionContacts(origin.kind)).find((candidate) => candidate.id === origin.contactId);
      if (!contact) throw new OutboundEmailError("Pick a Pacific Cross contact to send to.");
      const overrides = new Map<string, string>();
      for (const { documentId, entry } of zipEntryNames(source.items)) if (!overrides.has(documentId)) overrides.set(documentId, entry);
      return {
        ...base, client: await requireClient(source.clientId), targetKind: origin.kind, targetId: origin.id,
        recipient: contact.email, externalContactId: contact.id,
        summary: `${SUBMISSION_SUMMARY_PREFIX} (${contact.email}) with ${plural(overrides.size, "file")}`,
        // Server-derived package: the exact checklist originals, nothing chosen by the browser.
        draft: { ...draft, requiredLibraryDocumentId: undefined, optionalLibraryDocumentIds: [], emailAttachments: [], documentIds: [...overrides.keys()] },
        fileNameOverrides: overrides,
      };
    }
    case "proposal_request": {
      const client = await requireClient(origin.clientId);
      requireUuid(draft.externalContactId);
      const contact = await getExternalContactsRepository().findById(draft.externalContactId!);
      if (!contact || contact.status !== "Active" || contact.department !== "New Business" || !contact.email) {
        throw new OutboundEmailError("Choose an active Pacific Cross contact with an email address.");
      }
      return { ...base, client, targetKind: "client", targetId: client.id, recipient: contact.email, externalContactId: contact.id,
        summary: `Proposal request sent to ${contact.email} (Pacific Cross)` };
    }
    case "proposal_delivery": {
      const client = await requireClient(origin.clientId);
      if (client.lifecycleStage !== "Lead" || client.proposalStatus !== "Received") throw new OutboundEmailError(REPOSITORY_MESSAGES.outbound_proposal_not_received);
      const documents = await Promise.all((draft.documentIds ?? []).map((id) => UUID.test(id) ? getDocumentsRepository().findById(id) : null));
      if (!documents.some((doc) => doc && doc.clientId === client.id && doc.documentType === "Illustrative Proposal" && doc.status !== "Replaced" && doc.filePath)) {
        throw new OutboundEmailError(REPOSITORY_MESSAGES.outbound_proposal_document_required);
      }
      return { ...base, client, targetKind: "client", targetId: client.id, summary: `Proposal delivery — ${firstLine(draft.body)}` };
    }
    case "renewal_draft": {
      requireUuid(origin.id);
      const renewalDraft = await getRenewalAutomationRepository().findDraft(origin.id);
      if (!renewalDraft) throw new OutboundEmailError("Renewal draft not found.", 404);
      if (renewalDraft.status !== "Draft" || renewalDraft.updatedAt !== origin.updatedAt) throw new OutboundEmailError(REPOSITORY_MESSAGES.outbound_renewal_changed, 409);
      return { ...base, client: await requireClient(renewalDraft.clientId), targetKind: "renewal", targetId: renewalDraft.renewalId,
        externalContactId: renewalDraft.externalContactId, summary: `Renewal email — ${renewalDraft.ruleName}` };
    }
    case "reply": {
      requireUuid(origin.messageId);
      const reply = await getReplyDraft(origin.messageId);
      return {
        ...base, client: await requireClient(reply.clientId), targetKind: reply.targetKind, targetId: reply.targetId,
        // Recipient and subject are locked to the original; changing them requires a new composition.
        recipient: reply.recipient, subject: reply.subject, externalContactId: null,
        inReplyTo: reply.inReplyTo, references: reply.references, requestedThreadId: reply.threadId, googleSubject: reply.googleSubject,
        summary: "Reply to incoming Gmail correspondence",
      };
    }
    default:
      throw new OutboundEmailError("Choose what this email is for.");
  }
}

/* ---------------- Hashing and views ---------------- */

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Stable content identity: excludes optimistic-concurrency fields, actors, timestamps and random IDs. */
export function outboundPayloadHash(input: {
  origin: EmailOrigin; clientId: string; targetKind: string; targetId: string; recipient: string; subject: string; body: string;
  templateName: string | null; externalContactId: string | null; inReplyTo: string | null; references: string[];
  requestedThreadId: string | null; attachments: AttachmentManifestEntry[];
}): string {
  const origin = input.origin.type === "renewal_draft" ? { type: input.origin.type, id: input.origin.id } : input.origin;
  return createHash("sha256").update(stable({
    ...input, origin, sender: SENDER_MAILBOX,
    attachments: input.attachments.map(({ source, fileName, mimeType, size, sha256, required }) => ({ source, fileName, mimeType, size, sha256, required: required ?? false })),
  }), "utf8").digest("hex");
}

function displayState(row: OutboundEmail, now: number): EmailSendView["state"] {
  if (row.state === "sending" && row.dispatchStartedAt && now - Date.parse(row.dispatchStartedAt) > STALE_SENDING_MS) return "unknown";
  return row.state;
}

function advanceFrom(row: OutboundEmail): LeadAdvanceSuggestion | undefined {
  const value = row.acceptanceMetadata.advance;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const meta = new Map(Object.entries(value));
  const text = (key: string) => (typeof meta.get(key) === "string" ? String(meta.get(key)) : null);
  const clientId = text("clientId");
  if (!clientId) return undefined;
  return {
    clientId, name: text("name") ?? "", referenceNo: text("referenceNo"),
    currentStage: text("currentStage"), currentStatus: text("currentStatus"), previousStatus: text("previousStatus"),
    stage: nextLeadStage(text("currentStage")) ?? "Contacted", status: text("status") ?? "Attempted",
    label: text("label") ?? "Email sent", detail: text("detail") ?? undefined, occurredAt: text("occurredAt") ?? undefined,
  };
}

export function toEmailSendView(row: OutboundEmail, now = Date.now(), notice?: string): EmailSendView {
  const state = displayState(row, now);
  const accepted = row.state === "accepted";
  return {
    id: row.id,
    origin: row.origin,
    communicationId: row.communicationId,
    state,
    recipient: row.recipientEmail,
    subject: row.subject,
    body: row.body,
    attachments: row.attachments.map(({ fileName, mimeType, size }) => ({ fileName, mimeType, size })),
    errorCode: state === "unknown" && !row.errorCode ? "gmail_send_unknown" : row.errorCode,
    acceptedAt: row.acceptedAt,
    gmailThreadId: row.gmailThreadId,
    effectsPending: accepted && !row.effectsAppliedAt,
    threadMismatch: row.errorCode === "gmail_send_thread_mismatch",
    canRepeat: row.state === "failed" || (accepted && Boolean(row.effectsAppliedAt) && REPEATABLE_ORIGINS[row.origin.type] === true),
    ...(accepted && row.effectsAppliedAt ? { advance: advanceFrom(row) } : {}),
    ...(notice ? { notice } : {}),
  };
}

/* ---------------- Service ---------------- */

interface SentEvidence {
  id: string;
  threadId: string;
  internalDate: string | null;
}

export interface OutboundEmailDeps {
  repository: () => OutboundEmailRepository;
  sender: () => Promise<User>;
  resolve: (draft: EmailDraftSeed) => Promise<ResolvedOrigin>;
  resolveAttachments: (draft: EmailDraftSeed, context: AttachmentContext) => Promise<LoadedAttachment[]>;
  loadReviewed: (manifest: AttachmentManifestEntry[], draft: EmailDraftSeed, context: AttachmentContext) => Promise<LoadedAttachment[]>;
  connection: () => Promise<{ googleSubject: string; oauthClientId: string; status: string } | null>;
  sendAccess: () => Promise<GmailAccess>;
  readAccess: () => Promise<GmailAccess>;
  send: typeof sendGmailMessage;
  gmailRead: <T>(path: string, access: GmailAccess) => Promise<T>;
  markReconnectRequired: () => Promise<void>;
  now: () => number;
}

const defaultDeps: OutboundEmailDeps = {
  repository: getOutboundEmailRepository,
  sender: requireEmailSender,
  resolve: resolveOrigin,
  resolveAttachments: resolveEmailAttachments,
  loadReviewed: loadReviewedAttachments,
  connection: () => getGmailRepository().getSummary(),
  sendAccess: getGmailSendAccess,
  readAccess: getGmailReadAccess,
  send: sendGmailMessage,
  gmailRead: (path, access) => gmailRequest(path, { access }),
  markReconnectRequired: async () => {
    const repo = getGmailRepository();
    const connection = await repo.getSummary();
    if (connection) await repo.recordCheck(connection.revision, connection.connectedBy, "reconnect_required", "invalid_token");
  },
  now: Date.now,
};

function normalizeBody(body: string): string {
  return body.replace(/\r\n?/g, "\n");
}

/** Rebuilds the reviewed attachment selection from the immutable manifest. */
function selectionFromManifest(row: OutboundEmail): EmailDraftSeed {
  const required = row.attachments.find((entry) => entry.required && entry.source.type === "library");
  return {
    origin: row.origin, recipient: row.recipientEmail, subject: row.subject, body: row.body,
    templateName: row.templateName ?? undefined, externalContactId: row.externalContactId ?? undefined,
    requiredLibraryDocumentId: required?.source.type === "library" ? required.source.id : undefined,
    optionalLibraryDocumentIds: row.attachments.flatMap((entry) => entry.source.type === "library" && !entry.required ? [entry.source.id] : []),
    documentIds: row.attachments.flatMap((entry) => entry.source.type === "document" ? [entry.source.id] : []),
    emailAttachments: row.attachments.flatMap((entry) => entry.source.type === "email" ? [{ messageId: entry.source.messageId, partId: entry.source.partId }] : []),
  };
}

export function createOutboundEmailService(overrides: Partial<OutboundEmailDeps> = {}) {
  const deps: OutboundEmailDeps = { ...defaultDeps, ...overrides };

  async function scopedRow(actorId: string, id: string): Promise<OutboundEmail> {
    if (!UUID.test(id)) throw new OutboundEmailError(REPOSITORY_MESSAGES.outbound_not_found, 404);
    const row = await deps.repository().get(actorId, id);
    if (!row) throw new OutboundEmailError(REPOSITORY_MESSAGES.outbound_not_found, 404);
    return row;
  }

  async function prepare(input: PrepareEmailInput): Promise<EmailSendView> {
    const actor = await deps.sender();
    if (!input || !UUID.test(input.intentId) || (input.repeatOfId !== undefined && !UUID.test(input.repeatOfId))) {
      throw new OutboundEmailError("Reload this email and try again.");
    }
    const draft = input.draft;
    if (!draft || typeof draft.recipient !== "string" || typeof draft.subject !== "string" || typeof draft.body !== "string") {
      throw new OutboundEmailError("Recipient, subject and message are required.");
    }
    const resolved = await deps.resolve(draft);
    const recipient = parseSingleMailbox(resolved.recipient);
    if (!recipient) throw new OutboundEmailError("Enter exactly one valid recipient email address.");
    const isReply = resolved.origin.type === "reply";
    const subject = isReply ? resolved.subject : resolved.subject.trim();
    const body = normalizeBody(draft.body);
    if ((!isReply && !subject) || !body.trim()) throw new OutboundEmailError("Add a subject and a message first.");
    if (/[\r\n\0]/.test(subject)) throw new OutboundEmailError("The subject cannot contain line breaks.");
    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) throw new OutboundEmailError("The message is too long to send (128 KB maximum).");

    const connection = await deps.connection();
    if (!connection || connection.status !== "connected") throw new OutboundEmailError(REPOSITORY_MESSAGES.outbound_connection);
    if (resolved.googleSubject && resolved.googleSubject !== connection.googleSubject) throw new OutboundEmailError(REPOSITORY_MESSAGES.outbound_reply_unavailable);

    const context: AttachmentContext = { client: resolved.client, fileNameOverrides: resolved.fileNameOverrides };
    const loaded = await deps.resolveAttachments(resolved.draft, context);
    // Size proof before anything is persisted: the real MIME with this intent's identity.
    await buildOutboundMime({
      id: input.intentId, createdAt: new Date(deps.now()).toISOString(), recipient, subject, body,
      inReplyTo: resolved.inReplyTo ?? undefined, references: resolved.references,
      attachments: loaded.map(({ entry, bytes }) => ({ fileName: entry.fileName, mimeType: entry.mimeType, bytes })),
    });
    const manifest = loaded.map(({ entry }) => entry);
    const templateName = draft.templateName?.trim() || null;
    const payloadHash = outboundPayloadHash({
      origin: resolved.origin, clientId: resolved.client.id, targetKind: resolved.targetKind, targetId: resolved.targetId,
      recipient, subject, body, templateName, externalContactId: resolved.externalContactId,
      inReplyTo: resolved.inReplyTo, references: resolved.references, requestedThreadId: resolved.requestedThreadId, attachments: manifest,
    });
    const row = await deps.repository().prepare(actor.id, {
      id: input.intentId, origin: resolved.origin, clientId: resolved.client.id, targetKind: resolved.targetKind, targetId: resolved.targetId,
      recipient, subject, body, summary: resolved.summary, templateName, externalContactId: resolved.externalContactId,
      inReplyTo: resolved.inReplyTo, references: resolved.references, requestedThreadId: resolved.requestedThreadId,
      attachments: manifest, payloadHash, repeatOfId: input.repeatOfId ?? null,
      googleSubject: connection.googleSubject, oauthClientId: connection.oauthClientId,
    });
    return toEmailSendView(row, deps.now());
  }

  async function applyEffects(row: OutboundEmail): Promise<EmailSendView> {
    try {
      return toEmailSendView(await deps.repository().applyEffects(row.id), deps.now());
    } catch {
      return toEmailSendView(row, deps.now(), "Gmail accepted this email; its workflow update is pending. Check status.");
    }
  }

  async function finishAndApply(row: OutboundEmail, token: string, result: OutboundResult): Promise<EmailSendView> {
    let finished: OutboundEmail;
    try {
      finished = await deps.repository().finish(row.id, token, result);
    } catch {
      // Never invite a resend: the outcome is recorded as uncertain until reconciled.
      const view = toEmailSendView({ ...row, state: result.state === "accepted" ? "unknown" : row.state === "sending" ? "unknown" : row.state, errorCode: "gmail_send_persistence_unavailable" }, deps.now());
      return { ...view, state: "unknown", notice: EMAIL_SEND_ERROR_MESSAGES.gmail_send_persistence_unavailable };
    }
    return finished.state === "accepted" ? applyEffects(finished) : toEmailSendView(finished, deps.now());
  }

  async function sendPrepared(id: string): Promise<EmailSendView> {
    const actor = await deps.sender();
    const row = await scopedRow(actor.id, id);
    if (row.state !== "prepared") return toEmailSendView(row, deps.now());

    let attachments: LoadedAttachment[];
    let raw: Buffer;
    let access: GmailAccess;
    try {
      const reviewed = selectionFromManifest(row);
      // Re-resolve authority from current records; a changed checklist or source fails here, never silently.
      const resolved = await deps.resolve(reviewed);
      attachments = await deps.loadReviewed(row.attachments, resolved.draft, { client: resolved.client, fileNameOverrides: resolved.fileNameOverrides });
      raw = await buildOutboundMime({
        id: row.id, createdAt: row.createdAt, recipient: row.recipientEmail, subject: row.subject, body: row.body,
        inReplyTo: row.inReplyTo ?? undefined, references: row.references,
        attachments: attachments.map(({ entry, bytes }) => ({ fileName: entry.fileName, mimeType: entry.mimeType, bytes })),
      });
    } catch (error) {
      const code = error instanceof EmailAttachmentError || error instanceof OutboundMimeError ? "gmail_send_attachment_unavailable" : "gmail_send_source_changed";
      const failed = await deps.repository().failPrepared(actor.id, row.id, code);
      return toEmailSendView(failed, deps.now(), outboundEmailErrorMessage(error));
    }
    try {
      access = await deps.sendAccess();
    } catch (error) {
      if (error instanceof GmailAuthorizationError && error.permanent) {
        return toEmailSendView(await deps.repository().failPrepared(actor.id, row.id, "gmail_send_auth_required"), deps.now());
      }
      // Transient: nothing was dispatched and the reviewed intent stays ready.
      throw new OutboundEmailError("Google could not be reached. Nothing was sent; try Send again.", 503);
    }
    if (access.googleSubject !== row.googleSubject) {
      return toEmailSendView(await deps.repository().failPrepared(actor.id, row.id, "gmail_send_auth_required"), deps.now());
    }

    const claim = await deps.repository().claim(actor.id, row.id);
    if (!claim.claimed || !claim.dispatchToken) {
      const blocked = claim.blockedBy ? "Another email for this record and recipient is still being sent or confirmed. Check its status first." : undefined;
      return toEmailSendView(claim.message, deps.now(), blocked);
    }
    const token = claim.dispatchToken;
    let result: OutboundResult;
    try {
      const sent = await deps.send({ raw, ...(row.requestedThreadId ? { threadId: row.requestedThreadId } : {}) }, access);
      const mismatch = row.requestedThreadId !== null && sent.gmailThreadId !== row.requestedThreadId;
      result = { state: "accepted", gmailMessageId: sent.gmailMessageId, gmailThreadId: sent.gmailThreadId,
        acceptedAt: new Date(deps.now()).toISOString(), ...(mismatch ? { errorCode: "gmail_send_thread_mismatch" as const } : {}) };
    } catch (error) {
      result = error instanceof GmailSendError
        ? { state: error.outcome, errorCode: error.code, ...(error.httpStatus ? { providerHttpStatus: error.httpStatus } : {}) }
        : { state: "unknown", errorCode: "gmail_send_unknown" };
      if (error instanceof GmailSendError && error.httpStatus === 401) await deps.markReconnectRequired().catch(() => undefined);
    }
    return finishAndApply(claim.message, token, result);
  }

  async function get(id: string): Promise<EmailSendView> {
    const actor = await deps.sender();
    return toEmailSendView(await scopedRow(actor.id, id), deps.now());
  }

  async function list(clientId: string, replyToMessageId?: string): Promise<EmailSendView[]> {
    const actor = await deps.sender();
    if (!UUID.test(clientId) || (replyToMessageId !== undefined && !UUID.test(replyToMessageId))) return [];
    const rows = await deps.repository().list(actor.id, clientId, replyToMessageId);
    return rows.map((row) => toEmailSendView(row, deps.now()));
  }

  /**
   * Reads Gmail's sent mail around the dispatch time and matches the server-built intent header;
   * Gmail replaces the supplied Message-ID, so that cannot be the locator. Never sends. An empty
   * search is never proof of non-delivery.
   */
  async function findSentEvidence(row: OutboundEmail, access: GmailAccess, deadline: number): Promise<SentEvidence[] | null> {
    const matches: SentEvidence[] = [];
    const started = Math.floor(Date.parse(row.dispatchStartedAt ?? row.createdAt) / 1000);
    const query = encodeURIComponent(`in:sent to:${row.recipientEmail} after:${started - RECONCILE_WINDOW_BEFORE_S} before:${started + RECONCILE_WINDOW_AFTER_S}`);
    let pageToken: string | null = null;
    do {
      if (deps.now() > deadline) return null;
      const page = gmailObject(await deps.gmailRead<unknown>(`messages?q=${query}&includeSpamTrash=true&maxResults=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`, access));
      const candidates = Array.isArray(page.messages) ? page.messages : [];
      for (const candidate of candidates) {
        if (deps.now() > deadline) return null;
        const id = gmailObject(candidate).id;
        if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(id)) continue;
        const full = gmailObject(await deps.gmailRead<unknown>(`messages/${id}?format=full`, access));
        const header = gmailHeaders(gmailObject(full.payload));
        // Other mail to the same recipient in the window is unrelated, not contradictory evidence.
        if ((header.get(OUTBOUND_ID_HEADER.toLowerCase()) ?? "").trim() !== row.id) continue;
        const labels = Array.isArray(full.labelIds) ? full.labelIds : [];
        const from = parseSingleMailbox(header.get("from") ?? "");
        const to = parseSingleMailbox(header.get("to") ?? "");
        const sameSubject = decodeWords(header.get("subject") ?? "") === row.subject.trim();
        if (!(labels.includes("SENT") && from === SENDER_MAILBOX && to === row.recipientEmail && sameSubject && !header.has("cc") && !header.has("bcc")
          && typeof full.threadId === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(full.threadId))) {
          // A copy carrying this intent's ID but different content keeps the outcome uncertain.
          return null;
        }
        matches.push({ id, threadId: full.threadId, internalDate: typeof full.internalDate === "string" && /^\d{1,16}$/.test(full.internalDate) ? full.internalDate : null });
      }
      pageToken = typeof page.nextPageToken === "string" ? page.nextPageToken : null;
    } while (pageToken);
    return matches;
  }

  async function check(id: string): Promise<EmailSendView> {
    const actor = await deps.sender();
    const row = await scopedRow(actor.id, id);
    if (row.state === "accepted") return row.effectsAppliedAt ? toEmailSendView(row, deps.now()) : applyEffects(row);
    const stale = row.state === "sending" && displayState(row, deps.now()) === "unknown";
    if (row.state !== "unknown" && !stale) return toEmailSendView(row, deps.now());
    if (!row.dispatchToken) return toEmailSendView(row, deps.now());
    let evidence: SentEvidence[] | null = null;
    try {
      const access = await deps.readAccess();
      if (access.googleSubject === row.googleSubject) evidence = await findSentEvidence(row, access, deps.now() + RECONCILE_BUDGET_MS);
    } catch {
      evidence = null;
    }
    if (evidence && evidence.length === 1) {
      const match = evidence[0];
      const occurred = match.internalDate !== null && Number.isSafeInteger(Number(match.internalDate)) ? new Date(Number(match.internalDate)) : null;
      const mismatch = row.requestedThreadId !== null && match.threadId !== row.requestedThreadId;
      return finishAndApply(row, row.dispatchToken, {
        state: "accepted", gmailMessageId: match.id, gmailThreadId: match.threadId, acceptedAt: new Date(deps.now()).toISOString(),
        ...(occurred && !Number.isNaN(occurred.getTime()) ? { occurredAt: occurred.toISOString() } : {}),
        ...(mismatch ? { errorCode: "gmail_send_thread_mismatch" as const } : {}),
      });
    }
    let current = row;
    if (stale) {
      try { current = await deps.repository().finish(row.id, row.dispatchToken, { state: "unknown", errorCode: "gmail_send_unknown" }); }
      catch { current = row; }
    }
    return toEmailSendView(current, deps.now(), evidence === null
      ? "Gmail could not be checked completely. The outcome remains unknown; do not resend."
      : evidence.length === 0
        ? "Gmail has no matching sent message yet. This does not prove it was not sent; check again later."
        : "More than one matching message was found. Open Gmail to review; do not resend.");
  }

  return { prepare, sendPrepared, get, list, check };
}

export const outboundEmailService = createOutboundEmailService();
