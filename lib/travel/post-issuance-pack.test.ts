import { describe, expect, it } from "vitest";

import type { LibraryDocument } from "@/lib/repositories/document-library";
import { resolveTravelPackReferences } from "./post-issuance-pack";

const TODAY = "2026-10-13";

function libraryDocument(overrides: Partial<LibraryDocument> = {}): LibraryDocument {
  return {
    id: "document-1",
    productVersionId: "version-1",
    productName: "TravelSafe",
    productVersionName: "2026-02",
    documentName: "TravelSafe Notification of Claim",
    documentType: "Claim Form",
    versionLabel: "2026-02",
    variant: null,
    ageBand: "All Ages",
    filePath: "library/travel-notification-of-claim.pdf",
    previewPath: null,
    originalFileName: "travel-notification-of-claim.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 100,
    effectiveDate: null,
    expiryDate: null,
    status: "Active",
    approvalStatus: "Approved",
    notes: null,
    distributionNotes: null,
    uploadedBy: null,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveTravelPackReferences", () => {
  it("keeps the known Notification of Claim while unrelated Travel assets leave their slots empty", () => {
    const references = resolveTravelPackReferences([
      libraryDocument(),
      libraryDocument({ id: "loading", documentName: "Geographical Loading", documentType: "Reference Document", variant: null }),
      libraryDocument({ id: "covid-questionnaire", documentName: "COVID recovery questionnaire", documentType: "Medical Questionnaire" }),
      libraryDocument({ id: "blank-application", documentName: "Travel application form", documentType: "Application Form" }),
    ], TODAY);

    expect(references.map(({ key, documents }) => [key, documents.map(({ id }) => id)])).toEqual([
      ["emergency-numbers", []],
      ["covid-coverage", []],
      ["notification-of-claim", ["document-1"]],
    ]);
  });

  it("retains the three empty slots for an empty library", () => {
    expect(resolveTravelPackReferences([], TODAY).map(({ key, label, documents }) => ({ key, label, documents }))).toEqual([
      { key: "emergency-numbers", label: "Travel emergency numbers", documents: [] },
      { key: "covid-coverage", label: "COVID-19 coverage", documents: [] },
      { key: "notification-of-claim", label: "TravelSafe Notification of Claim", documents: [] },
    ]);
  });

  it("excludes wrong product, pending, archived, missing-path, and out-of-window documents", () => {
    const rejected = [
      { id: "wrong-product", productName: "Blue Royale" },
      { id: "pending", approvalStatus: "Pending Approval" },
      { id: "archived", status: "Inactive" },
      { id: "missing-path", filePath: null },
      { id: "not-effective", effectiveDate: "2026-10-14" },
      { id: "expired", expiryDate: "2026-10-12" },
    ].map((overrides) => libraryDocument({
      documentType: "Reference Document",
      variant: "Travel pack: emergency-numbers",
      ...overrides,
    }));

    expect(resolveTravelPackReferences(rejected, TODAY)[0].documents).toEqual([]);
  });

  it("requires the exact reference type, slot marker and all-ages scope for both missing assets", () => {
    const references = resolveTravelPackReferences([
      libraryDocument({ id: "emergency", documentType: "Reference Document", variant: "Travel pack: emergency-numbers" }),
      libraryDocument({ id: "covid", documentType: "Reference Document", variant: "Travel pack: covid-coverage" }),
      libraryDocument({ id: "wrong-marker", documentName: "Travel emergency numbers", documentType: "Reference Document", variant: "emergency-numbers" }),
      libraryDocument({ id: "wrong-type", documentType: "Application Form", variant: "Travel pack: covid-coverage" }),
      libraryDocument({ id: "wrong-age", documentType: "Reference Document", variant: "Travel pack: covid-coverage", ageBand: "18–65" }),
      libraryDocument({ id: "mislabelled-questionnaire", documentName: "COVID-19 coverage", documentType: "Medical Questionnaire", variant: "Travel pack: covid-coverage" }),
    ], TODAY);

    expect(references.map(({ documents }) => documents.map(({ id }) => id))).toEqual([
      ["emergency"],
      ["covid"],
      [],
    ]);
  });

  it("includes exact effective and expiry boundaries and keeps matching versions downloadable in deterministic order", () => {
    const references = resolveTravelPackReferences([
      libraryDocument({ id: "null-date", documentType: "Reference Document", variant: "Travel pack: emergency-numbers", effectiveDate: null, createdAt: "2026-01-01T00:00:00.000Z" }),
      libraryDocument({ id: "old", documentType: "Reference Document", variant: "Travel pack: emergency-numbers", effectiveDate: "2026-01-01", createdAt: "2026-10-01T00:00:00.000Z" }),
      libraryDocument({ id: "boundary", documentType: "Reference Document", variant: "Travel pack: emergency-numbers", effectiveDate: TODAY, expiryDate: TODAY, createdAt: "2026-09-01T00:00:00.000Z" }),
      libraryDocument({ id: "same-date-b", documentType: "Reference Document", variant: "Travel pack: emergency-numbers", effectiveDate: TODAY, createdAt: "2026-10-02T00:00:00.000Z" }),
      libraryDocument({ id: "same-date-a", documentType: "Reference Document", variant: "Travel pack: emergency-numbers", effectiveDate: TODAY, createdAt: "2026-10-02T00:00:00.000Z" }),
    ], TODAY);

    expect(references[0].documents.map(({ id }) => id)).toEqual(["same-date-a", "same-date-b", "boundary", "old", "null-date"]);
  });
});
