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
  existingPC: string;
  preExisting: string;
  medicalNotes: string;
  remoteSale: boolean;
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
