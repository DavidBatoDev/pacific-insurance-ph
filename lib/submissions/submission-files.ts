import "server-only";

import { getApplicationRequirementsRepository } from "@/lib/repositories/application-requirements";
import { getApplicationsRepository } from "@/lib/repositories/applications";
import { getClaimRequirementsRepository } from "@/lib/repositories/claim-requirements";
import { getClaimsRepository } from "@/lib/repositories/claims";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getDocumentsRepository } from "@/lib/repositories/documents";
import { getExternalContactsRepository } from "@/lib/repositories/external-contacts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  SUBMISSION_DEPARTMENTS,
  SUBMISSION_SUMMARY_PREFIX,
  type SubmissionContact,
  type SubmissionItem,
  type SubmissionKind,
  type SubmissionRecord,
} from "./submission-email";

export interface SubmissionSource {
  kind: SubmissionKind;
  id: string;
  clientId: string;
  clientName: string;
  referenceNo: string | null;
  subjectDetail: string | null;
  items: SubmissionItem[];
  /** Storage paths of every listed document, by document id. */
  filePaths: Map<string, string>;
}

/** Loads an application or claim with its checklist and the files uploaded against each row. */
export async function loadSubmissionSource(kind: SubmissionKind, id: string): Promise<SubmissionSource | null> {
  const record = kind === "application"
    ? await getApplicationsRepository().findById(id).then((application) => application && application.status !== "Lead" ? {
        clientId: application.clientId, referenceNo: application.referenceNo,
        subjectDetail: application.productName ?? application.applicationType,
      } : null)
    : await getClaimsRepository().findById(id).then((claim) => claim && {
        clientId: claim.clientId, referenceNo: claim.referenceNo, subjectDetail: claim.claimType,
      });
  if (!record) return null;

  const [client, requirements, documents] = await Promise.all([
    getClientsRepository().findById(record.clientId),
    kind === "application"
      ? getApplicationRequirementsRepository().listByApplication(id)
      : getClaimRequirementsRepository().listByClaim(id),
    getDocumentsRepository().listByClient(record.clientId),
  ]);
  const filePaths = new Map<string, string>();
  const items = requirements.map((requirement) => {
    const linked = documents.filter((document) =>
      document.filePath &&
      (kind === "application" ? document.applicationRequirementId : document.claimRequirementId) === requirement.id);
    for (const document of linked) filePaths.set(document.id, document.filePath!);
    return {
      requirementId: requirement.id,
      documentName: requirement.documentName,
      appliesTo: requirement.appliesTo,
      status: requirement.status,
      isRequired: requirement.isRequired,
      documents: linked.map((document) => ({ id: document.id, name: document.name })),
    };
  });
  return {
    kind, id, clientId: record.clientId, clientName: client?.fullName ?? "Client",
    referenceNo: record.referenceNo, subjectDetail: record.subjectDetail, items, filePaths,
  };
}

export async function listSubmissionContacts(kind: SubmissionKind): Promise<SubmissionContact[]> {
  const contacts = await getExternalContactsRepository().list({ status: "Active", departments: SUBMISSION_DEPARTMENTS[kind] });
  return contacts.flatMap((contact) => contact.email
    ? [{ id: contact.id, name: contact.name, email: contact.email, department: contact.department }]
    : []);
}

/** Required rows still Pending or Incomplete — they block submission. */
export const outstandingItems = (items: SubmissionItem[]) =>
  items.filter((item) => item.isRequired && (item.status === "Pending" || item.status === "Incomplete"));

/**
 * Communications logged against an application or claim whose summary starts with a known
 * prefix (submissions, Pacific Cross replies, billing sent), newest first.
 */
export async function listCommunicationRecords(input: {
  kind: SubmissionKind;
  id: string;
  summaryPrefix: string;
  direction?: "Inbound" | "Outbound";
}): Promise<SubmissionRecord[]> {
  let query = getSupabaseAdmin()
    .from("communications")
    .select("id, occurred_at, created_at, subject, notes, summary, external_contact_id, external_contacts (name, email), users:related_user_id (full_name)")
    .eq(input.kind === "application" ? "application_id" : "claim_id", input.id)
    .like("summary", `${input.summaryPrefix}%`);
  if (input.direction) query = query.eq("direction", input.direction);
  const { data, error } = await query
    .order("occurred_at", { ascending: false })
    .returns<{
      id: string; occurred_at: string | null; created_at: string; subject: string | null; notes: string | null; summary: string | null;
      external_contact_id: string | null;
      external_contacts: { name: string; email: string | null } | null; users: { full_name: string | null } | null;
    }[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at ?? row.created_at,
    subject: row.subject,
    body: row.notes,
    summary: row.summary,
    contactId: row.external_contact_id,
    contactName: row.external_contacts?.name ?? null,
    contactEmail: row.external_contacts?.email ?? null,
    senderName: row.users?.full_name ?? null,
  }));
}

/** The submission emails logged for an application or claim, newest first. */
export const listSubmissionRecords = (kind: SubmissionKind, id: string) =>
  listCommunicationRecords({ kind, id, summaryPrefix: SUBMISSION_SUMMARY_PREFIX, direction: "Outbound" });
