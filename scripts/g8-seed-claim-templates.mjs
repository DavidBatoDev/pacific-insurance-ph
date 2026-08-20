// One-time seed for the medical Notification of Claim's page-4 "Claims
// Reimbursement Checklist" (see docs/attachments/applications/NOC.pdf p.4).
//
// This is data, not a schema change -- required_document_templates and
// required_document_items already exist (0004_workflow.sql). Ordinarily a
// migration would carry a seed like this (see 0024_application_requirements.sql),
// but this worker is barred from adding migration files because the schema for
// this batch is already applied and shared across three concurrent workers.
// Run directly against the same service-role client the app's repositories use,
// idempotent on template_name / document_name so it is safe to re-run.
//
// Usage: node scripts/g8-seed-claim-templates.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envPath = new URL("../.env.local", import.meta.url);
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const IN_PATIENT_ITEMS = [
  { document_name: "Duly-accomplished Notification of Claim (NOC) form", is_required: true, applies_to: null, notes: null, sort_order: 10 },
  { document_name: "Original official receipt(s) of all payments made", is_required: true, applies_to: null, notes: null, sort_order: 20 },
  { document_name: "Drug prescription from the attending physician", is_required: true, applies_to: null, notes: null, sort_order: 30 },
  { document_name: "Admitting medical history", is_required: true, applies_to: null, notes: "Includes detailed history of present illness; family, personal and past medical history.", sort_order: 40 },
  { document_name: "Discharge summary report", is_required: true, applies_to: null, notes: "Includes patient's course in wards, diagnostic tests requested and medications given.", sort_order: 50 },
  { document_name: "Statement of Account", is_required: true, applies_to: null, notes: "Summarized and itemized.", sort_order: 60 },
  { document_name: "Supporting charge slips of statement of account", is_required: true, applies_to: "Where the hospital has no itemized Statement of Account", notes: null, sort_order: 70 },
  { document_name: "Copy of results of laboratory, X-ray, other diagnostic exams and therapeutic services", is_required: true, applies_to: null, notes: null, sort_order: 80 },
  { document_name: "Operative Report and Histopathology Report", is_required: false, applies_to: "If a surgical procedure was done", notes: "Operative report describes the surgical procedure; histopathology report covers the nature, extent and stage of illness.", sort_order: 90 },
  { document_name: "Referral letter/slip from the attending physician", is_required: false, applies_to: "If a Private Duty Nurse was deemed necessary", notes: null, sort_order: 100 },
  { document_name: "Copy of Registered Death Certificate", is_required: false, applies_to: "In the event of death of the member", notes: null, sort_order: 110 },
  { document_name: "Copy of police report", is_required: false, applies_to: "For injury as a result of an accident, or where applicable in the event of death", notes: null, sort_order: 120 },
  { document_name: "Incident report", is_required: false, applies_to: "For injury as a result of an accident", notes: null, sort_order: 130 },
  { document_name: "Proof of overseas stay", is_required: false, applies_to: "For overseas claims", notes: "E.g. airline ticket of the actual flight taken, boarding pass, immigration stamps in the passport, or proof of entry and exit where immigration stamps are not applicable.", sort_order: 140 },
];

const OUT_PATIENT_ITEMS = [
  { document_name: "Duly-accomplished Notification of Claim (NOC) form", is_required: true, applies_to: null, notes: null, sort_order: 10 },
  { document_name: "Original official receipt(s) of all payments made", is_required: true, applies_to: null, notes: "With itemized summary of charges.", sort_order: 20 },
  { document_name: "Copy of the drug prescription from the attending physician", is_required: false, applies_to: "If applicable", notes: null, sort_order: 30 },
  { document_name: "Copy of request for laboratory, X-ray, other diagnostic exams and therapeutic services", is_required: false, applies_to: "If applicable", notes: null, sort_order: 40 },
  { document_name: "Copy of results of laboratory, X-ray, other diagnostic exams and therapeutic services", is_required: false, applies_to: "If applicable", notes: null, sort_order: 50 },
  { document_name: "Operative Report and Histopathology Report", is_required: false, applies_to: "If an out-patient operation was done", notes: "Operative report describes the surgical procedure; histopathology report covers the nature, extent and stage of illness.", sort_order: 60 },
  { document_name: "Copy of police report", is_required: false, applies_to: "For injury as a result of an accident", notes: null, sort_order: 70 },
  { document_name: "Incident report", is_required: false, applies_to: "For injury as a result of an accident", notes: null, sort_order: 80 },
  { document_name: "Proof of overseas stay", is_required: false, applies_to: "For overseas claims", notes: "E.g. airline ticket, boarding pass, or immigration stamps in the passport.", sort_order: 90 },
  { document_name: "Prescription from Ophthalmologist or Optometrist", is_required: false, applies_to: "For optical claims", notes: "Required quantity must be indicated if claiming for disposable contact lenses.", sort_order: 100 },
];

async function ensureTemplate(templateName, description, items) {
  let { data: template, error } = await db
    .from("required_document_templates")
    .select("id")
    .eq("template_name", templateName)
    .maybeSingle();
  if (error) throw error;

  if (!template) {
    const inserted = await db
      .from("required_document_templates")
      .insert({ template_name: templateName, description, status: "Active" })
      .select("id")
      .single();
    if (inserted.error) throw inserted.error;
    template = inserted.data;
    console.log(`created template ${templateName} (${template.id})`);
  } else {
    console.log(`template ${templateName} already exists (${template.id})`);
  }

  const { data: existingItems, error: existingError } = await db
    .from("required_document_items")
    .select("document_name")
    .eq("requirement_template_id", template.id);
  if (existingError) throw existingError;
  const existingNames = new Set((existingItems ?? []).map((i) => i.document_name));

  const toInsert = items
    .filter((item) => !existingNames.has(item.document_name))
    .map((item) => ({ ...item, requirement_template_id: template.id }));

  if (toInsert.length) {
    const { error: insertError } = await db.from("required_document_items").insert(toInsert);
    if (insertError) throw insertError;
    console.log(`  inserted ${toInsert.length} item(s)`);
  } else {
    console.log("  all items already present");
  }
}

async function main() {
  await ensureTemplate(
    "Medical NOC — In-Patient Claim",
    "Claims Reimbursement Checklist, in-patient column (Pacific Cross medical Notification of Claim, page 4).",
    IN_PATIENT_ITEMS,
  );
  await ensureTemplate(
    "Medical NOC — Out-Patient Claim",
    "Claims Reimbursement Checklist, out-patient column (Pacific Cross medical Notification of Claim, page 4).",
    OUT_PATIENT_ITEMS,
  );
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
