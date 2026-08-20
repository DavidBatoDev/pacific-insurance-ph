/**
 * New Client Application wizard — shared types, options and checklists
 * (design new-application-data.jsx / web/new-application-wizard.md).
 * Kept as a separate module to preserve the design's 4-file split.
 */

export type WizardCategory = "health" | "hmo" | "travel";

export interface WizardMember {
  id?: string | null;
  name: string;
  dob: string;
  rel: string;
  email: string;
  preExisting?: string;
  medicalNotes?: string;
  /**
   * Underwriting inputs for the conditional medical panels (G3). Optional because group members
   * reuse this shape and are not individually underwritten. Units follow the carrier's own form:
   * height in total inches (its "HEIGHT (ft. & in.)"), weight in pounds.
   */
  smokerStatus?: string;
  heightInches?: string;
  weightLbs?: string;
  /**
   * CET (Corporate Enrollment Template) fields — group members only, optional so
   * health dependents (which reuse this shape) are unaffected. See migration 0030.
   */
  lastName?: string;
  firstName?: string;
  middleInitial?: string;
  gender?: string;
  civilStatus?: string;
  nationality?: string;
  placeOfBirth?: string;
  /** CET coverage effective date. Distinct from the group's shared startDate/joinDate. */
  effectiveDate?: string;
  occupationGrade?: string;
  roomAndBoardPlan?: string;
  maximumBenefitLimit?: string;
  philhealthMember?: string;
  address?: string;
  mobileNumber?: string;
  landlineNumber?: string;
  beneficiaryName?: string;
  beneficiaryBirthDate?: string;
  /**
   * The rest of the beneficiary block (G4). `beneficiaryName`/`beneficiaryBirthDate` above came in
   * with the CET (G7) and are shared: for a *group* member they persist to `group_members`, for a
   * *health dependent* to `application_dependents`. The relationship is to THIS person, not to the
   * principal — the carrier form heads the dependent's block "Relationship to Dependent".
   */
  beneficiaryRelationship?: string;
  beneficiaryContact?: string;
}

export interface WizardTraveler {
  name: string;
  dob: string;
  nationality: string;
  gender: string;
  contact: string;
  idType: string;
  idNumber: string;
  planOptionId: string;
  beneficiaryName: string;
  beneficiaryDob: string;
  beneficiaryRelationship: string;
  beneficiaryContact: string;
}

export interface ChecklistItem {
  name: string;
  cond: string | null;
  checked: boolean;
  status: string;
}

export interface WizardForm {
  schemaVersion: 2;
  /** Application row that owns a saved wizard draft, if this is a resume. */
  draftApplicationId: string | null;
  /** Last active wizard step, persisted with a saved draft. */
  draftStep: number;
  /* Step 1 — workflow & product */
  appType: string;
  source: string;
  category: WizardCategory | "";
  productVersionId: string;
  productName: string;
  planOptionId: string;
  clientMode: "new" | "existing";
  existingClientId: string | null;
  existingClientName: string;
  assignedUserId: string;
  priority: string;
  /* Convert-from-lead hand-off (same record, no duplicate) */
  convertClientId: string | null;
  convertClientName: string | null;
  /* Step 2 — client / company info */
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  mobile: string;
  channels: string[];
  dob: string;
  gender: string;
  civil: string;
  nationality: string;
  address: string;
  occupation: string;
  notes: string;
  companyName: string;
  companyContact: string;
  memberCount: string;
  members: WizardMember[];
  healthDependents: WizardMember[];
  /* Step 3 — product specifics */
  coverage: string;
  startDate: string;
  dependents: string;
  /**
   * "Existing Pacific Cross client?" — about *our* relationship with them. Form-only: there is no
   * column for it and no server code reads it, so it survives only inside a draft's `wizardState`
   * blob. Deliberately NOT the first-layer question below, which is about the *other* insurer.
   */
  existingPC: string;
  preExisting: string;
  medicalNotes: string;
  /**
   * Principal applicant's underwriting inputs. Pacific Cross keys three conditional medical panels
   * off these — see `medicalDocumentsFor`. Dependents carry their own on `WizardMember`.
   */
  smokerStatus: string;
  heightInches: string;
  weightLbs: string;
  /**
   * Principal applicant's nominated beneficiary (G4). Pacific Cross requires a valid ID for the
   * beneficiary as well as the insured, so this is the person that requirement attaches to.
   * Dependents carry their own on `WizardMember` — the carrier form gives each its own block.
   */
  beneficiaryName: string;
  beneficiaryBirthDate: string;
  beneficiaryRelationship: string;
  beneficiaryContact: string;
  remoteSale: boolean;
  /**
   * First-layer coverage — the plan a second-layer product sits on top of. Pacific Cross requires
   * this declared for FlexiShield: name of the existing HMO, type/name of plan, maximum benefit
   * limit, effective and expiry date. The MBL is the figure the whole product turns on, since
   * FlexiShield pays once the first layer is exhausted.
   *
   * Persisted to `external_coverage` (table predates this and was previously unused), not to the
   * application — the cover belongs to the client and outlives any one application. `claims` already
   * reads the same figure as `hmo_mbl_amount`; capturing it here is what stops it being re-keyed at
   * claim time.
   */
  firstLayerType: string;
  firstLayerProvider: string;
  firstLayerPlan: string;
  firstLayerMbl: string;
  firstLayerEffective: string;
  firstLayerExpiry: string;
  payFreq: string;
  premium: string;
  passport: string;
  destination: string;
  departure: string;
  returnDate: string;
  travelPurpose: string;
  itinerary: string;
  applicantIsTraveler: boolean;
  travelers: WizardTraveler[];
  paymentChannelId: string;
  portalPaymentStatus: string;
  portalPaymentReference: string;
  portalPaymentAmount: string;
  portalProcessingStatus: string;
  /* Step 4 — requirements */
  checklist: ChecklistItem[];
  /* Step 5 — communication & follow-up */
  sendEmail: boolean;
  emailTemplate: string;
  emailRecipient: string;
  emailSubject: string;
  emailBody: string;
  /**
   * Carrier-library asset staged for the initial email. Lives on the form rather than in Step 5's
   * own state because Step 5 unmounts whenever the wizard changes step, and because
   * `createFromWizardAction` re-validates it server-side before it logs anything.
   */
  emailLibraryDocumentId: string;
  createTask: boolean;
  followDate: string;
  internalNote: string;
  /* Step 6 — review */
  status: string;
}

