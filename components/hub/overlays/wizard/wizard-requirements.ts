import type { NewApplicationRequirement } from "@/lib/repositories/application-requirements";
import { requirementSection } from "@/lib/applications/requirement-sections";
import {
  ageFromDob, beneficiaryIdDocumentFor, isFlexiShieldProduct, medicalRequirementDocumentsFor,
  type ChecklistItem, type WizardForm,
} from "./wizard-data";

export type WizardRequirement = Omit<NewApplicationRequirement, "applicationId"> & { key: string };

/** These keys travel with the person across edits/reordering and the server response. */
export function withRequirementPersonKeys(form: WizardForm): WizardForm {
  return {
    ...form,
    healthDependents: form.healthDependents.every((person) => person.requirementPersonKey)
      ? form.healthDependents
      : form.healthDependents.map((person) => person.requirementPersonKey ? person : { ...person, requirementPersonKey: crypto.randomUUID() }),
    travelers: form.travelers.every((person) => person.requirementPersonKey)
      ? form.travelers
      : form.travelers.map((person) => person.requirementPersonKey ? person : { ...person, requirementPersonKey: crypto.randomUUID() }),
  };
}

function personKey(value: string | undefined): string {
  if (!value) throw new Error("Reopen the wizard to refresh the requirement identities before creating this record.");
  return value;
}

export function healthWizardRequirements(form: WizardForm): WizardRequirement[] {
  const principal = form.displayName || [form.firstName, form.lastName].filter(Boolean).join(" ") || "Principal applicant";
  const people = [
    { key: "principal", name: principal, dob: form.dob, preExisting: form.preExisting, smokerStatus: form.smokerStatus, heightInches: form.heightInches, weightLbs: form.weightLbs, beneficiaryName: form.beneficiaryName },
    ...form.healthDependents.filter((person) => person.name.trim()).map((person) => ({ ...person, key: personKey(person.requirementPersonKey) })),
  ];
  const items: WizardRequirement[] = people.flatMap((person, index) => {
    const senior = Number(ageFromDob(person.dob)) >= 71;
    const prefix = `health:${person.key}`;
    const result: WizardRequirement[] = [
      { key: `${prefix}:form:${senior ? "senior" : "regular"}`, documentName: senior ? "Completed age 71–100 application form" : "Completed regular application form", appliesTo: person.name, isRequired: true, sortOrder: index * 100 + 10 },
      { key: `${prefix}:id`, documentName: "Valid government-issued ID", appliesTo: person.name, isRequired: true, sortOrder: index * 100 + 20 },
    ];
    const beneficiary = beneficiaryIdDocumentFor(person.beneficiaryName);
    if (beneficiary) result.push({ key: `${prefix}:beneficiary-id`, documentName: beneficiary, appliesTo: person.name, isRequired: true, sortOrder: index * 100 + 25 });
    if (!form.remoteSale) result.push({ key: `${prefix}:attestation`, documentName: "Attestation letter with specimen signatures", appliesTo: person.name, isRequired: true, sortOrder: index * 100 + 30 });
    medicalRequirementDocumentsFor(person).forEach((document, offset) => result.push({ key: `${prefix}:${document.key}`, documentName: document.name, appliesTo: person.name, isRequired: true, sortOrder: index * 100 + 40 + offset }));
    return result;
  });
  if (form.remoteSale) items.push({ key: "health:declaration", documentName: "Advisor's Declaration", appliesTo: "Remote or online sale", isRequired: true, sortOrder: 900 });
  if (isFlexiShieldProduct(form.productName)) items.push(
    { key: "health:first-layer-benefits", documentName: "Schedule of Benefits of the first-layer HMO", appliesTo: "Supplied by the client — issued by the first-layer HMO", isRequired: true, sortOrder: 920 },
    { key: "health:first-layer-coverage", documentName: "Certificate of Coverage of the first-layer HMO (full maximum benefit limit and expiry date)", appliesTo: "Supplied by the client — issued by the first-layer HMO", isRequired: true, sortOrder: 930 },
  );
  else items.push(
    { key: "health:tal", documentName: "Treatment Area Limitation (TAL) conforme", appliesTo: "Only when requested after underwriting", isRequired: false, sortOrder: 920 },
    { key: "health:cac", documentName: "Client Application for Coverage (CAC)", appliesTo: "Only when requested after underwriting", isRequired: false, sortOrder: 930 },
  );
  return items.map((item) => ({
    ...item,
    section: item.key.endsWith(":id") || item.key.endsWith(":beneficiary-id") || item.key.endsWith(":attestation") || item.key === "health:declaration"
      ? "Basic intake" as const
      : item.key.includes(":form:") || item.key.startsWith("health:first-layer-") || item.key === "health:tal" || item.key === "health:cac"
        ? "Application documents" as const : "Medical requirements" as const,
  }));
}

