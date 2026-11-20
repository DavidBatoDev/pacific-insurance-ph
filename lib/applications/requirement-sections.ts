export const REQUIREMENT_SECTIONS = ["Basic intake", "Application documents", "Medical requirements"] as const;
export type RequirementSection = typeof REQUIREMENT_SECTIONS[number];

const BASIC_NAMES: Record<string, true> = {
  "Valid government-issued ID": true, "Attestation letter with specimen signatures": true, "Advisor's Declaration": true,
  "Advisor declaration / remote-selling confirmation": true,
  "Corporate Secretary's Attestation Form + valid ID": true,
  "Authorized Representative's Attestation Form + valid ID": true,
};
const QUESTIONNAIRE_NAMES: Record<string, true> = {
  "Medical questionnaire or supporting records": true, "Medical questionnaire or supporting medical records": true,
};
const MEDICAL_NAMES: Record<string, true> = {
  ...QUESTIONNAIRE_NAMES,
  "Senior medical examination / physician statement": true,
  "Chest X-ray taken within the last 6 months": true,
  "Lipid Profile, HbA1c, Creatinine, BUN, Uric Acid, SGOT, SGPT and GGT": true,
  "ECG": true, "TMST (treadmill stress test)": true,
};

export const isMedicalQuestionnaireName = (name: string): boolean => Object.hasOwn(QUESTIONNAIRE_NAMES, name);

/** Legacy display fallback only. A label never establishes a medical-review subject or obligation. */
export function requirementSection(item: { section?: RequirementSection | null; documentName: string }): RequirementSection {
  if (item.section) return item.section;
  if (Object.hasOwn(BASIC_NAMES, item.documentName) || item.documentName.startsWith("Valid government-issued ID — beneficiary ")) return "Basic intake";
  if (Object.hasOwn(MEDICAL_NAMES, item.documentName)) return "Medical requirements";
  return "Application documents";
}

const BENEFICIARY_ID = /^(.+) — beneficiary (.+)$/;

/**
 * Display split of a requirement row: the document, then whose it is. The stored name of a
 * beneficiary's ID ("Valid government-issued ID — beneficiary X", with the applicant in
 * `appliesTo`) reads as two owners inline, so the beneficiary moves into the owner line.
 */
export function requirementLabel(item: { documentName: string; appliesTo?: string | null }): { title: string; owner: string | null } {
  const beneficiary = BENEFICIARY_ID.exec(item.documentName);
  if (beneficiary) {
    return { title: beneficiary[1], owner: `Beneficiary: ${beneficiary[2]}${item.appliesTo ? ` · named by ${item.appliesTo}` : ""}` };
  }
  return { title: item.documentName, owner: item.appliesTo || null };
}

/** One-line form of `requirementLabel` for pickers, options and upload labels. */
export function requirementLabelText(item: { documentName: string; appliesTo?: string | null }): string {
  const { title, owner } = requirementLabel(item);
  return owner ? `${title} · ${owner}` : title;
}

/** Group inside an existing phase; retain each row and its stable order within its section. */
export function groupRequirementSections<T>(items: readonly T[], classify: (item: T) => RequirementSection) {
  return REQUIREMENT_SECTIONS.map((section) => ({ section, items: items.filter((item) => classify(item) === section) }))
    .filter((group) => group.items.length > 0);
}
