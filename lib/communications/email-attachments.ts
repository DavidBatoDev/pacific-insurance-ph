import "server-only";

import { createHash } from "node:crypto";
import { extname } from "node:path";
import { detectMimeType } from "nodemailer/lib/mime-funcs";

import { getRequirementAttachmentOriginal } from "@/lib/documents/requirement-attachments";
import { safeGmailFileName } from "@/lib/gmail/mime";
import { MAX_SELECTED_ATTACHMENT_BYTES } from "@/lib/gmail/outbound-mime";
import type { Client } from "@/lib/repositories/clients";
import {
  getDocumentLibraryRepository, LIBRARY_DOCUMENT_TYPES, MAX_OPTIONAL_ATTACHMENTS,
} from "@/lib/repositories/document-library";
import { getDocumentsRepository, type DocumentRecord } from "@/lib/repositories/documents";
import { getInboxRepository } from "@/lib/repositories/inbox";
import { downloadObject, getObjectInfo } from "@/lib/supabase/storage";
import type { EligibleLibraryDocuments, EmailAttachmentSource, EmailDraftSeed } from "./outbound-email.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PART_ID = /^(?:\d+(?:\.\d+)*)?$/;
const MAX_ATTACHMENTS = 40;

export class EmailAttachmentError extends Error {
  constructor(message: string, public readonly code: "invalid" | "unavailable" | "too_large" = "invalid") {
    super(message);
    this.name = "EmailAttachmentError";
  }
}

/* ---------------- Carrier library eligibility (moved from engage-actions) ---------------- */

export type RequiredLibraryType = "Brochure" | "Application Form";

/** Exact template literals only; do not broaden matching. */
export function attachmentRequirement(templateName: string | null | undefined): RequiredLibraryType | null {
  if (templateName === "Send brochure") return "Brochure";
  if (templateName === "Send application form") return "Application Form";
  return null;
}