export const WIZ_STEPS = [
  { n: 1, label: "Client type & setup", desc: "Workflow & product" },
  { n: 2, label: "Client information", desc: "Profile details" },
  { n: 3, label: "Product details", desc: "Plan-specific" },
  { n: 4, label: "Requirements", desc: "Documents" },
  { n: 5, label: "Communication", desc: "Email & follow-up" },
  { n: 6, label: "Review & create", desc: "Confirm" },
] as const;

/**
 * The application type that keeps a record a Lead.
 *
 * It is not just a label: the wizard derives `status = "Lead"` from it, which the server reads as
 * `startsApplication === false` — so a save with this type creates the application but does not
 * convert. It is the default when starting from a lead, so it is named as a constant rather than
 * repeated as a string across the four places that check for it.
 */
export const INQUIRY_APP_TYPE = "Inquiry Only (Lead)";

/** Pre-rename spelling, still recognised so a draft saved before the rename resumes correctly. */
const LEGACY_INQUIRY_APP_TYPE = "Inquiry / Lead Only";

export const isInquiryAppType = (appType: string | null | undefined): boolean =>
  appType === INQUIRY_APP_TYPE || appType === LEGACY_INQUIRY_APP_TYPE;

/** Map a persisted draft's app type onto the current spelling. */
export const normaliseAppType = (appType: string): string =>
  appType === LEGACY_INQUIRY_APP_TYPE ? INQUIRY_APP_TYPE : appType;

export const WIZ_OPTS = {
  appType: [
    "New Insurance Application",
    "Additional Product (Existing Client)",
    "Renewal Application",
    INQUIRY_APP_TYPE,
  ],
  sources: [
    "Referral",
    "Personal network",
    "Business network",
    "Existing client",
    "Website",
    "Social media",
    "Other",
  ],
  priority: ["Normal", "Urgent", "VIP"],
  channels: ["Email", "WhatsApp", "Viber", "Phone", "iMessage"],
  gender: ["", "Female", "Male", "Prefer not to say"],
  civil: ["", "Single", "Married", "Widowed", "Separated"],
  coverage: ["Individual", "Family"],
  payFreq: ["", "Annual", "Semi-annual", "Deferred Credit Card"],
  relationship: ["Employee", "Principal", "Dependent", "Other"],
  travelPurpose: ["", "Leisure", "Business", "Family visit", "Other"],
  statuses: ["Lead", "Applicant", "Pending Requirements", "Submitted to Pacific Cross", "Awaiting Payment"],
  docStatus: ["Pending", "Received", "Incomplete", "Verified"],
} as const;

