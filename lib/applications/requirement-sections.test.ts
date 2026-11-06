import { describe, expect, it } from "vitest";
import { groupRequirementSections, isMedicalQuestionnaireName, requirementSection } from "./requirement-sections";

describe("requirement sections", () => {
  it("recognizes only exact known legacy labels and the beneficiary prefix", () => {
    for (const documentName of ["Valid government-issued ID", "Advisor's Declaration", "Advisor declaration / remote-selling confirmation", "Attestation letter with specimen signatures", "Corporate Secretary's Attestation Form + valid ID", "Authorized Representative's Attestation Form + valid ID", "Valid government-issued ID — beneficiary Same Name"]) {
      expect(requirementSection({ documentName })).toBe("Basic intake");
    }
    for (const documentName of ["Senior medical examination / physician statement", "Medical questionnaire or supporting records", "Medical questionnaire or supporting medical records", "Chest X-ray taken within the last 6 months", "Lipid Profile, HbA1c, Creatinine, BUN, Uric Acid, SGOT, SGPT and GGT", "ECG", "TMST (treadmill stress test)"]) {
      expect(requirementSection({ documentName })).toBe("Medical requirements");
    }
    for (const documentName of ["Completed application form", "Custom medical questionnaire", "ECG follow-up", "Beneficiary ID", "toString", "__proto__"]) {
      expect(requirementSection({ documentName })).toBe("Application documents");
      expect(isMedicalQuestionnaireName(documentName)).toBe(false);
    }
  });

  it("honors persisted section without inferring questionnaire evidence", () => {
    expect(requirementSection({ section: "Application documents", documentName: "ECG" })).toBe("Application documents");
    expect(requirementSection({ section: "Medical requirements", documentName: "Custom note" })).toBe("Medical requirements");
    expect(isMedicalQuestionnaireName("Custom note")).toBe(false);
    expect(isMedicalQuestionnaireName("Medical questionnaire or supporting medical records")).toBe(true);
  });

  it("groups within each phase without changing objects, required flags, status, or stable order", () => {
    const proposal = [
      { id: "a", documentName: "Completed application form", phase: "For proposal", isRequired: true, status: "Verified" },
      { id: "b", documentName: "Valid government-issued ID", phase: "For proposal", isRequired: true, status: "Received" },
      { id: "c", documentName: "Custom document", phase: "For proposal", isRequired: false, status: "Pending" },
    ];
    const agreement = [{ id: "d", documentName: "Corporate Secretary's Attestation Form + valid ID", phase: "Once the group agrees", isRequired: false, status: "Pending" }];
    const grouped = groupRequirementSections(proposal, requirementSection);
    expect(grouped.map((group) => group.section)).toEqual(["Basic intake", "Application documents"]);
    expect(grouped[1].items.map((item) => item.id)).toEqual(["a", "c"]);
    expect(grouped[1].items[0]).toBe(proposal[0]);
    expect(proposal[2].isRequired).toBe(false);
    const later = groupRequirementSections(agreement, requirementSection);
    expect(later[0].items[0]).toBe(agreement[0]);
    expect(later[0].items[0].phase).toBe("Once the group agrees");
    expect(later[0].items[0].isRequired).toBe(false);
  });
});