function ageOn(dateOfBirth: string) {
  const today = new Date(); const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  if (today.getUTCMonth() < dob.getUTCMonth() || (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export async function resolveEligibleLibraryDocuments(client: Client, documentType: RequiredLibraryType): Promise<EligibleLibraryDocuments> {
  if (!client.productInterest?.trim()) return { documents: [], reason: "Set the contact’s product interest before selecting a carrier asset.", fix: "product-interest" };
  let ageBand: "All Ages" | "0-70" | "71-100" = "All Ages";
  if (documentType === "Application Form") {
    if (!client.dateOfBirth) return { documents: [], reason: "Add the contact’s date of birth before selecting an application form.", fix: "date-of-birth" };
    const age = ageOn(client.dateOfBirth);
    if (age < 0 || age > 100) return { documents: [], reason: "No supported application-form age band matches this contact.", fix: "date-of-birth" };
    ageBand = age <= 70 ? "0-70" : "71-100";
  }
  const documents = await getDocumentLibraryRepository().listEligible({ productName: client.productInterest, documentTypes: [documentType], ageBand });
  return { documents, reason: documents.length ? null : `No active, approved ${documentType.toLowerCase()} matches ${client.productInterest}${documentType === "Application Form" ? ` · ${ageBand}` : ""}.` };
}

/**
 * Optional attachments: everything approved for this contact's product, of any type, with no
 * reference to the email template. An optional asset can never satisfy a mandatory selection.
 */
export async function resolveOptionalLibraryDocuments(client: Client): Promise<EligibleLibraryDocuments> {
  if (!client.productInterest?.trim())
    return { documents: [], reason: "Set the contact’s product interest to browse the carrier library.", fix: "product-interest" };
  // "All Ages" narrows to All-Ages rows rather than meaning "any band": the optional list must
  // never offer what the required gate would reject.
  let ageBand: "All Ages" | "0-70" | "71-100" = "All Ages";
  if (client.dateOfBirth) {
    const age = ageOn(client.dateOfBirth);
    if (age >= 0 && age <= 100) ageBand = age <= 70 ? "0-70" : "71-100";
  }
  const documents = await getDocumentLibraryRepository().listEligible({ productName: client.productInterest, documentTypes: LIBRARY_DOCUMENT_TYPES, ageBand });
  return { documents, reason: documents.length ? null : `No approved library assets match ${client.productInterest} yet.` };
}

/* ---------------- Manifest ---------------- */

export interface AttachmentManifestEntry {
  source: EmailAttachmentSource;
  /** Output name in the MIME message (disambiguated). */
  fileName: string;
  mimeType: string;
  size: number;
  sha256: string;
  storagePath?: string;
  libraryVersionLabel?: string;
  libraryDocumentName?: string;
  /** Distinguishes the mandatory carrier asset from optional ones. */
  required?: boolean;
}

export interface LoadedAttachment {
  entry: AttachmentManifestEntry;
  bytes: Buffer;
}

function mimeFor(name: string): string {
  const extension = extname(name).slice(1).toLowerCase();
  // detectMimeType falls back to application/octet-stream for unknown extensions; never a PDF guess.
  return extension ? detectMimeType(extension) : "application/octet-stream";
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Keeps source IDs, only changes the presented name: "a.pdf", "a (2).pdf". */
export function disambiguateFileNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const clean = safeGmailFileName(name);
    const extension = extname(clean);
    const stem = extension ? clean.slice(0, -extension.length) : clean;
    let candidate = clean;
    for (let index = 2; used.has(candidate.toLowerCase()); index++) candidate = `${stem} (${index})${extension}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

async function loadStorage(path: string, declaredSize: number | null, budget: { remaining: number }): Promise<Buffer> {
  const info = await getObjectInfo(path).catch(() => null);
  const size = Number(info?.size);
  if (!info || !Number.isSafeInteger(size) || size <= 0) throw new EmailAttachmentError("An attachment is no longer available.", "unavailable");
  if (declaredSize !== null && declaredSize > 0 && declaredSize !== size) throw new EmailAttachmentError("An attachment changed after it was selected.", "unavailable");
  if (size > budget.remaining) throw new EmailAttachmentError("Selected attachments exceed 25 MB. Remove files before sending.", "too_large");
  const blob = await downloadObject(path).catch(() => null);
  if (!blob) throw new EmailAttachmentError("An attachment is no longer available.", "unavailable");
  const bytes = Buffer.from(await blob.arrayBuffer());
  if (bytes.length !== size) throw new EmailAttachmentError("An attachment could not be read completely.", "unavailable");
  budget.remaining -= bytes.length;
  return bytes;
}

interface SourceSpec {
  source: EmailAttachmentSource;
  required?: boolean;
}

/** Identity of an attachment source, independent of object key order. */
function sourceKey(source: EmailAttachmentSource): string {
  return source.type === "email" ? `email:${source.messageId}:${source.partId}` : `${source.type}:${source.id}`;
}

function selectedSources(draft: EmailDraftSeed): SourceSpec[] {
  const specs: SourceSpec[] = [];
  const seen = new Set<string>();
  const add = (spec: SourceSpec) => {
    const key = sourceKey(spec.source);
    if (seen.has(key)) return;
    seen.add(key);
    specs.push(spec);
  };
  if (draft.requiredLibraryDocumentId) add({ source: { type: "library", id: draft.requiredLibraryDocumentId }, required: true });
  for (const id of draft.optionalLibraryDocumentIds ?? []) add({ source: { type: "library", id } });
  for (const id of draft.documentIds ?? []) add({ source: { type: "document", id } });
  for (const item of draft.emailAttachments ?? []) add({ source: { type: "email", messageId: item.messageId, partId: item.partId } });
  for (const spec of specs) {
    const ok = spec.source.type === "email"
      ? UUID.test(spec.source.messageId) && PART_ID.test(spec.source.partId) && spec.source.partId.length <= 255
      : UUID.test(spec.source.id);
    if (!ok) throw new EmailAttachmentError("Choose valid attachments.");
  }
  if (specs.length > MAX_ATTACHMENTS) throw new EmailAttachmentError(`Attach at most ${MAX_ATTACHMENTS} files.`);
  return specs;
}

export interface AttachmentContext {
  client: Client;
  /** Server-derived output names (e.g. numbered submission entries), keyed by document ID. */
  fileNameOverrides?: ReadonlyMap<string, string>;
}

async function checkLibrarySelection(draft: EmailDraftSeed, client: Client): Promise<void> {
  const requirement = attachmentRequirement(draft.templateName);
  const requiredId = draft.requiredLibraryDocumentId || null;
  if (requirement) {
    const eligible = await resolveEligibleLibraryDocuments(client, requirement);
    if (eligible.reason) throw new EmailAttachmentError(eligible.reason);
    if (!requiredId || !eligible.documents.some((doc) => doc.id === requiredId))
      throw new EmailAttachmentError(`Choose the approved ${requirement.toLowerCase()} matched to this contact.`);
  } else if (requiredId) {
    throw new EmailAttachmentError("This email template does not require a carrier attachment.");
  }
  const optionalIds = [...new Set(draft.optionalLibraryDocumentIds ?? [])].filter((id) => id !== requiredId);
  if (optionalIds.length) {
    if (optionalIds.length > MAX_OPTIONAL_ATTACHMENTS) throw new EmailAttachmentError(`Attach at most ${MAX_OPTIONAL_ATTACHMENTS} library assets.`);
    const allowed = await resolveOptionalLibraryDocuments(client);
    if (optionalIds.some((id) => !allowed.documents.some((doc) => doc.id === id)))
      throw new EmailAttachmentError("One or more selected attachments are no longer available. Reopen the attachment list and choose again.");
  }
}

function usableDocument(document: DocumentRecord | null, clientId: string): document is DocumentRecord & { filePath: string } {
  return Boolean(document && document.clientId === clientId && document.filePath && document.status !== "Replaced");
}

async function loadEmailOriginal(messageId: string, partId: string, clientId: string, budget: { remaining: number }) {
  const original = await getRequirementAttachmentOriginal(messageId, partId).catch(() => null);
  if (!original) throw new EmailAttachmentError("An email attachment is no longer available.", "unavailable");
  // Re-read through the actor-scoped repository: the message must still be released to this client.
  const message = await getInboxRepository().getVisible(messageId, original.actorId);
  const part = message?.attachments.find((attachment) => attachment.partId === partId);
  if (!message || message.clientId !== clientId || !message.targetId || !part) {
    throw new EmailAttachmentError("Email attachments must come from correspondence released to this client.", "unavailable");
  }
  if (original.bytes.length === 0) throw new EmailAttachmentError("An email attachment is empty.", "unavailable");
  if (original.bytes.length > budget.remaining) throw new EmailAttachmentError("Selected attachments exceed 25 MB. Remove files before sending.", "too_large");
  budget.remaining -= original.bytes.length;
  return { bytes: original.bytes, fileName: original.fileName, mimeType: part.mimeType || "application/octet-stream" };
}

/**
 * Validates selection authority, loads real bytes sequentially and records the immutable manifest.
 * Never fetches browser-supplied URLs or Storage paths.
 */
export async function resolveEmailAttachments(draft: EmailDraftSeed, context: AttachmentContext): Promise<LoadedAttachment[]> {
  const specs = selectedSources(draft);
  if (specs.some((spec) => spec.source.type === "library") || attachmentRequirement(draft.templateName)) {
    await checkLibrarySelection(draft, context.client);
  }
  const budget = { remaining: MAX_SELECTED_ATTACHMENT_BYTES };
  const loaded: { entry: Omit<AttachmentManifestEntry, "fileName"> & { originalName: string }; bytes: Buffer }[] = [];
  for (const spec of specs) {
    const source = spec.source;
    if (source.type === "library") {
      const asset = await getDocumentLibraryRepository().findById(source.id);
      if (!asset?.filePath) throw new EmailAttachmentError("A carrier library asset is no longer available.", "unavailable");
      if ((asset.fileSizeBytes ?? 0) > budget.remaining) throw new EmailAttachmentError("Selected attachments exceed 25 MB. Remove files before sending.", "too_large");
      const bytes = await loadStorage(asset.filePath, asset.fileSizeBytes, budget);
      const originalName = asset.originalFileName || `${asset.documentName}${extname(asset.filePath)}`;
      loaded.push({ bytes, entry: {
        source, originalName, mimeType: asset.mimeType || mimeFor(originalName), size: bytes.length, sha256: sha256(bytes),
        storagePath: asset.filePath, libraryVersionLabel: asset.versionLabel, libraryDocumentName: asset.documentName,
        ...(spec.required ? { required: true } : {}),
      } });
    } else if (source.type === "document") {
      const document = await getDocumentsRepository().findById(source.id);
      if (!usableDocument(document, context.client.id)) {
        throw new EmailAttachmentError("Documents must be current files stored for this client.", "unavailable");
      }
      const bytes = await loadStorage(document.filePath, null, budget);
      const presented = context.fileNameOverrides?.get(source.id) ?? document.name;
      const extension = extname(presented) ? "" : extname(document.filePath);
      const originalName = `${presented}${extension}`;
      loaded.push({ bytes, entry: { source, originalName, mimeType: mimeFor(originalName), size: bytes.length, sha256: sha256(bytes), storagePath: document.filePath } });
    } else {
      const original = await loadEmailOriginal(source.messageId, source.partId, context.client.id, budget);
      loaded.push({ bytes: original.bytes, entry: { source, originalName: original.fileName, mimeType: original.mimeType, size: original.bytes.length, sha256: sha256(original.bytes) } });
    }
  }
  const names = disambiguateFileNames(loaded.map((item) => item.entry.originalName));
  return loaded.map((item, index) => {
    const { originalName: _originalName, ...entry } = item.entry;
    return { bytes: item.bytes, entry: { ...entry, fileName: names[index] } };
  });
}

/**
 * Reloads the reviewed sources and requires identical bytes/paths. Any change fails before
 * Gmail: never substitute a newer version or omit a file.
 */
export async function loadReviewedAttachments(manifest: AttachmentManifestEntry[], draft: EmailDraftSeed, context: AttachmentContext): Promise<LoadedAttachment[]> {
  const current = await resolveEmailAttachments(draft, context);
  if (current.length !== manifest.length) throw new EmailAttachmentError("The selected attachments changed. Review a new draft.", "unavailable");
  return manifest.map((entry, index) => {
    const now = current[index];
    // Persisted jsonb reorders object keys, so compare the source identity, never serialized text.
    const same = sourceKey(now.entry.source) === sourceKey(entry.source) && now.entry.sha256 === entry.sha256
      && now.entry.size === entry.size && now.entry.fileName === entry.fileName && (now.entry.storagePath ?? null) === (entry.storagePath ?? null)
      && (now.entry.libraryVersionLabel ?? null) === (entry.libraryVersionLabel ?? null);
    if (!same) throw new EmailAttachmentError("An attachment changed after review. Review a new draft before sending.", "unavailable");
    return { entry, bytes: now.bytes };
  });
}
