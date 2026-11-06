import { describe, expect, it } from "vitest";
import { emptyHealthDependent, emptyWizardForm, INQUIRY_APP_TYPE, type WizardTraveler } from "./wizard-data";
import { healthWizardRequirements, persistedDependentSubjects, questionnaireSubject, requirementSelectionScope, travelWizardRequirements, withRequirementPersonKeys, wizardRequirementPreview } from "./wizard-requirements";

const traveler = (key: string, name: string, idType: string): WizardTraveler => ({
  requirementPersonKey: key, name, dob: "1990-01-01", nationality: "Filipino", gender: "Male", contact: "",
  idType, idNumber: key, planOptionId: "", beneficiaryName: "", beneficiaryDob: "", beneficiaryRelationship: "", beneficiaryContact: "",
});

describe("creation attachment requirement identities", () => {
  it("keeps a dependent's requirement identity when equal-name people are reordered or removed", () => {
    const first = { ...emptyHealthDependent(), requirementPersonKey: "first", name: "Same Name", dob: "1990-01-01", beneficiaryName: "First beneficiary" };
    const second = { ...emptyHealthDependent(), requirementPersonKey: "second", name: "Same Name", dob: "1995-01-01", beneficiaryName: "Second beneficiary" };
    const form = { ...emptyWizardForm(), healthDependents: [first, second] };
    const key = healthWizardRequirements(form).find((row) => row.documentName.includes("Second beneficiary"))!.key;
    const reordered = healthWizardRequirements({ ...form, healthDependents: [second, first] });
    const retained = healthWizardRequirements({ ...form, healthDependents: [second] });
    expect(reordered.find((row) => row.documentName.includes("Second beneficiary"))!.key).toBe(key);
    expect(retained.find((row) => row.documentName.includes("Second beneficiary"))!.key).toBe(key);
    expect(retained.some((row) => row.documentName.includes("First beneficiary"))).toBe(false);
  });

  it("keeps traveler attachments on the right person rather than their list position", () => {
    const first = traveler("first", "Same Name", "Passport");
    const second = traveler("second", "Same Name", "Government-issued ID");
    const form = { ...emptyWizardForm(), travelers: [first, second] };
    const key = travelWizardRequirements(form).find((row) => row.documentName === "Passport copy")!.key;
    const reordered = travelWizardRequirements({ ...form, travelers: [second, first] });
    expect(reordered.find((row) => row.documentName === "Passport copy")!.key).toBe(key);
    const retained = travelWizardRequirements({ ...form, travelers: [first] });
    expect(retained.find((row) => row.documentName === "Passport copy")!.key).toBe(key);
  });

  it("retains assigned person identities when normalizing an edited or resumed form", () => {
    const form = withRequirementPersonKeys({ ...emptyWizardForm(), healthDependents: [{ ...emptyHealthDependent(), name: "Dependent" }] });
    const key = form.healthDependents[0].requirementPersonKey;
    const edited = withRequirementPersonKeys({ ...form, healthDependents: [{ ...form.healthDependents[0], name: "Corrected name" }] });
    expect(edited.healthDependents[0].requirementPersonKey).toBe(key);
    expect(healthWizardRequirements(edited).filter((row) => row.appliesTo === "Corrected name").map((row) => row.key)).toEqual(
      healthWizardRequirements(form).filter((row) => row.appliesTo === "Dependent").map((row) => row.key),
    );
  });

  it("invalidates staged selections for client/trip/person changes but not email composition", () => {
    const form = { ...emptyWizardForm(), existingClientId: "client-a", travelers: [traveler("first", "Traveler", "Passport")] };
    const scope = requirementSelectionScope(form);
    expect(requirementSelectionScope({ ...form, emailBody: "Changed email text" })).toBe(scope);
    expect(requirementSelectionScope({ ...form, existingClientId: "client-b" })).not.toBe(scope);
    expect(requirementSelectionScope({ ...form, appType: INQUIRY_APP_TYPE })).not.toBe(scope);
    expect(requirementSelectionScope({ ...form, departure: "2030-01-01" })).not.toBe(scope);
    expect(requirementSelectionScope({ ...form, travelers: [{ ...form.travelers[0], idNumber: "new passport" }] })).not.toBe(scope);
  });

  it("retains staged originals and requirement identities when only the Select variant/plan changes", () => {
    const form = { ...emptyWizardForm(), category: "health" as const, productName: "Select", productVersionId: "select-version", selectVariant: "Select Plus" as const, planOptionId: "plus-private-5m" };
    const changed = { ...form, selectVariant: "Select Standard" as const, planOptionId: "standard-ward" };
    expect(requirementSelectionScope(changed)).toBe(requirementSelectionScope(form));
    expect(healthWizardRequirements(changed).map((row) => row.key)).toEqual(healthWizardRequirements(form).map((row) => row.key));
  });

  it("invalidates a staged company document when the enrollment roster changes", () => {
    const member = { ...emptyHealthDependent(), name: "Member", dob: "1990-01-01" };
    const form = { ...emptyWizardForm(), category: "hmo" as const, members: [member] };
    expect(requirementSelectionScope({ ...form, members: [{ ...member, beneficiaryName: "New beneficiary" }] })).not.toBe(requirementSelectionScope(form));
    expect(requirementSelectionScope({ ...form, members: [member, { ...member, name: "Additional member" }] })).not.toBe(requirementSelectionScope(form));
  });
});

