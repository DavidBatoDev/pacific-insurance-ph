import { describe, expect, it } from "vitest";

import { buildSubmissionEmail, defaultSubmissionContact, zipEntryNames, type SubmissionItem } from "./submission-email";

const item = (over: Partial<SubmissionItem>): SubmissionItem => ({
  requirementId: "r1", documentName: "Application form", appliesTo: null, status: "Verified",
  isRequired: true, documents: [], ...over,
});

describe("buildSubmissionEmail", () => {
  it("lists required items and optional items that have a file, flagging missing files", () => {
    const { subject, body } = buildSubmissionEmail({
      kind: "application", clientName: "Ana Cruz", subjectDetail: "Health Flex", referenceNo: "APP-2026-00001",
      senderName: "Eman",
      items: [
        item({ documents: [{ id: "d1", name: "form.pdf" }] }),
        item({ requirementId: "r2", documentName: "Valid ID", appliesTo: "Ana Cruz" }),
        item({ requirementId: "r3", documentName: "Medical exam", isRequired: false }),
      ],
    });
    expect(subject).toBe("New application — Ana Cruz — Health Flex");
    expect(body).toContain("1. Application form\n2. Valid ID — Ana Cruz (to follow)");
    expect(body).not.toContain("Medical exam");
    expect(body).toContain("APP-2026-00001");
  });

  it("words claims for the Claims team", () => {
    const { subject, body } = buildSubmissionEmail({
      kind: "claim", clientName: "Ana Cruz", subjectDetail: "OP", referenceNo: "CLM-2026-00001", senderName: "Eman", items: [],
    });
    expect(subject).toBe("Claim submission — Ana Cruz — CLM-2026-00001 — OP");
    expect(body.startsWith("Hi Claims team,")).toBe(true);
  });
});

describe("defaultSubmissionContact", () => {
  it("prefers the shared inbox", () => {
    const contacts = [
      { id: "a", name: "Glynne", email: "glynne@pacificcross.com.ph", department: "New Business" },
      { id: "b", name: "PC Sales Support", email: "newbiz@pacificcross.com.ph", department: "New Business" },
    ];
    expect(defaultSubmissionContact("application", contacts)?.id).toBe("b");
    expect(defaultSubmissionContact("claim", contacts)?.id).toBe("a");
  });
});

describe("zipEntryNames", () => {
  it("numbers entries by checklist position, sanitises and de-duplicates names", () => {
    const entries = zipEntryNames([
      item({ documentName: "ID / Passport", documents: [{ id: "d1", name: "scan.pdf" }, { id: "d2", name: "scan.pdf" }] }),
      item({ requirementId: "r2", documentName: "Optional", isRequired: false }),
      item({ requirementId: "r3", documentName: "Receipt", documents: [{ id: "d3", name: "a:b.png" }] }),
    ]);
    expect(entries.map((entry) => entry.entry)).toEqual([
      "01 - ID Passport - scan.pdf",
      "01 - ID Passport - scan (2).pdf",
      "02 - Receipt - a b.png",
    ]);
  });
});
