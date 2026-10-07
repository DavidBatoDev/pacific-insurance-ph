"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { logOutboundEmail } from "@/lib/communications/log-outbound-email";
import { getApplicationsRepository } from "@/lib/repositories/applications";
import { getClaimsRepository } from "@/lib/repositories/claims";
import {
  buildSubmissionEmail,
  defaultSubmissionContact,
  SUBMISSION_SUMMARY_PREFIX,
  submittedItems,
  type SubmissionContact,
  type SubmissionItem,
  type SubmissionKind,
  type SubmissionRecord,
} from "@/lib/submissions/submission-email";
import { listSubmissionContacts, listSubmissionRecords, loadSubmissionSource, outstandingItems } from "@/lib/submissions/submission-files";

export interface SubmissionDraft {
  kind: SubmissionKind;
  clientName: string;
  referenceNo: string | null;
  contacts: SubmissionContact[];
  defaultContactId: string | null;
  subject: string;
  body: string;
  items: SubmissionItem[];
  outstanding: number;
  /** Set once the record has been marked submitted (YYYY-MM-DD). */
  submittedDate: string | null;
}

const KINDS: readonly SubmissionKind[] = ["application", "claim"];
const SUBMITTED_STATUS: Record<SubmissionKind, string> = { application: "Submitted to Pacific Cross", claim: "Submitted" };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

async function submittedDateOf(kind: SubmissionKind, id: string): Promise<string | null> {
  if (kind === "application") return (await getApplicationsRepository().findById(id))?.dateSubmitted ?? null;
  return (await getClaimsRepository().findById(id))?.claimSubmittedDate ?? null;
}

/** Everything the "Submit to Pacific Cross" step needs: recipients, a default email, the files. */
export async function getSubmissionDraftAction(kind: SubmissionKind, id: string): Promise<ActionResult<SubmissionDraft>> {
  const actor = await getActor();
  try {
    if (!KINDS.includes(kind)) return { ok: false, error: "Unknown submission type." };
    const source = await loadSubmissionSource(kind, id);
    if (!source) return { ok: false, error: `This ${kind} could not be found.` };
    const [contacts, submittedDate] = await Promise.all([listSubmissionContacts(kind), submittedDateOf(kind, id)]);
    const email = buildSubmissionEmail({
      kind, clientName: source.clientName, subjectDetail: source.subjectDetail,
      referenceNo: source.referenceNo, items: source.items, senderName: actor.fullName,
    });
    return {
      ok: true,
      data: {
        kind, clientName: source.clientName, referenceNo: source.referenceNo, contacts,
        defaultContactId: defaultSubmissionContact(kind, contacts)?.id ?? null,
        ...email, items: submittedItems(source.items),
        outstanding: outstandingItems(source.items).length, submittedDate,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to prepare the submission." };
  }
}

/**
 * Records that the package went to Pacific Cross: logs the email (R1 — nothing is delivered; Eman
 * sends it from her own mailbox), moves the record to its submitted status and stamps the date.
 */
export async function submitToPacificCrossAction(
  kind: SubmissionKind,
  id: string,
  input: { contactId: string; subject: string; body: string },
): Promise<ActionResult<{ submittedDate: string }>> {
  const actor = await getActor();
  try {
    if (!KINDS.includes(kind)) return { ok: false, error: "Unknown submission type." };
    const subject = input.subject.trim();
    const body = input.body.trim();
    if (!subject || !body) return { ok: false, error: "Add a subject and a message before submitting." };
    const source = await loadSubmissionSource(kind, id);
    if (!source) return { ok: false, error: `This ${kind} could not be found.` };
    const outstanding = outstandingItems(source.items);
    if (outstanding.length) {
      return { ok: false, error: `${outstanding.length} required item${outstanding.length === 1 ? " is" : "s are"} still outstanding.` };
    }
    const contact = (await listSubmissionContacts(kind)).find((candidate) => candidate.id === input.contactId);
    if (!contact) return { ok: false, error: "Pick a Pacific Cross contact to send to." };

    const files = submittedItems(source.items).reduce((count, item) => count + item.documents.length, 0);
    const communicationId = await logOutboundEmail({
      clientId: source.clientId,
      applicationId: kind === "application" ? id : null,
      claimId: kind === "claim" ? id : null,
      actorId: actor.id,
      externalContactId: contact.id,
      subject,
      summary: `${SUBMISSION_SUMMARY_PREFIX} (${contact.email}) with ${files} file${files === 1 ? "" : "s"}`,
      notes: body,
    });

    const date = today();
    let previous: Record<string, string | null>;
    if (kind === "application") {
      const application = await getApplicationsRepository().findById(id);
      previous = { status: application?.status ?? null, date_submitted: application?.dateSubmitted ?? null };
      await getApplicationsRepository().update(id, {
        status: SUBMITTED_STATUS.application,
        dateSubmitted: application?.dateSubmitted ?? date,
      });
    } else {
      const claim = await getClaimsRepository().findById(id);
      previous = { status: claim?.status ?? null, claim_submitted_date: claim?.claimSubmittedDate ?? null };
      await getClaimsRepository().update(id, {
        status: SUBMITTED_STATUS.claim,
        claimSubmittedDate: claim?.claimSubmittedDate ?? date,
      });
    }

    const label = source.referenceNo ?? kind;
    await recordActivity({
      scopeType: "client", scopeId: source.clientId, actorId: actor.id,
      activityType: kind === "application" ? "application.submitted" : "claim.submitted",
      summary: `${label} submitted to Pacific Cross (${contact.email}) — logged, sent from Eman’s mailbox`,
    });
    await recordAudit({
      actorId: actor.id, action: "submit_to_pacific_cross",
      tableName: kind === "application" ? "applications" : "claims", recordId: id,
      previousValue: previous,
      newValue: { status: SUBMITTED_STATUS[kind], communication_id: communicationId, external_contact_id: contact.id },
    });
    revalidatePath(kind === "application" ? "/applications" : "/claims");
    revalidatePath(`/clients/${source.clientId}`);
    return { ok: true, data: { submittedDate: date } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to record the submission." };
  }
}

/** The submission emails already logged for an application or claim, newest first (read-only view). */
export async function listSubmissionRecordsAction(kind: SubmissionKind, id: string): Promise<ActionResult<SubmissionRecord[]>> {
  await getActor();
  try {
    if (!KINDS.includes(kind)) return { ok: false, error: "Unknown submission type." };
    return { ok: true, data: await listSubmissionRecords(kind, id) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to load the sent emails." };
  }
}
