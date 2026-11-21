import type { DocumentRecord } from "@/lib/repositories/documents";
import type { TravelRequirementRecord } from "@/lib/repositories/carrier-workflows";

/**
 * Stored name of the Travel checklist row for the client's payment (wizard key `travel:payment`).
 * It records client → agency proof only; the TravelSafe portal purchase is tracked separately.
 */
export const TRAVEL_PAYMENT_PROOF_REQUIREMENT = "Payment proof";

export const TRAVEL_PAYMENT_PROOF_ERROR = "Choose client payment proof for this Travel request.";

/** Ids of this trip's exact `Payment proof` checklist rows. */
export function travelPaymentProofRequirementIds(requirements: Pick<TravelRequirementRecord, "id" | "documentName">[]): Set<string> {
  return new Set(requirements.filter((item) => item.documentName === TRAVEL_PAYMENT_PROOF_REQUIREMENT).map((item) => item.id));
}

/** Filed originals attached to the trip's `Payment proof` row, newest first; offered for explicit reuse. */
export function travelClientProofDocuments(
  documents: DocumentRecord[],
  requirements: Pick<TravelRequirementRecord, "id" | "documentName">[],
): DocumentRecord[] {
  const ids = travelPaymentProofRequirementIds(requirements);
  return documents
    .filter((document) => document.status !== "Archived" && !!document.filePath && !!document.travelRequirementId && ids.has(document.travelRequirementId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}