/** Auto document checklist by category (design NA_CHECKLISTS). */
export const WIZ_CHECKLISTS: Record<WizardCategory, { name: string; cond: string | null }[]> = {
  health: [
    { name: "Application form", cond: null },
    { name: "Valid ID", cond: null },
    { name: "Attestation letter (3 specimen signatures)", cond: null },
    { name: "Medical records", cond: "if applicable" },
    { name: "Pacific Cross questionnaire", cond: "if applicable" },
    { name: "Proof of payment", cond: "later stage" },
    { name: "Policy documents", cond: "after issuance" },
  ],
  hmo: [
    { name: "Company / group details", cond: null },
    { name: "Member list", cond: null },
    { name: "Member information sheets", cond: null },
    { name: "Application documents", cond: null },
    { name: "Valid IDs", cond: "if needed" },
    { name: "Payment proof", cond: null },
    { name: "Policy documents", cond: "after issuance" },
  ],
  travel: [
    { name: "Application details", cond: null },
    { name: "Passport copy", cond: null },
    { name: "Travel dates confirmation", cond: null },
    { name: "Destination details", cond: null },
    { name: "Payment proof", cond: null },
    { name: "Issued policy", cond: "after issuance" },
  ],
};

/** Product name → wizard category. */
export function categoryForProduct(name: string, productCategory?: string | null): WizardCategory {
  if (productCategory === "Travel Insurance" || /travel/i.test(name)) return "travel";
  if (productCategory === "Group Medical" || /\bhmo\b|\bgroup\b/i.test(name)) return "hmo";
  return "health";
}

/**
 * FlexiShield is a second-layer product (catalog category `Second-Layer Medical`) that correctly
 * shares the "health" wizard category with Select/Blue Royale — same client flow, same Step 3 form
 * — but Pacific Cross requires a different document checklist for it: no TAL/CAC conforme, plus the
 * Schedule of Benefits and Certificate of Coverage of the *first-layer* HMO (G6). Matched by name,
 * the same pattern `matchCarrierForm` already uses for the carrier-form variant
 * (`wizard-actions.ts`), so the requirement builder and the carrier-form lookup never disagree about
 * what counts as FlexiShield.
 */
export const isFlexiShieldProduct = (productName: string): boolean => /flexishield/i.test(productName);

export function emptyWizardForm(): WizardForm {
  return {
    schemaVersion: 2,
    draftApplicationId: null,
    draftStep: 1,
    appType: "",
    source: "",
    category: "",
    productVersionId: "",
    productName: "",
    planOptionId: "",
    clientMode: "new",
    existingClientId: null,
    existingClientName: "",
    assignedUserId: "",
    priority: "Normal",
    convertClientId: null,
    convertClientName: null,
    firstName: "",
    lastName: "",
    displayName: "",
    email: "",
    mobile: "",
    channels: [],
    dob: "",
    gender: "",
    civil: "",
    nationality: "",
    address: "",
    occupation: "",
    notes: "",
    companyName: "",
    companyContact: "",
    memberCount: "",
    members: [
      { name: "", dob: "", rel: "Principal", email: "" },
      { name: "", dob: "", rel: "Employee", email: "" },
      { name: "", dob: "", rel: "Employee", email: "" },
    ],
    healthDependents: [],
    coverage: "",
    startDate: "",
    dependents: "",
    existingPC: "",
    smokerStatus: "",
    heightInches: "",
    weightLbs: "",
    beneficiaryName: "",
    beneficiaryBirthDate: "",
    beneficiaryRelationship: "",
    beneficiaryContact: "",
    firstLayerType: "HMO",
    firstLayerProvider: "",
    firstLayerPlan: "",
    firstLayerMbl: "",
    firstLayerEffective: "",
    firstLayerExpiry: "",
    preExisting: "",
    medicalNotes: "",
    remoteSale: false,
    payFreq: "",
    premium: "",
    passport: "",
    destination: "",
    departure: "",
    returnDate: "",
    travelPurpose: "",
    itinerary: "",
    applicantIsTraveler: true,
    travelers: [],
    paymentChannelId: "",
    portalPaymentStatus: "Not Yet",
    portalPaymentReference: "",
    portalPaymentAmount: "",
    portalProcessingStatus: "Not Started",
    checklist: [],
    sendEmail: false,
    emailTemplate: "",
    emailRecipient: "",
    emailSubject: "",
    emailBody: "",
    emailLibraryDocumentId: "",
    createTask: true,
    followDate: "",
    internalNote: "",
    status: "Applicant",
  };
}