export function travelWizardRequirements(form: WizardForm): WizardRequirement[] {
  const travelers = form.travelers.filter((person) => person.name.trim());
  return [
    { key: "travel:form", documentName: "Completed Travel application form", appliesTo: travelers.map((person) => person.name).join(", "), isRequired: true, sortOrder: 10 },
    ...travelers.map((person, index) => ({ key: `travel:${personKey(person.requirementPersonKey)}:id`, documentName: person.idType === "Government-issued ID" ? "Valid government-issued ID" : "Passport copy", appliesTo: person.name, isRequired: true, sortOrder: 20 + index * 10 })),
    { key: "travel:payment", documentName: "Payment proof", appliesTo: "Client collection", isRequired: true, sortOrder: 500 },
    { key: "travel:policy", documentName: "Issued Travel policy", appliesTo: "After portal issuance", isRequired: false, sortOrder: 510 },
  ];
}

export function wizardRequirementPreview(items: WizardRequirement[]): ChecklistItem[] {
  return items.map((item) => ({
    requirementKey: item.key,
    documentName: item.documentName,
    section: requirementSection(item),
    name: `${item.documentName}${item.appliesTo ? ` — ${item.appliesTo}` : ""}`,
    cond: item.isRequired === false ? "not required yet" : null,
    checked: false,
    status: "Pending",
    isRequired: item.isRequired,
    phase: item.phase ?? undefined,
  }));
}

/** The save repository returns nonblank dependents in input order. Never associate by name. */
export function persistedDependentSubjects(form: WizardForm, saved: { id: string }[]): Record<string, string> {
  const people = form.healthDependents.filter((person) => person.name.trim());
  if (saved.length !== people.length || new Set(saved.map((person) => person.id)).size !== people.length) {
    throw new Error("Dependent identities could not be associated with the saved application. Reload before completing it.");
  }
  const pairs = people.map((person, index) => [personKey(person.requirementPersonKey), `dependent:${saved[index].id}`] as const);
  if (new Set(pairs.map(([key]) => key)).size !== people.length) throw new Error("Dependent requirement identities are duplicated. Reopen the wizard.");
  return Object.fromEntries(pairs);
}

export function questionnaireSubject(requirement: WizardRequirement, dependentSubjects: Record<string, string>): string | null {
  if (!requirement.key.endsWith(":medical-questionnaire")) return null;
  const key = requirement.key.slice("health:".length, -":medical-questionnaire".length);
  if (key === "principal") return "principal";
  const subject = dependentSubjects[key];
  if (!subject) throw new Error("The medical questionnaire has no saved dependent identity. Reload before completing the application.");
  return subject;
}

/** Selection scope, not document matching: changing anyone's identity invalidates staged bytes. */
export function requirementSelectionScope(form: WizardForm): string {
  return JSON.stringify([
    form.draftApplicationId, form.clientMode, form.existingClientId, form.convertClientId, form.appType, form.category, form.productVersionId,
    form.firstName, form.lastName, form.displayName, form.dob, form.companyName, form.companyContact,
    form.beneficiaryName, form.beneficiaryBirthDate,
    form.remoteSale, form.preExisting, form.smokerStatus, form.heightInches, form.weightLbs,
    form.members,
    form.healthDependents.map((person) => [person.requirementPersonKey, person.name, person.dob, person.beneficiaryName, person.beneficiaryBirthDate, person.preExisting, person.smokerStatus, person.heightInches, person.weightLbs]),
    form.travelers.map((person) => [person.requirementPersonKey, person.name, person.dob, person.idType, person.idNumber]),
    form.destination, form.departure, form.returnDate,
  ]);
}
