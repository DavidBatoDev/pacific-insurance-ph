"use server";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { outboundEmailErrorMessage, requireEmailSender } from "@/lib/communications/outbound-email";
import { getApplicationsRepository } from "@/lib/repositories/applications";
import { getClaimsRepository } from "@/lib/repositories/claims";
import {
  buildSubmissionEmail,
  defaultSubmissionContact,
  submittedItems,
  type SubmissionContact,
  type SubmissionItem,
  type SubmissionKind,
  type SubmissionRecord,
} from "@/lib/submissions/submission-email";
import { listSubmissionContacts, listSubmissionRecords, loadSubmissionSource, outstandingItems } from "@/lib/submissions/submission-files";

export interface SubmissionDraft {
  kind: SubmissionKind;
  clientId: string;
  clientName: string;
  referenceNo: string | null;
  contacts: SubmissionContact[];
  defaultContactId: string | null;
  subject: string;
  body: string;
  items: SubmissionItem[];
  /** Required checklist rows still Pending or Incomplete — they block sending. */
  outstanding: string[];
  /** Required rows with no uploaded file — every required item must travel as an attachment. */
  withoutFile: string[];
  /** Set once Pacific Cross has the package (YYYY-MM-DD, first submission date). */
  submittedDate: string | null;
}

const KINDS: readonly SubmissionKind[] = ["application", "claim"];

const itemName = (item: SubmissionItem) => (item.appliesTo ? `${item.documentName} — ${item.appliesTo}` : item.documentName);

async function submittedDateOf(kind: SubmissionKind, id: string): Promise<string | null> {
  if (kind === "application") return (await getApplicationsRepository().findById(id))?.dateSubmitted ?? null;
  return (await getClaimsRepository().findById(id))?.claimSubmittedDate ?? null;
}

/**
 * Everything the "Submit to Pacific Cross" step needs: recipients, a default email, the checklist
 * files and what still blocks sending. Sending itself goes through the shared Gmail review/send
 * control; the submitted status and date change only after Gmail accepts the email.
 */
export async function getSubmissionDraftAction(kind: SubmissionKind, id: string): Promise<ActionResult<SubmissionDraft>> {
  try {
    const actor = await requireEmailSender();
    if (!KINDS.includes(kind)) return { ok: false, error: "Unknown submission type." };
    const source = await loadSubmissionSource(kind, id);
    if (!source) return { ok: false, error: `This ${kind} could not be found.` };
    const [contacts, submittedDate] = await Promise.all([listSubmissionContacts(kind), submittedDateOf(kind, id)]);
    const email = buildSubmissionEmail({
      kind, clientName: source.clientName, subjectDetail: source.subjectDetail,
      referenceNo: source.referenceNo, items: source.items, senderName: actor.fullName,
    });
    const items = submittedItems(source.items);
    return {
      ok: true,
      data: {
        kind, clientId: source.clientId, clientName: source.clientName, referenceNo: source.referenceNo, contacts,
        defaultContactId: defaultSubmissionContact(kind, contacts)?.id ?? null,
        ...email, items,
        outstanding: outstandingItems(source.items).map(itemName),
        withoutFile: items.filter((item) => item.isRequired && item.documents.length === 0).map(itemName),
        submittedDate,
      },
    };
  } catch (error) {
    return { ok: false, error: outboundEmailErrorMessage(error) };
  }
}

/** The submission emails recorded for an application or claim, any outcome, newest first (read-only view). */
export async function listSubmissionRecordsAction(kind: SubmissionKind, id: string): Promise<ActionResult<SubmissionRecord[]>> {
  await getActor();
  try {
    if (!KINDS.includes(kind)) return { ok: false, error: "Unknown submission type." };
    return { ok: true, data: await listSubmissionRecords(kind, id) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to load the sent emails." };
  }
}
