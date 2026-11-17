import type { LibraryDocument } from "@/lib/repositories/document-library";

export type TravelPackReferenceKey = "emergency-numbers" | "covid-coverage" | "notification-of-claim";

export interface TravelPackReferenceSlot {
  key: TravelPackReferenceKey;
  label: string;
}

export interface ResolvedTravelPackReference extends TravelPackReferenceSlot {
  documents: LibraryDocument[];
}

export const TRAVEL_PACK_REFERENCE_SLOTS: readonly TravelPackReferenceSlot[] = [
  { key: "emergency-numbers", label: "Travel emergency numbers" },
  { key: "covid-coverage", label: "COVID-19 coverage" },
  { key: "notification-of-claim", label: "TravelSafe Notification of Claim" },
];

function isEligibleTravelReference(document: LibraryDocument, onDate: string) {
  return document.productName === "TravelSafe"
    && document.status === "Active"
    && document.approvalStatus === "Approved"
    && document.ageBand === "All Ages"
    && document.filePath !== null
    && (document.effectiveDate === null || document.effectiveDate <= onDate)
    && (document.expiryDate === null || document.expiryDate >= onDate);
}

function belongsInSlot(document: LibraryDocument, key: TravelPackReferenceKey) {
  if (key === "emergency-numbers")
    return document.documentType === "Reference Document" && document.variant === "Travel pack: emergency-numbers";
  if (key === "covid-coverage")
    return document.documentType === "Reference Document" && document.variant === "Travel pack: covid-coverage";
  return document.documentType === "Claim Form" && document.documentName === "TravelSafe Notification of Claim";
}

function compareVersions(a: LibraryDocument, b: LibraryDocument) {
  if (a.effectiveDate !== b.effectiveDate) {
    if (a.effectiveDate === null) return 1;
    if (b.effectiveDate === null) return -1;
    return b.effectiveDate.localeCompare(a.effectiveDate);
  }
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

export function resolveTravelPackReferences(
  documents: readonly LibraryDocument[],
  onDate: string,
): ResolvedTravelPackReference[] {
  return TRAVEL_PACK_REFERENCE_SLOTS.map((slot) => ({
    ...slot,
    documents: documents
      .filter((document) => isEligibleTravelReference(document, onDate) && belongsInSlot(document, slot.key))
      .sort(compareVersions),
  }));
}

function normalizedFileName(fileName: string) {
  return ` ${fileName.toLowerCase().replace(/\.[a-z0-9]{1,8}$/, "").replace(/[^a-z0-9]+/g, " ").trim()} `;
}

const SLOT_PATTERNS: Record<TravelPackReferenceKey, (name: string) => boolean> = {
  // Pacific Cross ships this as "Travel Insurance Complete Numbers.pdf" (no "emergency"), so the
  // carrier's wording counts too, but only with Travel context.
  "emergency-numbers": (name) => (/ emergency /.test(name) && / (number|numbers|hotline|hotlines|contact|contacts|assistance) /.test(name))
    || (/ complete (number|numbers) /.test(name) && / (travel|travelsafe) /.test(name)),
  // A COVID recovery or medical questionnaire is client health information, not Travel coverage.
  "covid-coverage": (name) => / (covid|covid 19|covid19|coronavirus) /.test(name)
    && / (coverage|benefit|benefits|cover|endorsement|rider) /.test(name)
    && !/ (questionnaire|recovery|vaccine|vaccination|vaccinated|test|result|results|medical|declaration) /.test(name),
  // Pacific Cross also has a medical NOC; require Travel context.
  "notification-of-claim": (name) => (/ noc /.test(name) || / notification of claim /.test(name))
    && / (travel|travelsafe) /.test(name)
    && !/ application /.test(name),
};

/**
 * Suggests a reference category from an attachment's file name. A suggestion is not a saved link
 * and says nothing about the file's contents; ambiguous names produce no suggestion.
 */
export function suggestTravelReferenceSlot(fileName: string): TravelPackReferenceKey | null {
  const name = normalizedFileName(fileName);
  const matches = TRAVEL_PACK_REFERENCE_SLOTS.filter((slot) => SLOT_PATTERNS[slot.key](name));
  return matches.length === 1 ? matches[0].key : null;
}