describe("health requirement sections and medical identities", () => {
  it("gives a senior Yes both examination and questionnaire while deduplicating smoker/obesity X-ray", () => {
    const form = { ...emptyWizardForm(), category: "health" as const, productName: "Blue Royale", dob: "1940-01-01", preExisting: "Yes", smokerStatus: "Current", heightInches: "65", weightLbs: "165" };
    const rows = healthWizardRequirements(form);
    expect(rows.filter((row) => row.key.endsWith(":senior-medical"))).toHaveLength(1);
    expect(rows.filter((row) => row.key.endsWith(":medical-questionnaire"))).toHaveLength(1);
    expect(rows.filter((row) => row.key.endsWith(":chest-xray"))).toHaveLength(1);
    expect(rows.find((row) => row.key.endsWith(":form:senior"))?.section).toBe("Application documents");
    expect(rows.find((row) => row.key.endsWith(":id"))?.section).toBe("Basic intake");
    expect(rows.find((row) => row.key.endsWith(":medical-questionnaire"))?.section).toBe("Medical requirements");
  });

  it("uses distinct persisted UUIDs for equal-name Yes dependents, never display names", () => {
    const first = { ...emptyHealthDependent(), requirementPersonKey: "first-key", name: "Same Name", preExisting: "Yes" };
    const second = { ...emptyHealthDependent(), requirementPersonKey: "second-key", name: "Same Name", preExisting: "Yes" };
    const form = { ...emptyWizardForm(), preExisting: "Yes", healthDependents: [first, { ...emptyHealthDependent(), name: "" }, second] };
    const subjects = persistedDependentSubjects(form, [{ id: "uuid-first" }, { id: "uuid-second" }]);
    const questionnaireRows = healthWizardRequirements(form).filter((row) => row.key.endsWith(":medical-questionnaire"));
    expect(questionnaireRows.map((row) => questionnaireSubject(row, subjects))).toEqual(["principal", "dependent:uuid-first", "dependent:uuid-second"]);
    expect(questionnaireRows.map((row) => row.key)).toEqual(["health:principal:medical-questionnaire", "health:first-key:medical-questionnaire", "health:second-key:medical-questionnaire"]);
    expect(() => persistedDependentSubjects(form, [{ id: "only-one" }])).toThrow(/identities/);
    expect(() => persistedDependentSubjects(form, [{ id: "same" }, { id: "same" }])).toThrow(/identities/);
    expect(() => questionnaireSubject(questionnaireRows[1], {})).toThrow(/saved dependent identity/);
  });

  it("keeps preview labels, sections, phases and optionality identical to the shared snapshot builder", () => {
    const rows = healthWizardRequirements({ ...emptyWizardForm(), productName: "Select", preExisting: "Yes", beneficiaryName: "Beneficiary" });
    const preview = wizardRequirementPreview(rows);
    rows.forEach((row, index) => {
      expect(preview[index]).toMatchObject({ requirementKey: row.key, documentName: row.documentName, section: row.section, isRequired: row.isRequired });
      expect(preview[index].phase).toBe(row.phase ?? undefined);
    });
    expect(rows.filter((row) => row.key === "health:tal" || row.key === "health:cac").every((row) => row.isRequired === false && row.section === "Application documents")).toBe(true);
  });

  it("preserves selling-channel alternatives and FlexiShield first-layer rules across product switches/resume", () => {
    const form = { ...emptyWizardForm(), productName: "FlexiShield", remoteSale: true, beneficiaryName: "Principal beneficiary" };
    const flexi = healthWizardRequirements(form);
    expect(flexi.filter((row) => row.key.startsWith("health:first-layer-"))).toHaveLength(2);
    expect(flexi.some((row) => row.key === "health:tal" || row.key === "health:cac")).toBe(false);
    expect(flexi.some((row) => row.key.endsWith(":attestation"))).toBe(false);
    expect(flexi.find((row) => row.key === "health:declaration")?.section).toBe("Basic intake");
    for (const productName of ["Select", "Blue Royale"]) {
      const changed = { ...form, productName, category: "health" as const, checklist: [{ name: "PIS — Proposal Information Sheet", cond: null, checked: false, status: "Pending", phase: "For proposal" as const }] };
      const rows = healthWizardRequirements(changed);
      expect(rows.some((row) => row.phase || row.documentName.includes("Proposal Information Sheet") || row.key.startsWith("health:first-layer-"))).toBe(false);
      expect(rows.filter((row) => row.key === "health:tal" || row.key === "health:cac")).toHaveLength(2);
      const resumed = healthWizardRequirements(JSON.parse(JSON.stringify(changed)));
      expect(resumed).toEqual(rows);
    }
    const faceToFace = healthWizardRequirements({ ...form, remoteSale: false });
    expect(faceToFace.some((row) => row.key === "health:declaration")).toBe(false);
    expect(faceToFace.some((row) => row.key.endsWith(":attestation"))).toBe(true);
  });
});