export const SMOKER_STATUSES = ["Never", "Former", "Current"] as const;
export type SmokerStatus = (typeof SMOKER_STATUSES)[number];

/**
 * BMI thresholds driving Pacific Cross's conditional medical panels.
 *
 * **Asia-Pacific cut-offs**, which is what is normally used in the Philippines — NOT the WHO
 * international scale, where the same numbers mean different categories (overweight >= 25, Obese
 * Class I 30–34.9). The difference is not cosmetic: a 5'7" / 165 lb applicant triggers both panels
 * on this scale and neither on WHO's.
 *
 * **The carrier has not confirmed these numbers.** Eman's list names the panels ("BMI:", "Obese
 * Class 1:") but never a cut-off, and nothing in the requirement lists, the application forms or
 * `REQUIREMENTS.md` states one. A confirmation request is open with him. They live here, in one
 * place, precisely so correcting them is a one-line change rather than a hunt.
 */
export const BMI_THRESHOLDS = {
  /** At or above this, the Lipid Profile / HbA1c / Creatinine / BUN / Uric Acid / SGOT / SGPT / GGT panel applies. */
  overweight: 23,
  /** Obese Class 1 band: chest X-ray / ECG / TMST on top. */
  obeseClass1Min: 25,
  obeseClass1Max: 29.9,
} as const;

/** Imperial BMI, from the units the carrier's own application form asks for. */
export function bmiFrom(heightInches: string | number, weightLbs: string | number): number | null {
  const h = typeof heightInches === "number" ? heightInches : parseFloat(heightInches);
  const w = typeof weightLbs === "number" ? weightLbs : parseFloat(weightLbs);
  if (!h || !w || !isFinite(h) || !isFinite(w) || h <= 0 || w <= 0) return null;
  return Math.round(((703 * w) / (h * h)) * 10) / 10;
}

/** The per-person underwriting inputs the conditional medical rules key on. */
export interface MedicalProfileInput {
  dob: string;
  preExisting?: string;
  smokerStatus?: string;
  heightInches?: string | number;
  weightLbs?: string | number;
}

/**
 * The conditional medical documents Pacific Cross requires for one insured person.
 *
 * **Single source of truth for the trigger**, called by both the server-side requirement snapshot
 * (`wizard-actions.ts`) and the wizard's client-side checklist preview (`new-application.tsx`).
 * Those two previously carried separate copies of the age/pre-existing test, which is exactly how
 * they drift once a third condition arrives — and G3 is that third condition.
 *
 * Returns document names in checklist order. Empty when nothing applies.
 */
/** The valid-ID line Pacific Cross wants for a nominated beneficiary, or null when none is named. */
export function beneficiaryIdDocumentFor(beneficiaryName?: string): string | null {
  return beneficiaryName && beneficiaryName.trim()
    ? `Valid government-issued ID — beneficiary ${beneficiaryName.trim()}`
    : null;
}

export function medicalDocumentsFor(person: MedicalProfileInput): string[] {
  const age = ageFromDob(person.dob);
  const senior = typeof age === "number" && age >= 71;
  const bmi = bmiFrom(person.heightInches ?? "", person.weightLbs ?? "");
  const docs: string[] = [];

  if (senior) docs.push("Senior medical examination / physician statement");
  else if (person.preExisting === "Yes") docs.push("Medical questionnaire or supporting records");

  if (person.smokerStatus === "Current") docs.push("Chest X-ray taken within the last 6 months");

  if (bmi != null && bmi >= BMI_THRESHOLDS.overweight) {
    docs.push("Lipid Profile, HbA1c, Creatinine, BUN, Uric Acid, SGOT, SGPT and GGT");
  }
  if (bmi != null && bmi >= BMI_THRESHOLDS.obeseClass1Min && bmi <= BMI_THRESHOLDS.obeseClass1Max) {
    // The carrier lists a chest X-ray here too; a current smoker already has one above, so don't
    // ask the client for the same film twice.
    if (person.smokerStatus !== "Current") docs.push("Chest X-ray taken within the last 6 months");
    docs.push("ECG");
    docs.push("TMST (treadmill stress test)");
  }
  return docs;
}

export function ageFromDob(dob: string): number | "" {
  if (!dob) return "";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? a : "";
}

export function daysBetween(a: string, b: string): number | "" {
  if (!a || !b) return "";
  const diff = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
  return diff >= 0 ? diff : "";
}

/** Numeric parse for currency inputs (strips separators). */
export const parseAmount = (v: string): number | null => {
  const n = Number(v.replace(/[^0-9]/g, ""));
  return v && !isNaN(n) && n > 0 ? n : null;
};
