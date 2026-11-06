import { describe, expect, it } from "vitest";
import { emptyHealthDependent, emptyWizardForm, INQUIRY_APP_TYPE, type WizardTraveler } from "./wizard-data";
import { healthWizardRequirements, requirementSelectionScope, travelWizardRequirements, withRequirementPersonKeys } from "./wizard-requirements";

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
