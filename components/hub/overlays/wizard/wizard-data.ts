/**
 * New Client Application wizard — shared types, options and checklists
 * (design new-application-data.jsx / web/new-application-wizard.md).
 * Kept as a separate module to preserve the design's 4-file split.
 */

export type WizardCategory = "health" | "hmo" | "travel";

export interface WizardMember {
  name: string;
  dob: string;
  rel: string;
  email: string;
}

export interface ChecklistItem {
  name: string;
  cond: string | null;
  checked: boolean;
  status: string;
}

export interface WizardForm {
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
  /* Step 3 — product specifics */
  coverage: string;
  startDate: string;
  dependents: string;
  existingPC: string;
  preExisting: string;
  medicalNotes: string;
  payFreq: string;
  premium: string;
  passport: string;
  destination: string;
  departure: string;
  returnDate: string;
  travelPurpose: string;
  /* Step 4 — requirements */
  checklist: ChecklistItem[];
  /* Step 5 — communication & follow-up */
  sendEmail: boolean;
  emailTemplate: string;
  emailRecipient: string;
  emailSubject: string;
  emailBody: string;
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

export const WIZ_OPTS = {
  appType: [
    "New Insurance Application",
    "Additional Product (Existing Client)",
    "Renewal Application",
    "Inquiry / Lead Only",
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
export function categoryForProduct(name: string): WizardCategory {
  if (/travel/i.test(name)) return "travel";
  if (/flexi|hmo|group/i.test(name)) return "hmo";
  return "health";
}

export function emptyWizardForm(): WizardForm {
  return {
    draftApplicationId: null,
    draftStep: 1,
    appType: "",
    source: "",
    category: "",
    productVersionId: "",
    productName: "",
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
    coverage: "",
    startDate: "",
    dependents: "",
    existingPC: "",
    preExisting: "",
    medicalNotes: "",
    payFreq: "",
    premium: "",
    passport: "",
    destination: "",
    departure: "",
    returnDate: "",
    travelPurpose: "",
    checklist: [],
    sendEmail: false,
    emailTemplate: "",
    emailRecipient: "",
    emailSubject: "",
    emailBody: "",
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
