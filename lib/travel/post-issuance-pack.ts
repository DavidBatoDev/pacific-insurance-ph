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
