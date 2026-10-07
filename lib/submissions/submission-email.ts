/**
 * The "Submit to Pacific Cross" step (applications and claims): the default email Eman sends to
 * Pacific Cross once a checklist is complete, and the file names used inside the documents ZIP.
 * Pure, so the composer, the actions and the ZIP route all agree on the wording.
 */

export type SubmissionKind = "application" | "claim";

/** Every logged submission's `communications.summary` starts with this, so it can be found again. */
export const SUBMISSION_SUMMARY_PREFIX = "Submitted to Pacific Cross";

/** A submission email already logged against an application or claim. */
export interface SubmissionRecord {
  id: string;
  occurredAt: string;
  subject: string | null;
  body: string | null;
  summary: string | null;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  senderName: string | null;
}

export interface SubmissionDocument {
  id: string;
  name: string;
}

export interface SubmissionItem {
  requirementId: string;
  documentName: string;
  appliesTo: string | null;
  status: string;
  isRequired: boolean;
  documents: SubmissionDocument[];
}

export interface SubmissionContact {
  id: string;
  name: string;
  email: string;
  department: string | null;
}

/** Pacific Cross departments that receive each kind of submission, most specific first. */
export const SUBMISSION_DEPARTMENTS: Record<SubmissionKind, string[]> = {
  application: ["New Business"],
  claim: ["Claims", "Claims and Customer Service"],
};

/** Shared inboxes preferred as the default recipient over a named officer. */
const DEFAULT_INBOX: Record<SubmissionKind, string> = {
  application: "newbiz@",
  claim: "claims@",
};

export function defaultSubmissionContact(kind: SubmissionKind, contacts: SubmissionContact[]): SubmissionContact | null {
  return contacts.find((contact) => contact.email.toLowerCase().startsWith(DEFAULT_INBOX[kind])) ?? contacts[0] ?? null;
}

/** Items that go to Pacific Cross: everything required, plus optional items that have a file. */
export function submittedItems(items: SubmissionItem[]): SubmissionItem[] {
  return items.filter((item) => item.isRequired || item.documents.length > 0);
}

const itemLabel = (item: SubmissionItem) => (item.appliesTo ? `${item.documentName} — ${item.appliesTo}` : item.documentName);

export function buildSubmissionEmail(input: {
  kind: SubmissionKind;
  clientName: string;
  /** Product name (applications) or claim type (claims). */
  subjectDetail: string | null;
  referenceNo: string | null;
  items: SubmissionItem[];
  senderName: string;
}): { subject: string; body: string } {
  const items = submittedItems(input.items);
  const list = items.length
    ? items.map((item, index) => `${index + 1}. ${itemLabel(item)}${item.documents.length ? "" : " (to follow)"}`).join("\n")
    : "(no documents listed)";
  const detail = input.subjectDetail ?? (input.kind === "application" ? "Application" : "Claim");
  if (input.kind === "application") {
    return {
      subject: `New application — ${input.clientName} — ${detail}`,
      body: [
        "Hi New Business team,",
        "",
        `Please find attached the ${detail} application of ${input.clientName}${input.referenceNo ? ` (our ref. ${input.referenceNo})` : ""} for processing.`,
        "",
        "Documents enclosed:",
        list,
        "",
        "Kindly let us know if anything else is needed.",
        "",
        "Thank you,",
        input.senderName,
      ].join("\n"),
    };
  }
  return {
    subject: `Claim submission — ${input.clientName}${input.referenceNo ? ` — ${input.referenceNo}` : ""} — ${detail}`,
    body: [
      "Hi Claims team,",
      "",
      `Please find attached the ${detail} claim of ${input.clientName}${input.referenceNo ? ` (our ref. ${input.referenceNo})` : ""} for evaluation.`,
      "",
      "Documents enclosed:",
      list,
      "",
      "Kindly let us know if anything else is needed.",
      "",
      "Thank you,",
      input.senderName,
    ].join("\n"),
  };
}

const unsafe = /[\\/:*?"<>|\u0000-\u001f]+/g;
export const safeFileName = (value: string) => value.replace(unsafe, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "file";

/** "01 - Medical certificate - scan.pdf"; a second file for the same item gets " (2)". */
export function zipEntryNames(items: SubmissionItem[]): { documentId: string; entry: string }[] {
  const used = new Set<string>();
  return submittedItems(items).flatMap((item, index) =>
    item.documents.map((document) => {
      const base = `${String(index + 1).padStart(2, "0")} - ${safeFileName(itemLabel(item))} - ${safeFileName(document.name)}`;
      let entry = base;
      for (let n = 2; used.has(entry.toLowerCase()); n += 1) {
        const dot = base.lastIndexOf(".");
        entry = dot > 0 ? `${base.slice(0, dot)} (${n})${base.slice(dot)}` : `${base} (${n})`;
      }
      used.add(entry.toLowerCase());
      return { documentId: document.id, entry };
    }),
  );
}

/** Copy-ready plain text of the composed email. */
export const emailClipboardText = (to: string, subject: string, body: string) => `To: ${to}\nSubject: ${subject}\n\n${body}`;
