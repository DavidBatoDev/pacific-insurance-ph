/**
 * Throwaway proof for M5 (Sync policies vs persona), M6 (Travel workflow vs persona) and the
 * renewals half of L15 (USD renewals render US$ and a split Awaiting payment stat).
 * Run: node --env-file=.env.local qa-oct2/fix-persona.mjs
 */
import { startFeature, settle, db, createTestClient, QA_PREFIX } from "./lib.mjs";

const BLUE_ROYALE_VERSION = "427d8fa0-2ce1-4a20-90bc-b477b6a13e0c";
const BLUE_ROYALE_PRODUCT = "80e401c9-9ddc-40bf-961a-aed182a1dd69";
const TRAVELSAFE_VERSION_ID = "e6f25cd4-71a6-4bf9-8670-76358dca6e16";
const iso = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => iso(new Date(Date.now() + n * 86_400_000));
const created = [];
const track = (table, id, ref) => created.push({ table, id, ref });

const t = await startFeature("fix-persona");
const { page } = t;
page.setDefaultTimeout(60_000);
const check = (ok, text) => (ok ? t.pass(text) : t.fail(text));

async function go(path) {
  await page.goto(path, { timeout: 90_000 });
  await page.getByText("Compiling", { exact: false }).first().waitFor({ state: "hidden", timeout: 60_000 }).catch(() => {});
  await settle(page, 2000);
}
async function viewAs(label) {
  const profile = page.locator("button", { has: page.locator("span", { hasText: /^Admin$/ }) }).last();
  await profile.click();
  await page.getByText("View as", { exact: true }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(1200);
}
async function resetPersona() {
  await page.evaluate(() => localStorage.setItem("pi_persona", "admin"));
  await page.reload({ timeout: 90_000 });
  await settle(page, 2000);
}

/* ---------- seed ---------- */
const label = "Persona Fix";
const existing = await db.from("clients").select("*").eq("first_name", QA_PREFIX).eq("last_name", label).maybeSingle();
const client = existing.data ?? await createTestClient(label, { lifecycle_stage: "Client", gender: "Female", date_of_birth: "1991-02-02" });
track("clients", client.id, `${QA_PREFIX} ${label}`);

const { data: existingPolicy } = await db.from("policies").select("*").eq("client_id", client.id).maybeSingle();
let policy = existingPolicy;
if (!policy) {
  const { data, error } = await db.from("policies").insert({
    client_id: client.id,
    product_id: BLUE_ROYALE_PRODUCT,
    product_version_id: BLUE_ROYALE_VERSION,
    policy_number: "QA-OCT2-PC-PERSONA-USD",
    status: "Active",
    effective_date: "2026-05-01",
    expiry_date: "2027-04-30",
    renewal_date: "2027-04-30",
    currency: "USD",
    premium_amount: 1350,
    payment_mode: "Annual",
    notes: "QA OCT2 seeded USD policy (fix-persona)",
  }).select("*").single();
  if (error) throw new Error(`policies: ${error.message}`);
  policy = data;
  await new Promise((r) => setTimeout(r, 1500));
}
track("policies", policy.id, policy.policy_number);
const { data: renewals } = await db.from("renewals").select("*").eq("policy_id", policy.id);
for (const r of renewals ?? []) {
  track("renewals", r.id, r.reference_no);
  if (r.status !== "Awaiting Payment") await db.from("renewals").update({ status: "Awaiting Payment" }).eq("id", r.id);
}
const { data: pays } = await db.from("payments").select("id, reference_no").eq("client_id", client.id);
for (const p of pays ?? []) track("payments", p.id, p.reference_no);
check((renewals?.length ?? 0) >= 1, `Seeded USD policy ${policy.policy_number} has ${renewals?.length ?? 0} renewal(s) → set to Awaiting Payment`);

const { data: existingTrip } = await db.from("travel_requests").select("*").eq("client_id", client.id).maybeSingle();
let trip = existingTrip;
if (!trip) {
  const { data, error } = await db.from("travel_requests").insert({
    client_id: client.id,
    product_version_id: TRAVELSAFE_VERSION_ID,
    destination: "Singapore",
    departure_date: daysFromNow(30),
    return_date: daysFromNow(35),
    traveler_count: 1,
    status: "Awaiting Payment",
    quoted_premium: 2500,
    currency: "PHP",
    applicant_is_traveler: true,
    portal_payment_status: "Not Yet",
    portal_processing_status: "Not Started",
    carrier_form_age_band: "All Ages",
    carrier_form_match_status: "Unavailable",
    itinerary: "QA OCT2 fix-persona trip",
  }).select("*").single();
  if (error) throw new Error(`travel_requests: ${error.message}`);
  trip = data;
  const { data: trv, error: e2 } = await db.from("travelers").insert({
    travel_request_id: trip.id, full_name: `${QA_PREFIX} ${label}`, date_of_birth: "1991-02-02", nationality: "Filipino", gender: "Female",
    contact_number: client.mobile_number, id_type: "Passport", id_number: "P1234567Q", beneficiary_name: "QA Beneficiary", sort_order: 0,
  }).select("*").single();
  if (e2) throw new Error(`travelers: ${e2.message}`);
  track("travelers", trv.id, trv.full_name);
  const { data: reqs, error: e3 } = await db.from("travel_request_requirements").insert([
    { travel_request_id: trip.id, document_name: "Passport copy", applies_to: trv.full_name, is_required: true, sort_order: 20, status: "Pending" },
  ]).select("id");
  if (e3) throw new Error(`travel_request_requirements: ${e3.message}`);
  for (const r of reqs) track("travel_request_requirements", r.id, "Passport copy");
}
track("travel_requests", trip.id, trip.reference_no);

/* ---------- M5 + L15: /renewals ---------- */
const syncBtn = () => page.getByRole("button", { name: "Sync policies" });
const awaitingStat = async () => {
  const card = page.locator("div.rounded-lg.border.px-4", { hasText: /Awaiting payment/ }).first();
  return ((await card.locator("div").first().textContent()) ?? "").trim();
};

await go("/renewals");
await resetPersona();
check((await syncBtn().count()) === 1, "Admin persona: Sync policies visible on /renewals");
const row = page.locator("tr", { hasText: `${QA_PREFIX} ${label}` }).first();
await row.waitFor({ timeout: 30_000 });
const premiumCell = ((await row.locator("td").nth(5).textContent()) ?? "").trim();
check(premiumCell === "US$1,350", `L15: USD renewal premium cell renders "${premiumCell}" (expected US$1,350)`);
const stat = await awaitingStat();
t.note(`Awaiting payment stat text: "${stat}"`);
check(/US\$/.test(stat), `L15: Awaiting payment stat shows a separate US$ figure: "${stat}"`);
await t.shot("renewals-admin-usd");

await viewAs("Staff · Broker");
check((await syncBtn().count()) === 0, "M5: Staff persona hides Sync policies");
await t.shot("renewals-staff-no-sync");
await resetPersona();
check((await syncBtn().count()) === 1, "M5: back to Admin → Sync policies visible again");
await t.shot("renewals-admin-sync-back");

/* ---------- M6: Travel workflow ---------- */
const openWorkflow = async () => {
  await go("/travel");
  const r = page.locator("tr", { hasText: `${QA_PREFIX} ${label}` }).first();
  await r.waitFor({ timeout: 30_000 });
  await r.click();
  await page.getByText("Post-issuance pack", { exact: true }).waitFor({ timeout: 150_000 });
  await page.waitForTimeout(1000);
};
const packState = async () => {
  const pack = page.locator("div.rounded-md.border", { has: page.getByText("Post-issuance pack", { exact: true }) }).first();
  const text = (await pack.textContent()) ?? "";
  return {
    readOnly: /Read-only/.test(text),
    editButtons: await page.getByRole("button", { name: /Record from Inbox|Change attachment|Unlink/ }).count(),
    uploads: await page.locator("label:has-text('Upload the issued policy PDF'), label:has-text('Policy PDF attached'), label:has-text('carrier'), label:has-text('Carrier application copy attached')").count(),
    save: await page.getByRole("button", { name: "Save workflow" }).count(),
  };
};
const closeModal = async () => {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(400);
  const close = page.getByRole("button", { name: "Close", exact: true });
  if (await close.count()) await close.last().click().catch(() => {});
  await page.waitForTimeout(500);
};

await openWorkflow();
const admin = await packState();
check(!admin.readOnly && admin.editButtons > 0 && admin.uploads > 0 && admin.save === 1, `Admin persona: workflow editable (read-only=${admin.readOnly}, pack buttons=${admin.editButtons}, uploads=${admin.uploads}, save=${admin.save})`);
await t.shot("travel-admin-workflow");
await closeModal();

await viewAs("Agent");
await openWorkflow();
const agent = await packState();
check(agent.readOnly && agent.editButtons === 0 && agent.uploads === 0, `M6: Agent persona → post-issuance pack read-only (read-only=${agent.readOnly}, pack buttons=${agent.editButtons}, uploads=${agent.uploads})`);
t.note(`Agent persona keeps own-client editing per matrix (travel: agent=own): Save workflow count=${agent.save}`);
await t.shot("travel-agent-workflow");
await closeModal();
await resetPersona();

console.log("\nQA rows created/used:");
for (const c of created) console.log(`  ${c.table} ${c.id} ${c.ref ?? ""}`);
const fails = await t.finish();
process.exit(fails ? 1 : 0);
