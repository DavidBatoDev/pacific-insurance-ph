/**
 * TESTING-OCT2.md §6 Travel — 6.1 … 6.6 as recorded Playwright runs.
 *
 *   node --env-file=.env.local qa-oct2/06-travel.mjs [--only=6.5]
 */
import { readFileSync, statSync } from "node:fs";

import { startFeature, settle, db, createTestClient, SAMPLE_PDF, QA_PREFIX } from "./lib.mjs";

const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7) ?? null;
const run = (id) => !ONLY || ONLY.split(",").includes(id);

const TRAVELSAFE_VERSION_ID = "e6f25cd4-71a6-4bf9-8670-76358dca6e16"; // product_versions → TravelSafe (Active)
const STAFF_EMAIL = "playwright-staff@prodigitality.net";
const WIZ = "div.fixed.inset-0.z-\\[75\\]";
const created = []; // { table, id, label }
const summary = []; // { section, result, evidence }
const bugs = [];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Control rendered right after a `Field` label (labels carry no htmlFor). */
const field = (scope, label) =>
  scope.locator("label").filter({ hasText: new RegExp(`^${esc(label)}(\\s|\\*|$)`) }).first().locator("xpath=following-sibling::*[1]");
const iso = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => iso(new Date(Date.now() + n * 86_400_000));
const track = (table, id, label) => created.push({ table, id, label });
/** Navigate with a generous budget — the dev server compiles routes on first hit and is shared. */
const go = (t, url) => t.page.goto(url, { timeout: 120_000, waitUntil: "domcontentloaded" });

async function step(t, name, fn) {
  try {
    await fn();
  } catch (err) {
    t.fail(`${name}: ${String(err?.message ?? err).split("\n")[0]}`);
    await t.shot(`fail-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`).catch(() => {});
  }
}
const check = (t, ok, text) => (ok ? t.pass(text) : t.fail(text));
const bug = (t, text) => { t.bug(text); bugs.push(text); };

async function staffUserId() {
  const { data, error } = await db.from("users").select("id").eq("email", STAFF_EMAIL).single();
  if (error) throw new Error(error.message);
  return data.id;
}

/* ---------- seeding ---------- */

async function seedTrip(client, overrides = {}, traveler = {}) {
  const { data: trip, error } = await db
    .from("travel_requests")
    .insert({
      client_id: client.id,
      product_version_id: TRAVELSAFE_VERSION_ID,
      destination: "Japan",
      departure_date: daysFromNow(30),
      return_date: daysFromNow(37),
      traveler_count: 1,
      status: "Awaiting Payment",
      quoted_premium: 2500,
      currency: "PHP",
      applicant_is_traveler: true,
      portal_payment_status: "Not Yet",
      portal_processing_status: "Not Started",
      carrier_form_age_band: "All Ages",
      carrier_form_match_status: "Unavailable",
      itinerary: "QA OCT2 seeded trip",
      ...overrides,
    })
    .select("*")
    .single();
  if (error) throw new Error(`travel_requests: ${error.message}`);
  track("travel_requests", `${trip.id} (${trip.reference_no})`, overrides.destination ?? "Japan");
  const { data: trv, error: e2 } = await db
    .from("travelers")
    .insert({
      travel_request_id: trip.id,
      full_name: `${client.first_name} ${client.last_name}`,
      date_of_birth: client.date_of_birth ?? "1990-01-01",
      nationality: "Filipino",
      gender: client.gender ?? "Male",
      contact_number: client.mobile_number,
      id_type: "Passport",
      id_number: "P9876543Q",
      beneficiary_name: "QA Beneficiary",
      sort_order: 0,
      ...traveler,
    })
    .select("*")
    .single();
  if (e2) throw new Error(`travelers: ${e2.message}`);
  track("travelers", trv.id, trv.full_name);
  const reqs = [
    { document_name: "Completed Travel application form", applies_to: trv.full_name, is_required: true, sort_order: 10, status: "Pending" },
    { document_name: "Passport copy", applies_to: trv.full_name, is_required: true, sort_order: 20, status: "Pending" },
    { document_name: "Payment proof", applies_to: "Client collection", is_required: true, sort_order: 500, status: "Pending" },
    { document_name: "Issued Travel policy", applies_to: "After portal issuance", is_required: false, sort_order: 510, status: "Pending" },
  ].map((r) => ({ ...r, travel_request_id: trip.id }));
  const { data: rrows, error: e3 } = await db.from("travel_request_requirements").insert(reqs).select("id, document_name");
  if (e3) throw new Error(`travel_request_requirements: ${e3.message}`);
  for (const r of rrows) track("travel_request_requirements", r.id, r.document_name);
  return { trip, traveler: trv, requirements: rrows };
}

/**
 * Synthetic Inbox email with attachment parts. `stored` parts get a stored original (documents +
 * gmail_inbox_filings + requirement_attachment_sources + Storage object) so "Record from Inbox" can
 * retrieve bytes without a live Gmail fetch. Returns ids for teardown.
 */
async function seedInboxMessage({ client, trip, userId, targetKind, parts, subject, key }) {
  const pdf = readFileSync(SAMPLE_PDF);
  const now = new Date().toISOString();
  const { data: comm, error: ce } = await db
    .from("communications")
    .insert({
      client_id: client.id,
      travel_request_id: targetKind === "travel" ? trip.id : null,
      direction: "Inbound",
      channel: "Gmail",
      subject,
      summary: "QA OCT2 synthetic inbox email",
      occurred_at: now,
      delivery_status: "logged",
      notes: "QA OCT2 synthetic — safe to delete",
    })
    .select("id")
    .single();
  if (ce) throw new Error(`communications: ${ce.message}`);
  track("communications", comm.id, subject);
  const attachments = parts.map((p, i) => ({
    partId: String(i + 1),
    attachmentId: `qa-oct2-${key}-${i + 1}`,
    fileName: p.fileName,
    mimeType: "application/pdf",
    size: pdf.length,
  }));
  const { data: msg, error: me } = await db
    .from("gmail_inbox_messages")
    .insert({
      google_subject: "qa-oct2-synthetic",
      gmail_message_id: `qaoct2${key}`,
      gmail_thread_id: `qaoct2${key}`,
      from_address: "travelsafe-qa@pacificcross.example",
      from_name: "Pacific Cross TravelSafe (QA)",
      to_addresses: ["eman@pacificinsuranceph.example"],
      subject,
      body_text: "QA OCT2 synthetic email body. Attachments are the sample PDF.",
      body_truncated: false,
      received_at: now,
      attachments,
      is_auto_reply: false,
      target_kind: targetKind,
      target_id: targetKind === "travel" ? trip.id : client.id,
      client_id: client.id,
      communication_id: comm.id,
      linked_by: userId,
      linked_at: now,
      filed_parts: {},
    })
    .select("id")
    .single();
  if (me) throw new Error(`gmail_inbox_messages: ${me.message}`);
  track("gmail_inbox_messages", msg.id, subject);
  const filedParts = {};
  const storagePaths = [];
  const documentIds = [];
  for (const [i, p] of parts.entries()) {
    if (!p.stored) continue;
    const partId = String(i + 1);
    const path = `${client.id}/gmail/${msg.id}/qa-oct2-${partId}.pdf`;
    const up = await db.storage.from("documents").upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (up.error) throw new Error(`storage upload: ${up.error.message}`);
    storagePaths.push(path);
    const { data: doc, error: de } = await db
      .from("documents")
      .insert({
        client_id: client.id,
        travel_request_id: trip.id,
        document_type: "Supporting Document",
        name: p.fileName,
        file_path: path,
        status: "Uploaded",
        visibility: "Internal Only",
        uploaded_by: userId,
        notes: "QA OCT2 synthetic stored original",
      })
      .select("id")
      .single();
    if (de) throw new Error(`documents: ${de.message}`);
    documentIds.push(doc.id);
    track("documents", doc.id, p.fileName);
    const { error: fe } = await db.from("gmail_inbox_filings").insert({ message_id: msg.id, part_id: partId, document_id: doc.id, purpose: "document", storage_path: path, filed_by: userId });
    if (fe) throw new Error(`gmail_inbox_filings: ${fe.message}`);
    // the gmail_inbox_filings trigger captures the (immutable) requirement_attachment_sources row
    filedParts[partId] = doc.id;
  }
  await db.from("gmail_inbox_messages").update({ filed_parts: filedParts }).eq("id", msg.id);
  return { messageId: msg.id, communicationId: comm.id, documentIds, storagePaths, attachments };
}

async function teardownInbox(seeds, t) {
  for (const s of seeds) {
    const del = async (table, col, val) => {
      const { error } = await db.from(table).delete().eq(col, val);
      if (error) t.note(`teardown ${table}: ${error.message}`);
    };
    await del("travel_pack_reference_attachments", "message_id", s.messageId);
    for (const id of s.documentIds) await del("documents", "id", id);
    await del("gmail_inbox_messages", "id", s.messageId);
    await del("communications", "id", s.communicationId);
    if (s.storagePaths.length) {
      const { error } = await db.storage.from("documents").remove(s.storagePaths);
      if (error) t.note(`teardown storage: ${error.message}`);
    }
  }
  const { count } = await db.from("gmail_inbox_messages").select("*", { count: "exact", head: true }).eq("google_subject", "qa-oct2-synthetic");
  t.note(`Inbox seed teardown done — ${count ?? "?"} synthetic gmail_inbox_messages remain`);
}

/* ---------- wizard drivers ---------- */

/** Wait until the dev server's "Compiling" badge is gone and the page is hydrated enough to react. */
async function hydrated(page) {
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
  await page.getByText("Compiling", { exact: false }).first().waitFor({ state: "hidden", timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function openNewTravelQuote(t) {
  t.context.setDefaultTimeout(45_000);
  await go(t, "/travel");
  await hydrated(t.page);
  const wiz = t.page.locator(WIZ);
  const heading = wiz.getByRole("heading", { name: "Client, trip & requirements" });
  for (let attempt = 1; attempt <= 4; attempt++) {
    await t.page.getByRole("button", { name: "New travel quote" }).click();
    const shown = await heading.waitFor({ timeout: 20_000 }).then(() => true).catch(() => false);
    if (shown) break;
    if (attempt === 4) throw new Error("wizard did not open after 4 clicks on 'New travel quote'");
    await t.page.waitForTimeout(3000);
  }
  await t.page.waitForTimeout(2000); // product options load async
  return wiz;
}

async function fillSource(wiz) {
  const source = field(wiz, "Source");
  if (!(await source.inputValue())) await source.selectOption({ index: 1 });
}

async function fillNewClient(wiz, lastName, { mobile = "09170000001", email } = {}) {
  await wiz.getByRole("button", { name: "New client" }).click();
  await field(wiz, "First name").fill(QA_PREFIX);
  await field(wiz, "Last name").fill(lastName);
  await field(wiz, "Mobile number").fill(mobile);
  if (email) await field(wiz, "Email address").fill(email);
}

async function pickExistingClient(wiz, page, name) {
  await wiz.getByRole("button", { name: "Existing client" }).click();
  const search = wiz.getByPlaceholder("Search a client…");
  await search.fill(name);
  const hit = wiz.getByRole("button", { name: new RegExp(esc(name)) }).first();
  await hit.waitFor({ timeout: 15_000 });
  await hit.click();
  await page.waitForTimeout(1500);
}

/** The open-work prompt arrives asynchronously after a pick; wait for it and dismiss it. */
async function dismissOpenWork(t, timeout) {
  const dialog = t.page.getByRole("dialog", { name: /already has open work/ });
  const shown = await dialog.waitFor({ timeout }).then(() => true).catch(() => false);
  if (shown) await dialog.getByRole("button", { name: "Start a new one anyway" }).click();
  return shown;
}

async function fillTrip(wiz, { destination = "Japan", departure = daysFromNow(40), ret = daysFromNow(47), premium = "2500", passport = "P1234567A", travelerName, travelerDob = "1990-01-01" } = {}) {
  await field(wiz, "Passport number").fill(passport);
  if (travelerName) {
    const first = wiz.getByLabel("Traveler 1 name");
    if (!(await first.count())) await wiz.getByRole("button", { name: "Use applicant" }).click();
    await wiz.getByLabel("Traveler 1 name").fill(travelerName);
  }
  if (await wiz.getByLabel("Traveler 1 birthdate").count()) {
    await wiz.getByLabel("Traveler 1 birthdate").fill(travelerDob);
    await wiz.getByLabel("Traveler 1 ID number").fill(passport);
  }
  await field(wiz, "Destination country").fill(destination);
  await field(wiz, "Departure date").fill(departure);
  await field(wiz, "Return date").fill(ret);
  await field(wiz, "Quoted premium (₱)").fill(premium);
}

/** Create & open portal: resolves with { popup, popupUrl } once the wizard closes (server action done). */
async function createAndOpenPortal(t, wiz) {
  const popupPromise = t.context.waitForEvent("page", { timeout: 20_000 }).catch(() => null);
  await wiz.getByRole("button", { name: /Create & open portal/ }).click();
  const popup = await popupPromise;
  // The wizard closes only when createFromWizardAction returns; the shared dev server can be slow.
  await wiz.waitFor({ state: "hidden", timeout: 150_000 }).catch(() => t.note("wizard still open 150s after Create"));
  let popupUrl = null;
  if (popup) {
    for (let i = 0; i < 20 && /about:blank/.test(popup.url()); i++) await t.page.waitForTimeout(500);
    popupUrl = popup.url();
    await popup.close().catch(() => {});
  }
  return { popup, popupUrl };
}

/** The Travel workflow modal shows "Loading…" until its payload arrives; wait for the real header. */
async function waitForWorkflow(t) {
  await t.page.getByText("Travel workflow", { exact: true }).waitFor({ timeout: 150_000 });
  await t.page.waitForTimeout(1000);
}

/** Close the topmost modal (toasts can add a second "Close"-like control; Escape first, then the last Close). */
async function closeModal(t) {
  // Dialog pickers first (Escape is swallowed when a preview iframe holds focus).
  for (const name of ["Close reference picker", "Close attachment picker"]) {
    const btn = t.page.getByRole("button", { name });
    if (await btn.count()) await btn.first().click().catch(() => {});
  }
  await t.page.keyboard.press("Escape").catch(() => {});
  await t.page.waitForTimeout(400);
  const close = t.page.getByRole("button", { name: "Close", exact: true });
  if (await close.count()) await close.last().click().catch(() => {});
  await t.page.waitForTimeout(500);
}
/** Save draft and wait for the wizard to close (the action is pending while the button is disabled). */
async function saveDraft(t, wiz) {
  await wiz.getByRole("button", { name: "Save draft" }).click();
  await wiz.waitFor({ state: "hidden", timeout: 150_000 });
}

/* ====================================================================== 6.1 */
async function section61() {
  const t = await startFeature("6.1-default-travelsafe");
  let result = "PASS";
  const bugsAt = bugs.length;
  try {
    await step(t, "open wizard", async () => {
      const wiz = await openNewTravelQuote(t);
      await t.shot("wizard-open");
      const product = field(wiz, "Product");
      const productText = (await product.locator("option:checked").textContent())?.trim();
      check(t, /TravelSafe/i.test(productText ?? ""), `Product preselected: "${productText}"`);
      const appType = await field(wiz, "Application type").inputValue();
      check(t, appType === "New Insurance Application", `Application type = "${appType}" (expected New Insurance Application)`);
      check(t, !/Inquiry Only/i.test(appType), `Application type is not "Inquiry Only (Lead)"`);
      const status = (await wiz.getByText("Initial status").locator("xpath=following-sibling::*[1]").textContent())?.trim();
      t.note(`Initial status pill: "${status}"`);
      check(t, status !== "Lead", `Initial status is "${status}", not Lead`);
      await wiz.getByRole("button", { name: "Cancel" }).click();
    });
  } finally {
    const fails = await t.finish();
    if (fails) result = bugs.length > bugsAt ? "BUG" : "FAIL";
    summary.push({ section: "6.1 New travel quote defaults to TravelSafe", result, evidence: "Product select = TravelSafe, Application type = New Insurance Application on open" });
  }
}

/* ====================================================================== 6.2 */
async function section62() {
  const t = await startFeature("6.2-two-step-flow");
  let result = "PASS";
  const bugsAt = bugs.length;
  try {
    let wiz;
    await step(t, "steps named", async () => {
      wiz = await openNewTravelQuote(t);
      const stepButtons = await wiz.locator("aside, div.row-span-2").first().getByRole("button").allTextContents();
      const labels = stepButtons.map((s) => s.replace(/^\d+\s*/, "").trim());
      t.note(`Sidebar steps: ${JSON.stringify(labels)}`);
      check(t, labels.length === 2 && labels[0] === "Client, trip & requirements" && labels[1] === "Review & create", "Wizard shows exactly two steps: 'Client, trip & requirements', 'Review & create'");
      const heading = await wiz.getByRole("heading", { level: 2 }).first().textContent();
      check(t, heading?.trim() === "Client, trip & requirements", `Step 1 heading = "${heading?.trim()}"`);
    });

    await step(t, "still needed on review", async () => {
      await fillSource(wiz);
      await fillNewClient(wiz, "Two Step", { mobile: "09170000002" });
      await wiz.getByRole("button", { name: "Continue" }).click();
      await wiz.getByRole("heading", { name: /Review & create/ }).waitFor();
      const heading = await wiz.getByRole("heading", { level: 2 }).first().textContent();
      t.note(`Step 2 heading = "${heading?.trim()}"`);
      const createBtn = wiz.getByRole("button", { name: /Create & open portal/ });
      check(t, await createBtn.isDisabled(), "'Create & open portal' is disabled while required fields are missing");
      const still = wiz.getByText(/stays greyed out until you add:/);
      check(t, await still.isVisible(), `Footer shows: "${(await still.textContent())?.trim()}"`);
      await t.shot("still-needed");
      await wiz.getByRole("button", { name: "Back" }).click();
    });

    await step(t, "complete and create", async () => {
      await fillTrip(wiz, { travelerName: `${QA_PREFIX} Two Step`, passport: "P2222222B" });
      await wiz.getByRole("button", { name: "Continue" }).click();
      await wiz.getByRole("heading", { name: /Review & create/ }).waitFor();
      const createBtn = wiz.getByRole("button", { name: /Create & open portal/ });
      check(t, await createBtn.isEnabled(), "'Create & open portal' enabled once everything required is filled");
      check(t, (await wiz.getByText(/stays greyed out until you add:/).count()) === 0, "No blocked-Create notice once complete");
      await t.shot("review-ready");
      const { popup, popupUrl } = await createAndOpenPortal(t, wiz);
      check(t, !!popup, `TravelSafe portal pop-up opened (url: ${popupUrl})`);
      if (popup && !/pacificcross/i.test(popupUrl ?? "")) t.note(`Pop-up URL did not reach the portal URL within the wait: ${popupUrl}`);
      await waitForWorkflow(t);
      const h3 = await t.page.locator("h3", { hasText: /TRV-/ }).first().textContent();
      check(t, /TRV-\d{4}-\d+/.test(h3 ?? ""), `Travel workflow opened for the new request: "${h3?.trim()}"`);
      await t.shot("workflow-after-create");
      const { data: trips } = await db.from("travel_requests").select("id, reference_no, status, client_id, clients!inner(first_name,last_name)").eq("clients.last_name", "Two Step").eq("clients.first_name", QA_PREFIX);
      check(t, (trips?.length ?? 0) >= 1, `DB travel_requests row(s) for QA OCT2 Two Step: ${JSON.stringify(trips?.map((x) => [x.reference_no, x.status]))}`);
      for (const tr of trips ?? []) { track("travel_requests", `${tr.id} (${tr.reference_no})`, "6.2 Two Step"); track("clients", tr.client_id, `${QA_PREFIX} Two Step`); }
      await closeModal(t);
    });

    await step(t, "save as draft", async () => {
      wiz = await openNewTravelQuote(t);
      await fillSource(wiz);
      await fillNewClient(wiz, "Draft Trip", { mobile: "09170000003" });
      await field(wiz, "Destination country").fill("Korea");
      const draftBtn = wiz.getByRole("button", { name: "Save draft" });
      check(t, await draftBtn.isEnabled(), "'Save draft' enabled with name + contact");
      await saveDraft(t, wiz);
      await t.shot("after-save-draft");
      await go(t, "/travel");
      await hydrated(t.page);
      const row = t.page.locator("tr", { hasText: `${QA_PREFIX} Draft Trip` }).first();
      check(t, (await row.count()) > 0, "Draft quote listed on the Travel page");
      const rowText = (await row.textContent()) ?? "";
      check(t, /Draft/.test(rowText), `Row carries the "Draft" tag (row text: ${rowText.replace(/\s+/g, " ").slice(0, 160)})`);
      check(t, /Unfinished/.test(rowText), "Row status reads 'Unfinished'");
      await t.page.getByRole("button", { name: "Unfinished", exact: true }).first().click().catch(() => {});
      await t.page.waitForTimeout(800);
      check(t, (await t.page.locator("tr", { hasText: `${QA_PREFIX} Draft Trip` }).count()) > 0, "Draft still visible under the 'Unfinished' filter");
      await t.shot("unfinished-list");
      await row.click();
      const wiz2 = t.page.locator(WIZ);
      await wiz2.getByRole("heading", { name: "Client, trip & requirements" }).waitFor({ timeout: 120_000 });
      await t.page.waitForTimeout(2500);
      const dest = await field(wiz2, "Destination country").inputValue();
      check(t, dest === "Korea", `Clicking the draft reopens the wizard with saved values (destination = "${dest}")`);
      await t.shot("draft-reopened");
      const { data: drafts } = await db.from("applications").select("id, reference_no, status, client_id").eq("status", "Lead").eq("wizard_state->>category", "travel").eq("wizard_state->>lastName", "Draft Trip");
      for (const d of drafts ?? []) { track("applications (draft)", `${d.id} (${d.reference_no})`, "6.2 Draft Trip"); track("clients", d.client_id, `${QA_PREFIX} Draft Trip`); }
      t.note(`Draft applications rows: ${drafts?.length ?? 0}`);
      await wiz2.getByRole("button", { name: "Cancel" }).click().catch(() => {});
    });
  } finally {
    const fails = await t.finish();
    if (fails) result = bugs.length > bugsAt ? "BUG" : "FAIL";
    summary.push({ section: "6.2 Two-step travel flow", result, evidence: "Two named steps, Still needed gate, portal pop-up + workflow on create, draft under Unfinished with Draft tag" });
  }
}

/* ====================================================================== 6.3 */
async function seed63() {
  const repeat = await createTestClient("Repeat Traveler", { product_interest: "TravelSafe", gender: "Female", date_of_birth: "1988-05-20", lifecycle_stage: "Client", mobile_number: "09170000004" });
  track("clients", repeat.id, `${QA_PREFIX} Repeat Traveler`);
  const past = await seedTrip(repeat, { destination: "Singapore", departure_date: daysFromNow(-60), return_date: daysFromNow(-53), status: "Policy Issued", portal_processing_status: "Issued", portal_payment_status: "Prepaid", policy_number: "QA-PAST-0001" }, { id_number: "P9876543Q", nationality: "Filipino" });
  const open = await createTestClient("Open Trip", { product_interest: "TravelSafe", gender: "Male", date_of_birth: "1992-03-03", lifecycle_stage: "Client", mobile_number: "09170000005" });
  track("clients", open.id, `${QA_PREFIX} Open Trip`);
  const openTrip = await seedTrip(open, { destination: "Japan", departure_date: daysFromNow(40), return_date: daysFromNow(47), status: "Awaiting Payment" }, { id_number: "P5555555E" });
  return { repeat, past, open, openTrip };
}

async function section63(seed) {
  const t = await startFeature("6.3-existing-or-manual");
  let result = "PASS";
  const bugsAt = bugs.length;
  try {
    let wiz;
    await step(t, "pick existing client fills traveler", async () => {
      wiz = await openNewTravelQuote(t);
      await fillSource(wiz);
      // Papercut probe: the picker matches first_name OR last_name separately, so a full name finds nothing.
      await wiz.getByRole("button", { name: "Existing client" }).click();
      const search = wiz.getByPlaceholder("Search a client…");
      await search.fill(`${QA_PREFIX} Repeat`);
      const fullNameHit = await wiz.getByRole("button", { name: /Repeat Traveler/ }).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
      if (fullNameHit) t.pass("Client picker finds the client by typing first + last name");
      else bug(t, `Low: Existing-client picker returns nothing for a full-name search ("${QA_PREFIX} Repeat") — only first_name OR last_name OR email/mobile are matched separately (clients.repository.supabase.ts:204-206). Typing "Repeat Traveler" (last name) works. Screenshot: qa-oct2/videos/6.3-existing-or-manual/picker-fullname-empty.png`);
      await t.shot("picker-fullname-empty");
      await search.fill("");
      await pickExistingClient(wiz, t.page, "Repeat Traveler");
      if (await dismissOpenWork(t, 8000)) t.note("Open-work dialog appeared for Repeat Traveler (its only trip is closed) — unexpected");
      const note = wiz.getByText(/Traveler details filled from/);
      await note.waitFor({ timeout: 15_000 });
      const noteText = (await note.textContent())?.trim();
      check(t, noteText?.includes(`${QA_PREFIX} Repeat Traveler`) && noteText.includes("and their last trip"), `Fill note: "${noteText}"`);
      const name = await wiz.getByLabel("Traveler 1 name").inputValue();
      const idNo = await wiz.getByLabel("Traveler 1 ID number").inputValue();
      const dob = await wiz.getByLabel("Traveler 1 birthdate").inputValue();
      const passport = await field(wiz, "Passport number").inputValue();
      check(t, name === `${QA_PREFIX} Repeat Traveler`, `Traveler 1 name filled: "${name}"`);
      check(t, idNo === "P9876543Q", `Traveler 1 ID number from last trip: "${idNo}"`);
      check(t, passport === "P9876543Q", `Passport number field from last trip: "${passport}"`);
      check(t, dob === "1988-05-20", `Traveler 1 birthdate from client: "${dob}"`);
      await t.shot("existing-filled");
      // every field stays editable
      await wiz.getByLabel("Traveler 1 ID number").fill("P0000000Z");
      await wiz.getByLabel("Traveler 1 name").fill(`${QA_PREFIX} Repeat Traveler Edited`);
      await field(wiz, "Passport number").fill("P0000000Z");
      check(t, (await wiz.getByLabel("Traveler 1 ID number").inputValue()) === "P0000000Z" && (await wiz.getByLabel("Traveler 1 name").inputValue()).endsWith("Edited"), "Filled traveler fields remain editable");
      check(t, !(await wiz.getByLabel("Traveler 1 birthdate").isDisabled()) && !(await wiz.getByLabel("Traveler 1 ID type").isDisabled()), "Birthdate / ID type controls enabled");
    });

    await step(t, "new client manual entry", async () => {
      await wiz.getByRole("button", { name: "New client" }).click();
      await t.page.waitForTimeout(500);
      check(t, (await wiz.getByText(/Traveler details filled from/).count()) === 0, "Fill note disappears after switching to New client");
      check(t, await field(wiz, "First name").isVisible() && await field(wiz, "Last name").isVisible() && await field(wiz, "Mobile number").isVisible(), "Manual entry fields (First/Last name, Mobile) visible for a new client");
      await fillNewClient(wiz, "Manual Entry", { mobile: "09170000006" });
      const travelerName = await wiz.getByLabel("Traveler 1 name").inputValue().catch(() => "");
      if (travelerName) bug(t, `Low: switching from an Existing client to "New client" keeps the previous client's filled traveler row ("${travelerName}") and passport in the form — the earlier fill carries over silently into the new traveler's quote (wizard/new-application.tsx travelFilledFrom effect only fills; nothing clears travelers on client-mode change). Screenshot: qa-oct2/videos/6.3-existing-or-manual/manual-entry.png`);
      else t.pass("Previous client's traveler fill is cleared when switching to New client");
      await wiz.getByRole("button", { name: "Use applicant" }).click();
      const names = await wiz.locator("input[aria-label$=' name']").evaluateAll((els) => els.map((e) => e.value));
      check(t, names.some((n) => n === `${QA_PREFIX} Manual Entry`), `Use applicant adds the typed client as a traveler: ${JSON.stringify(names)}`);
      await t.shot("manual-entry");
    });

    await step(t, "overlapping open trip warning", async () => {
      await pickExistingClient(wiz, t.page, "Open Trip");
      const dialog = t.page.getByRole("dialog", { name: /already has open work/ });
      await dialog.waitFor({ timeout: 15_000 });
      const text = (await dialog.textContent()) ?? "";
      check(t, text.includes(seed.openTrip.trip.reference_no) && text.includes("Japan"), `Open-work warning lists the open trip: ${text.replace(/\s+/g, " ").slice(0, 220)}`);
      const openBtn = dialog.getByRole("button", { name: "Open travel request" });
      check(t, (await openBtn.count()) === 1, "Warning offers 'Open travel request'");
      await t.shot("open-trip-warning");
      await openBtn.click();
      await waitForWorkflow(t);
      const h3 = await t.page.locator("h3", { hasText: /TRV-/ }).first().textContent();
      check(t, h3?.includes(seed.openTrip.trip.reference_no), `Opens that trip's Travel workflow: "${h3?.trim()}"`);
      t.note("Warning is triggered by any open trip for the client (no date-overlap check at pick time; the date-overlap note is only appended to the create toast per wizard-actions.ts:1105-1114)");
      await closeModal(t);
    });
  } finally {
    const fails = await t.finish();
    if (fails) result = bugs.length > bugsAt ? "BUG" : "FAIL";
    summary.push({ section: "6.3 Existing client or manual entry", result, evidence: "Fill note with last-trip passport, fields editable, manual entry for new client, open-trip warning offers to open it" });
  }
}

/* ====================================================================== 6.4 */
async function section64(seed) {
  const t = await startFeature("6.4-requirements-upload");
  let result = "PASS";
  const bugsAt = bugs.length;
  try {
    let wiz;
    const passportLabel = `Passport copy — ${QA_PREFIX} Repeat Traveler`;
    await step(t, "requirement rows have Choose file with both sources", async () => {
      wiz = await openNewTravelQuote(t);
      await fillSource(wiz);
      await pickExistingClient(wiz, t.page, "Repeat Traveler");
      await dismissOpenWork(t, 8000);
      await wiz.getByText(/Traveler details filled from/).waitFor({ timeout: 15_000 });
      await fillTrip(wiz, { destination: "Taiwan", passport: "P9876543Q" });
      const rows = await wiz.locator("ul.divide-y > li").allTextContents();
      t.note(`Requirement rows: ${JSON.stringify(rows.map((r) => r.replace(/\s+/g, " ").trim()))}`);
      check(t, rows.some((r) => r.includes("Completed Travel application form")) && rows.some((r) => r.includes("Passport copy")), "Step 1 lists passport and signed application form requirement rows");
      const chooseButtons = wiz.locator("ul.divide-y > li").getByRole("button", { name: "Choose file" });
      check(t, (await chooseButtons.count()) === rows.length, `Every requirement row has a 'Choose file' button (${await chooseButtons.count()}/${rows.length})`);
      await t.shot("requirement-rows");
      const passportRow = wiz.locator("ul.divide-y > li", { hasText: "Passport copy" }).first();
      await passportRow.getByRole("button", { name: "Choose file" }).click();
      const picker = t.page.getByRole("dialog", { name: "Attach requirement document" });
      await picker.waitFor();
      await t.page.waitForTimeout(2000);
      const tabs = await picker.getByRole("tab").allTextContents();
      check(t, tabs.includes("Upload from device") && tabs.includes("From email attachments"), `Picker tabs: ${JSON.stringify(tabs)}`);
      await picker.getByRole("tab", { name: "From email attachments" }).click();
      await t.page.waitForTimeout(1500);
      await t.shot("picker-email-tab");
      await picker.getByRole("tab", { name: "Upload from device" }).click();
      const input = picker.locator(`input[type=file][aria-label="Choose file for ${passportLabel}"]`);
      check(t, (await input.count()) === 1, "Device tab exposes the file input for the passport requirement");
      await input.setInputFiles(SAMPLE_PDF);
      await t.page.waitForTimeout(1000);
      await picker.getByRole("button", { name: "Use for this requirement" }).click();
      await picker.waitFor({ state: "hidden", timeout: 10_000 });
      const chip = passportRow.getByText("On create");
      check(t, await chip.isVisible(), "Selected file shows as 'sample.pdf · On create' (not yet attached)");
      await t.shot("passport-selected");
    });

    let before = 0;
    await step(t, "files attach only after Create", async () => {
      const { count } = await db.from("documents").select("*", { count: "exact", head: true }).eq("client_id", seed.repeat.id);
      before = count ?? 0;
      check(t, before === 0, `No documents row for the client before Create (count=${before})`);
      await wiz.getByRole("button", { name: "Continue" }).click();
      await wiz.getByRole("heading", { name: /Review & create/ }).waitFor();
      const { popup, popupUrl } = await createAndOpenPortal(t, wiz);
      t.note(`Portal pop-up: ${popup ? popupUrl : "none"}`);
      await waitForWorkflow(t);
      await t.page.waitForTimeout(4000);
      await t.shot("workflow-after-create");
      const { data: trips } = await db.from("travel_requests").select("id, reference_no").eq("client_id", seed.repeat.id).eq("destination", "Taiwan");
      check(t, trips?.length === 1, `New trip created: ${JSON.stringify(trips)}`);
      const trip = trips?.[0];
      if (trip) track("travel_requests", `${trip.id} (${trip.reference_no})`, "6.4 Taiwan");
      const { data: reqs } = await db.from("travel_request_requirements").select("id, document_name, status").eq("travel_request_id", trip?.id ?? "00000000-0000-0000-0000-000000000000");
      const passportReq = reqs?.find((r) => r.document_name === "Passport copy");
      const { data: docs } = await db.from("documents").select("id, name, document_type, travel_request_id, travel_requirement_id, file_path").eq("travel_request_id", trip?.id ?? "00000000-0000-0000-0000-000000000000");
      for (const d of docs ?? []) track("documents", d.id, d.name);
      t.note(`documents after create: ${JSON.stringify(docs)}`);
      check(t, docs?.some((d) => d.travel_requirement_id === passportReq?.id && d.file_path), `sample.pdf attached to the new trip's Passport copy requirement (requirement ${passportReq?.id}, status ${passportReq?.status})`);
      check(t, ["Received", "Verified"].includes(passportReq?.status ?? ""), `Passport requirement status after attach = ${passportReq?.status}`);
      const rowUI = t.page.locator("div.rounded-md.border", { hasText: "Passport copy" }).first();
      const statusSel = rowUI.getByLabel(/Status for Passport copy/);
      if (await statusSel.count()) t.note(`Workflow shows Passport copy status = ${await statusSel.inputValue()}`);
      await closeModal(t);
    });

    await step(t, "new trip never reuses an older trip's file", async () => {
      wiz = await openNewTravelQuote(t);
      await fillSource(wiz);
      await pickExistingClient(wiz, t.page, "Repeat Traveler");
      if (await dismissOpenWork(t, 10_000)) t.note("Open-work dialog shown (Taiwan trip is now open) — starting new anyway");
      await wiz.getByText(/Traveler details filled from/).waitFor({ timeout: 15_000 });
      const passportRow = wiz.locator("ul.divide-y > li", { hasText: "Passport copy" }).first();
      const text = (await passportRow.textContent()) ?? "";
      check(t, !/sample\.pdf|On create|Change file/.test(text) && (await passportRow.getByRole("button", { name: "Choose file" }).count()) === 1, `Fresh quote starts with no preselected file on Passport copy (row: ${text.replace(/\s+/g, " ").trim()})`);
      await passportRow.getByRole("button", { name: "Choose file" }).click();
      const picker = t.page.getByRole("dialog", { name: "Attach requirement document" });
      await picker.waitFor();
      await t.page.waitForTimeout(2000);
      await picker.getByRole("tab", { name: "From email attachments" }).click();
      await t.page.waitForTimeout(2000);
      const listText = (await picker.locator("[aria-label='Available email attachments']").textContent().catch(() => "")) ?? "";
      const emptyMsg = await picker.getByText(/No available email attachments/).count();
      t.note(`Email tab for repeat client: ${emptyMsg ? "no available email attachments" : listText.replace(/\s+/g, " ").slice(0, 200)}`);
      check(t, !/sample\.pdf/.test(listText), "Earlier trip's device upload is not offered as an email attachment (only Inbox originals are)");
      await t.shot("picker-email-tab-repeat");
      await picker.getByRole("button", { name: "Cancel" }).click();
      await wiz.getByRole("button", { name: "Cancel" }).click();
    });
  } finally {
    const fails = await t.finish();
    if (fails) result = bugs.length > bugsAt ? "BUG" : "FAIL";
    summary.push({ section: "6.4 Requirements uploaded in the travel step", result, evidence: "Choose file → device/email tabs on each row; file attached to DB requirement only after Create" });
  }
}

/* ====================================================================== 6.5 */
async function section65() {
  const t = await startFeature("6.5-carrier-pack-references");
  let result = "PASS";
  const bugsAt = bugs.length;
  const seeds = [];
  let client, trip, userId, tripSeed, inboxTrip, inboxClient;
  try {
    await step(t, "seed issued trip + synthetic inbox emails", async () => {
      userId = await staffUserId();
      // Stored originals (requirement_attachment_sources) are immutable by DB trigger, so a seeded
      // stored part can never be deleted. Reuse the one set that already exists; never add another.
      const { data: existing } = await db.from("gmail_inbox_messages").select("id, client_id, target_id, attachments, communication_id").eq("google_subject", "qa-oct2-synthetic").eq("target_kind", "travel").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existing) {
        trip = (await db.from("travel_requests").select("*").eq("id", existing.target_id).single()).data;
        client = (await db.from("clients").select("*").eq("id", existing.client_id).single()).data;
        inboxTrip = { messageId: existing.id, communicationId: existing.communication_id, documentIds: [], storagePaths: [], attachments: existing.attachments, reused: true };
        t.note(`Reusing immutable seeded set: client ${client.id}, trip ${trip.reference_no} (${trip.id}), inbox message ${existing.id}`);
        // "Change attachment" needs a second retrievable part. Add a stored original for part 2 on
        // this already-undeletable message (no new client/message becomes immutable).
        for (const partId of ["1", "2"]) {
          const { data: src } = await db.from("requirement_attachment_sources").select("id").eq("message_id", existing.id).eq("part_id", partId).maybeSingle();
          if (src) continue;
          const fileName = existing.attachments.find((a) => a.partId === partId)?.fileName ?? `part-${partId}.pdf`;
          const path = `${client.id}/gmail/${existing.id}/qa-oct2-${partId}.pdf`;
          const up = await db.storage.from("documents").upload(path, readFileSync(SAMPLE_PDF), { contentType: "application/pdf", upsert: true });
          if (up.error) throw new Error(`storage upload: ${up.error.message}`);
          const { data: doc, error: de } = await db.from("documents").insert({ client_id: client.id, travel_request_id: trip.id, document_type: "Supporting Document", name: fileName, file_path: path, status: "Uploaded", visibility: "Internal Only", uploaded_by: userId, notes: "QA OCT2 synthetic stored original (immutable)" }).select("id").single();
          if (de) throw new Error(`documents: ${de.message}`);
          track("documents (IMMUTABLE)", doc.id, fileName);
          const { error: fe } = await db.from("gmail_inbox_filings").insert({ message_id: existing.id, part_id: partId, document_id: doc.id, purpose: "document", storage_path: path, filed_by: userId });
          if (fe) throw new Error(`gmail_inbox_filings: ${fe.message}`);
          t.note(`Added stored original for part ${partId} (${fileName}) → document ${doc.id} (immutable)`);
        }
      } else {
        client = await createTestClient("Issued Trip", { product_interest: "TravelSafe", gender: "Male", date_of_birth: "1985-07-07", lifecycle_stage: "Client", mobile_number: "09170000007", assigned_user_id: userId });
        track("clients", client.id, `${QA_PREFIX} Issued Trip`);
        tripSeed = await seedTrip(client, { destination: "Thailand", departure_date: daysFromNow(20), return_date: daysFromNow(27), status: "Policy Issued", portal_processing_status: "Issued", portal_payment_status: "Prepaid", portal_payment_method: "Card", portal_payment_reference: "QA-PORTAL-65", portal_payment_amount: 2500, policy_number: "QA-POL-65" }, { id_number: "P6565656F" });
        trip = tripSeed.trip;
        inboxTrip = await seedInboxMessage({
          client, trip, userId, targetKind: "travel", key: "trip65",
          subject: "TravelSafe policy issued — QA OCT2 Thailand",
          parts: [
            { fileName: "COVID-19 Coverage.pdf", stored: true },
            { fileName: "Travel Insurance Complete Numbers.pdf", stored: true },
            { fileName: "NOC TravelSafe Insurance.pdf", stored: false },
            { fileName: "COVID Recovery Questionnaire.pdf", stored: false },
          ],
        });
        t.note(`Seeded trip ${trip.reference_no} (${trip.id}); trip email ${inboxTrip.messageId} — part 1 stored original is IMMUTABLE (cannot be cleaned up)`);
      }
      // Client-level email without stored originals: fully deletable in teardown.
      inboxClient = await seedInboxMessage({
        client, trip, userId, targetKind: "client", key: `client65${Date.now().toString(36)}`,
        subject: "Client-level email — QA OCT2 COVID coverage",
        parts: [{ fileName: "Client forwarded documents.pdf", stored: false }],
      });
      seeds.push(inboxClient);
      t.note(`Client-level email ${inboxClient.messageId} seeded (Email original only)`);
    });

    const openWorkflow = async () => {
      await go(t, "/travel");
      await hydrated(t.page);
      const filter = t.page.getByRole("button", { name: "Policy Issued", exact: true }).first();
      if (await filter.count()) await filter.click().catch(() => {});
      await t.page.waitForTimeout(800);
      const row = t.page.locator("tr", { hasText: `${QA_PREFIX} Issued Trip` }).first();
      await row.waitFor({ timeout: 15_000 });
      await row.click();
      await t.page.getByText("Post-issuance pack", { exact: true }).waitFor({ timeout: 150_000 });
      await t.page.waitForTimeout(1000);
    };

    const dlStatus = async (href) => {
      const res = await t.page.request.get(href, { maxRedirects: 5, timeout: 120_000 });
      return { status: res.status(), type: res.headers()["content-type"] ?? "" };
    };

    await step(t, "1 upload issued policy + carrier application copy", async () => {
      await openWorkflow();
      await t.shot("workflow-open");
      const pack = t.page.locator("div.rounded-md.border", { has: t.page.getByText("Post-issuance pack", { exact: true }) }).first();
      const policyInput = pack.locator("label:has-text('issued policy PDF'), label:has-text('Policy PDF attached')").locator("input[type=file]").first();
      await policyInput.setInputFiles(SAMPLE_PDF);
      await t.page.getByText("Travel policy attached").waitFor({ timeout: 90_000 });
      const policyLink = pack.locator("a[href^='/api/documents/']", { hasText: "sample.pdf" }).first();
      await policyLink.waitFor({ timeout: 10_000 });
      const policyHref = await policyLink.getAttribute("href");
      const p = await dlStatus(policyHref);
      check(t, p.status === 200, `Issued policy downloads from ${policyHref} → ${p.status} ${p.type}`);
      const copyInput = pack.locator("label:has-text('completed application PDF'), label:has-text('Carrier application copy attached')").locator("input[type=file]").first();
      await copyInput.setInputFiles(SAMPLE_PDF);
      await t.page.getByText("Travel application copy attached").waitFor({ timeout: 90_000 });
      const copyLinks = pack.locator("a[href^='/api/documents/']", { hasText: "sample.pdf" });
      await t.page.waitForTimeout(1000);
      const hrefs = await copyLinks.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
      const copyHref = hrefs.find((h) => h !== policyHref);
      check(t, !!copyHref, `Carrier application copy listed with its own download link (${copyHref})`);
      if (copyHref) { const c = await dlStatus(copyHref); check(t, c.status === 200, `Carrier application copy downloads → ${c.status} ${c.type}`); }
      await t.shot("pack-uploaded");
      const { data: docs } = await db.from("documents").select("id, name, document_type, travel_requirement_id").eq("travel_request_id", trip.id).in("document_type", ["Travel Policy", "Travel Application Copy"]);
      for (const d of docs ?? []) track("documents", d.id, `${d.document_type}: ${d.name}`);
      check(t, docs?.some((d) => d.document_type === "Travel Policy") && docs?.some((d) => d.document_type === "Travel Application Copy"), `DB documents: ${JSON.stringify(docs?.map((d) => d.document_type))}`);
      const { data: reqs } = await db.from("travel_request_requirements").select("document_name, status").eq("travel_request_id", trip.id);
      const form = reqs?.find((r) => r.document_name === "Completed Travel application form");
      const issued = reqs?.find((r) => r.document_name === "Issued Travel policy");
      check(t, form?.status === "Pending", `Signed intake form requirement stays separate/untouched (status ${form?.status})`);
      check(t, issued?.status === "Received", `'Issued Travel policy' requirement marked ${issued?.status} by the upload`);
      const intakeRow = t.page.locator("div.rounded-md.border", { hasText: "Completed Travel application form" }).first();
      check(t, (await intakeRow.count()) === 1, "Signed intake form has its own row under 'Requirements and completed originals'");
      t.note(`Pack downloads use /api/documents/<id>/download; /api/travel/<id>/pack/<slot>/download serves carrier-library copies only (route.ts)`);
    });

    await step(t, "2 supplementary references show Not linked", async () => {
      const refs = t.page.locator("div.min-w-0.rounded-sm.border");
      const n = await refs.count();
      const texts = await refs.allTextContents();
      t.note(`Reference slots: ${JSON.stringify(texts.map((x) => x.replace(/\s+/g, " ").trim().slice(0, 80)))}`);
      check(t, n === 3 && texts.every((x) => x.includes("Not linked")), "All three categories show 'Not linked'");
      check(t, texts.some((x) => x.includes("Travel emergency numbers")) && texts.some((x) => x.includes("COVID-19 coverage")) && texts.some((x) => x.includes("TravelSafe Notification of Claim")), "Categories: Travel emergency numbers, COVID-19 coverage, TravelSafe Notification of Claim");
    });

    const covidSlot = () => t.page.locator("div.min-w-0.rounded-sm.border", { has: t.page.getByText("COVID-19 coverage", { exact: true }) }).first();

    await step(t, "3 Record from Inbox lists only this trip/client attachments with suggestion", async () => {
      await covidSlot().getByRole("button", { name: "Record from Inbox" }).click();
      const dlg = t.page.getByRole("dialog", { name: /Record COVID-19 coverage from Inbox/ });
      await dlg.waitFor();
      await t.page.waitForTimeout(2500);
      const items = dlg.locator("[aria-label='Available email attachments'] button");
      const n = await items.count();
      const texts = await items.allTextContents();
      t.note(`Candidates (${n}): ${JSON.stringify(texts.map((x) => x.replace(/\s+/g, " ").trim().slice(0, 120)))}`);
      check(t, n === 5, `Only this trip's + the client's attachments are listed (expected 5 seeded parts, got ${n})`);
      check(t, texts.every((x) => /QA OCT2/.test(x)), "No attachment from another client/trip is listed");
      const covid = items.filter({ hasText: "COVID-19 Coverage.pdf" }).first();
      check(t, /Suggested by file name/.test((await covid.textContent()) ?? ""), "'COVID-19 Coverage.pdf' is marked 'Suggested by file name'");
      const quest = items.filter({ hasText: "COVID Recovery Questionnaire.pdf" }).first();
      check(t, (await quest.count()) === 1 && !/Suggested by file name/.test((await quest.textContent()) ?? ""), "'COVID Recovery Questionnaire.pdf' is listed but never suggested");
      const numbers = items.filter({ hasText: "Travel Insurance Complete Numbers.pdf" }).first();
      t.note(`'Travel Insurance Complete Numbers.pdf' suggested for COVID slot? ${/Suggested/.test((await numbers.textContent()) ?? "")}`);
      const first = (await items.first().textContent()) ?? "";
      check(t, first.includes("COVID-19 Coverage.pdf"), "Suggested file is ordered first");
      await t.shot("record-picker");
    });

    let docCountBefore = 0;
    await step(t, "4 select, preview, Record from Inbox", async () => {
      const dlg = t.page.getByRole("dialog", { name: /Record COVID-19 coverage from Inbox/ });
      const { count } = await db.from("documents").select("*", { count: "exact", head: true }).eq("client_id", client.id);
      docCountBefore = count ?? 0;
      await dlg.locator("[aria-label='Available email attachments'] button", { hasText: "COVID-19 Coverage.pdf" }).first().click();
      await t.page.waitForTimeout(2500);
      const preview = dlg.locator("iframe[title^='Preview of COVID-19 Coverage.pdf']");
      check(t, (await preview.count()) === 1, "PDF preview iframe shown for the selection");
      const previewSrc = await preview.getAttribute("src");
      const pv = await dlStatus(previewSrc);
      check(t, pv.status === 200 && /pdf/.test(pv.type), `Preview endpoint ${previewSrc} → ${pv.status} ${pv.type}`);
      await t.shot("record-preview");
      const recordBtn = dlg.getByRole("button", { name: "Record from Inbox" });
      check(t, await recordBtn.isEnabled(), "'Record from Inbox' enabled for a trip-linked attachment without a confirmation tick");
      await recordBtn.click();
      await dlg.waitFor({ state: "hidden", timeout: 20_000 });
      const slot = covidSlot();
      const text = (await slot.textContent()) ?? "";
      check(t, text.includes("Recorded from Inbox"), "Slot shows 'Recorded from Inbox'");
      check(t, text.includes("COVID-19 Coverage.pdf") && text.includes("travelsafe-qa@pacificcross.example"), `Slot shows filename + sender: ${text.replace(/\s+/g, " ").slice(0, 200)}`);
      check(t, /\d{4}/.test(text), "Slot shows the received date");
      const links = await slot.locator("a").allTextContents();
      check(t, links.includes("View email") && links.includes("Preview") && links.includes("Download original"), `Links: ${JSON.stringify(links)}`);
      const dlHref = await slot.locator("a", { hasText: "Download original" }).getAttribute("href");
      const dl = await dlStatus(dlHref);
      check(t, dl.status === 200, `Download original ${dlHref} → ${dl.status} ${dl.type}`);
      const { count: after } = await db.from("documents").select("*", { count: "exact", head: true }).eq("client_id", client.id);
      check(t, after === docCountBefore, `No second copy uploaded (documents count ${docCountBefore} → ${after})`);
      const { data: link } = await db.from("travel_pack_reference_attachments").select("*").eq("travel_request_id", trip.id).eq("slot", "covid-coverage").maybeSingle();
      check(t, link?.message_id === inboxTrip.messageId && link?.part_id === "1" && link?.client_level === false, `DB link row: ${JSON.stringify(link)}`);
      await t.shot("recorded");
    });

    await step(t, "5 client-level email needs the confirmation tick", async () => {
      await covidSlot().getByRole("button", { name: "Change attachment" }).click();
      const dlg = t.page.getByRole("dialog", { name: /Record COVID-19 coverage from Inbox/ });
      await dlg.waitFor();
      await t.page.waitForTimeout(2500);
      const item = dlg.locator("[aria-label='Available email attachments'] button", { hasText: "Client forwarded documents.pdf" }).first();
      check(t, /Client-level email/.test((await item.textContent()) ?? ""), "Client-linked attachment is badged 'Client-level email'");
      const current = dlg.locator("[aria-label='Available email attachments'] button", { hasText: "COVID-19 Coverage.pdf" }).first();
      check(t, /Current link/.test((await current.textContent()) ?? ""), "Currently linked attachment is badged 'Current link'");
      await item.click();
      await t.page.waitForTimeout(1500);
      const recordBtn = dlg.getByRole("button", { name: "Record from Inbox" });
      check(t, await recordBtn.isDisabled(), "'Record from Inbox' disabled until the client-level confirmation is ticked");
      const tick = dlg.locator("input[type=checkbox]");
      check(t, (await tick.count()) === 1 && (await dlg.getByText(/linked to the client, not this trip/).count()) === 1, "Confirmation checkbox text explains the client-level link");
      await tick.check();
      check(t, await recordBtn.isEnabled(), "Record enabled after ticking");
      await t.shot("client-level-confirm");
      await recordBtn.click();
      const closed = await dlg.waitFor({ state: "hidden", timeout: 60_000 }).then(() => true).catch(() => false);
      if (closed) {
        const text = (await covidSlot().textContent()) ?? "";
        check(t, text.includes("Client forwarded documents.pdf") && text.includes("Client-level email"), `Slot now records the client-level attachment: ${text.replace(/\s+/g, " ").slice(0, 160)}`);
      } else {
        const err = (await dlg.getByRole("alert").textContent().catch(() => "")) ?? "";
        t.note(`BLOCKED (environment): recording the client-level part needs its bytes from Gmail (no stored original can be seeded without creating immutable rows). Server replied: "${err.trim()}"`);
        check(t, /could not be retrieved|Gmail/.test(err), "Record failure is reported in-dialog and the current reference is kept (per message text)");
        await t.shot("client-level-record-blocked");
        await dlg.getByRole("button", { name: "Cancel" }).click();
        const text = (await covidSlot().textContent()) ?? "";
        check(t, text.includes("COVID-19 Coverage.pdf") && text.includes("Recorded from Inbox"), "Existing COVID link unchanged after the failed record attempt");
      }
    });

    const tripSnapshot = async () => {
      const { data: tr } = await db.from("travel_requests").select("status, portal_processing_status, portal_payment_status, portal_payment_method, portal_payment_reference, portal_payment_amount, policy_number, quoted_premium").eq("id", trip.id).single();
      const { data: reqs } = await db.from("travel_request_requirements").select("document_name, status").eq("travel_request_id", trip.id).order("sort_order");
      const { count: docs } = await db.from("documents").select("*", { count: "exact", head: true }).eq("travel_request_id", trip.id);
      const { data: links } = await db.from("travel_pack_reference_attachments").select("slot, part_id, message_id").eq("travel_request_id", trip.id).order("slot");
      return { tr, reqs, docs, links };
    };

    await step(t, "7a Inbox 'Correct link' blocked while the reference is linked", async () => {
      await t.page.getByRole("button", { name: "Close", exact: true }).last().click();
      await go(t, `/inbox?message=${inboxTrip.messageId}`);
      await settle(t.page, 2500);
      await t.shot("inbox-message");
      const correct = t.page.getByRole("button", { name: "Correct link" });
      check(t, (await correct.count()) === 1, "'Correct link' control present on the linked email");
      await correct.click();
      const select = t.page.getByLabel("Which record is this email about?");
      await select.waitFor({ timeout: 10_000 });
      const options = await select.locator("option").evaluateAll((els) => els.map((o) => ({ value: o.value, text: o.textContent })));
      const target = options.find((o) => o.value && o.text?.includes(trip.reference_no)) ?? options.find((o) => o.value && /QA OCT2 Issued Trip/.test(o.text ?? "") && !/client ·/i.test(o.text ?? "")) ?? options.find((o) => o.value && /QA OCT2/.test(o.text ?? ""));
      t.note(`Correction target chosen: ${JSON.stringify(target)} (of ${options.length} options)`);
      if (!target) throw new Error("no alternative record option for correction");
      await select.selectOption(target.value);
      await t.page.getByRole("button", { name: "Review correction impact" }).click();
      const blocked = t.page.getByText("Correction blocked");
      await blocked.waitFor({ timeout: 20_000 });
      const alert = (await t.page.getByRole("alert").filter({ hasText: "Correction blocked" }).textContent()) ?? "";
      check(t, /Travel supplementary reference/.test(alert) && alert.includes(trip.reference_no), `Correction blocked with: ${alert.replace(/\s+/g, " ").slice(0, 260)}`);
      check(t, await t.page.getByRole("button", { name: "Confirm reviewed correction" }).isDisabled(), "'Confirm reviewed correction' stays disabled");
      await t.shot("correct-link-blocked");
    });

    await step(t, "6 Change attachment and Unlink change nothing else", async () => {
      await openWorkflow();
      const before = await tripSnapshot();
      const currentText = (await covidSlot().textContent()) ?? "";
      const swapTo = currentText.includes("Client forwarded documents") ? "COVID-19 Coverage.pdf" : "Travel Insurance Complete Numbers.pdf";
      await covidSlot().getByRole("button", { name: "Change attachment" }).click();
      const dlg = t.page.getByRole("dialog", { name: /Record COVID-19 coverage from Inbox/ });
      await dlg.waitFor();
      await t.page.waitForTimeout(2500);
      await dlg.locator("[aria-label='Available email attachments'] button", { hasText: swapTo }).first().click();
      await t.page.waitForTimeout(1000);
      await dlg.getByRole("button", { name: "Record from Inbox" }).click();
      await dlg.waitFor({ state: "hidden", timeout: 60_000 });
      let text = (await covidSlot().textContent()) ?? "";
      check(t, text.includes(swapTo) && text.includes("Recorded from Inbox"), `Change attachment swaps the link to "${swapTo}"`);
      const mid = await tripSnapshot();
      check(t, JSON.stringify(mid.tr) === JSON.stringify(before.tr) && JSON.stringify(mid.reqs) === JSON.stringify(before.reqs) && mid.docs === before.docs, "Trip fields, checklist and documents unchanged after Change attachment");
      check(t, mid.links.length === 1 && mid.links[0].message_id === inboxTrip.messageId, `Only the covid-coverage link changed: ${JSON.stringify(mid.links)}`);
      await covidSlot().getByRole("button", { name: "Unlink" }).click();
      await covidSlot().getByText("Not linked").waitFor({ timeout: 15_000 });
      text = (await covidSlot().textContent()) ?? "";
      check(t, text.includes("Not linked") && !text.includes("Recorded from Inbox"), "Unlink returns the slot to 'Not linked'");
      const after = await tripSnapshot();
      check(t, JSON.stringify(after.tr) === JSON.stringify(before.tr) && JSON.stringify(after.reqs) === JSON.stringify(before.reqs) && after.docs === before.docs && after.links.length === 0, "Unlink removed only the association; trip, checklist and documents untouched");
      const { count: msgs } = await db.from("gmail_inbox_messages").select("*", { count: "exact", head: true }).eq("id", inboxTrip.messageId);
      check(t, msgs === 1, "Source email still exists after Unlink");
      await t.shot("unlinked");
      // re-link for the agent read-only + library checks below
      await covidSlot().getByRole("button", { name: "Record from Inbox" }).click();
      const dlg2 = t.page.getByRole("dialog", { name: /Record COVID-19 coverage from Inbox/ });
      await dlg2.waitFor();
      await t.page.waitForTimeout(2500);
      await dlg2.locator("[aria-label='Available email attachments'] button", { hasText: "COVID-19 Coverage.pdf" }).first().click();
      await t.page.waitForTimeout(800);
      await dlg2.getByRole("button", { name: "Record from Inbox" }).click();
      await dlg2.waitFor({ state: "hidden", timeout: 20_000 });
    });

    await step(t, "8 Library copy links stay listed separately", async () => {
      const slots = t.page.locator("div.min-w-0.rounded-sm.border");
      const libLinks = slots.locator("a[href*='/pack/']");
      const n = await libLinks.count();
      const texts = await libLinks.allTextContents();
      t.note(`Library copy links: ${JSON.stringify(texts.map((x) => x.replace(/\s+/g, " ").trim()))}`);
      check(t, n >= 1 && texts.every((x) => x.startsWith("Library copy ·")), "Carrier-library versions are listed as 'Library copy · …' separately from Inbox links");
      const nocSlot = slots.filter({ has: t.page.getByText("TravelSafe Notification of Claim", { exact: true }) }).first();
      const nocText = (await nocSlot.textContent()) ?? "";
      check(t, nocText.includes("Not linked") && /Library copy · TravelSafe Notification of Claim/.test(nocText), "NOC slot shows 'Not linked' and its library copy side by side");
      if (n) {
        const href = await libLinks.first().getAttribute("href");
        const r = await dlStatus(href);
        check(t, r.status === 200, `Library copy download ${href} → ${r.status} ${r.type}`);
      }
      await t.shot("library-copies");
      await closeModal(t);
    });

    await step(t, "7b View as Agent → read-only", async () => {
      const profileBtn = t.page.locator("button", { has: t.page.locator("span", { hasText: /^Admin$/ }) }).last();
      await profileBtn.click();
      await t.page.getByText("View as", { exact: true }).waitFor({ timeout: 10_000 });
      await t.page.getByRole("button", { name: "Agent", exact: true }).click();
      await t.page.waitForTimeout(1500);
      await t.shot("view-as-agent");
      await openWorkflow();
      const packText = (await t.page.locator("div.rounded-md.border", { has: t.page.getByText("Post-issuance pack", { exact: true }) }).first().textContent()) ?? "";
      const readOnly = /Read-only/.test(packText);
      const hasEditButtons = (await t.page.getByRole("button", { name: /Record from Inbox|Change attachment|Unlink/ }).count()) > 0;
      const hasUploads = (await t.page.locator("label:has-text('Upload the issued policy PDF'), label:has-text('Policy PDF attached')").count()) > 0;
      t.note(`As Agent preview: read-only text=${readOnly}, reference edit buttons=${hasEditButtons}, policy upload control=${hasUploads}`);
      if (readOnly && !hasEditButtons && !hasUploads) t.pass("Travel workflow post-issuance pack is read-only under the Agent persona");
      else {
        bug(t, `View as → Agent: Post-issuance pack is NOT read-only (read-only text=${readOnly}, Record/Change/Unlink buttons=${hasEditButtons}, upload control=${hasUploads}). canFilePostIssuance is derived from the server role (actions.ts:147) so the client-side persona preview does not narrow it. Screenshot: qa-oct2/videos/6.5-carrier-pack-references/agent-workflow.png`);
      }
      await t.shot("agent-workflow");
      await closeModal(t);
      // restore persona
      await profileBtn.click();
      await t.page.getByText("View as", { exact: true }).waitFor({ timeout: 10_000 });
      await t.page.getByRole("button", { name: "Admin · Owner" }).click();
      await t.page.waitForTimeout(800);
      const persona = await t.page.evaluate(() => localStorage.getItem("pi_persona"));
      check(t, !persona || /admin/.test(persona), `Persona restored to Admin (pi_persona=${persona})`);
    });

    await step(t, "unlink + teardown inbox seed", async () => {
      const { error } = await db.from("travel_pack_reference_attachments").delete().eq("travel_request_id", trip.id);
      if (error) throw new Error(error.message);
      await teardownInbox(seeds, t);
    });
  } finally {
    if (seeds.length) await teardownInbox(seeds, t).catch(() => {});
    const fails = await t.finish();
    if (fails) result = bugs.length > bugsAt ? "BUG" : "FAIL";
    summary.push({ section: "6.5 Carrier policy, application copy and reference emails", result, evidence: "Policy + application copy upload/download, Not linked, Record from Inbox (suggested, recorded, change, unlink), Correct link blocked, library copies" });
  }
}

/* ====================================================================== 6.6 */
async function section66() {
  const t = await startFeature("6.6-payment-method");
  let result = "PASS";
  const bugsAt = bugs.length;
  let client, trip;
  try {
    await step(t, "seed trip", async () => {
      client = await createTestClient("Payment Trip", { product_interest: "TravelSafe", gender: "Female", date_of_birth: "1991-11-11", lifecycle_stage: "Client", mobile_number: "09170000008" });
      track("clients", client.id, `${QA_PREFIX} Payment Trip`);
      ({ trip } = await seedTrip(client, { destination: "Vietnam", quoted_premium: 3100 }, { id_number: "P6666666G" }));
    });

    const openWorkflow = async () => {
      await go(t, "/travel");
      await hydrated(t.page);
      const row = t.page.locator("tr", { hasText: `${QA_PREFIX} Payment Trip` }).first();
      await row.waitFor({ timeout: 15_000 });
      await row.click();
      await t.page.getByText("Portal processing", { exact: true }).waitFor({ timeout: 150_000 });
      await t.page.waitForTimeout(1000);
    };

    for (const method of ["Card", "GCash", "Over the counter"]) {
      await step(t, `1 set payment method ${method}`, async () => {
        await openWorkflow();
        const sel = t.page.getByLabel("Payment method");
        const opts = await sel.locator("option").allTextContents();
        if (method === "Card") check(t, opts.includes("Card") && opts.includes("GCash") && opts.includes("Over the counter"), `Payment method options: ${JSON.stringify(opts)}`);
        await sel.selectOption(method);
        await t.page.getByRole("button", { name: "Save workflow" }).click();
        await t.page.getByText("Travel workflow updated").waitFor({ timeout: 15_000 });
        const { data } = await db.from("travel_requests").select("portal_payment_method").eq("id", trip.id).single();
        check(t, data?.portal_payment_method === method, `Saved portal_payment_method = ${data?.portal_payment_method}`);
        await closeModal(t);
        await t.page.waitForTimeout(1500);
        const row = t.page.locator("tr", { hasText: `${QA_PREFIX} Payment Trip` }).first();
        const premiumCell = row.locator("td").last();
        const cellText = (await premiumCell.textContent())?.replace(/\s+/g, " ").trim();
        check(t, cellText?.includes(method) && /3,100/.test(cellText), `Travel list premium cell shows method under the premium: "${cellText}"`);
      });
    }
    await t.shot("list-with-method");

    await step(t, "2 Issued requires a policy number", async () => {
      await openWorkflow();
      await t.page.getByLabel("Portal status").selectOption("Issued");
      await t.page.getByLabel("Policy number").fill("");
      check(t, (await t.page.getByLabel("Policy number").getAttribute("placeholder")) === "Policy number (required)", "Policy number placeholder flips to '(required)' when Issued");
      await t.page.getByRole("button", { name: "Save workflow" }).click();
      const alert = t.page.locator("#travel-policy-number-error");
      await alert.waitFor({ timeout: 10_000 });
      check(t, /Enter the policy number/.test((await alert.textContent()) ?? ""), `Blocked: "${(await alert.textContent())?.trim()}"`);
      const { data: still } = await db.from("travel_requests").select("portal_processing_status, status").eq("id", trip.id).single();
      check(t, still?.portal_processing_status === "Not Started" && still?.status === "Awaiting Payment", `Nothing saved without a policy number (${JSON.stringify(still)})`);
      await t.shot("issued-blocked");
      await t.page.getByLabel("Policy number").fill("QA-POL-66");
      await t.page.getByRole("button", { name: "Save workflow" }).click();
      await t.page.getByText("Travel workflow updated").waitFor({ timeout: 15_000 });
      const { data: done } = await db.from("travel_requests").select("portal_processing_status, status, policy_number, portal_payment_method").eq("id", trip.id).single();
      check(t, done?.portal_processing_status === "Issued" && done?.status === "Policy Issued" && done?.policy_number === "QA-POL-66", `Saved with policy number: ${JSON.stringify(done)}`);
      check(t, done?.portal_payment_method === "Over the counter", "Payment method preserved through the Issued save");
      await t.shot("issued-saved");
      await closeModal(t);
    });
  } finally {
    const fails = await t.finish();
    if (fails) result = bugs.length > bugsAt ? "BUG" : "FAIL";
    summary.push({ section: "6.6 Travel payment method", result, evidence: "Card/GCash/OTC saved and shown under premium on the list; Issued blocked without policy number" });
  }
}

/* ====================================================================== main */
let seed63Data = null;
if (run("6.1")) await section61();
if (run("6.2")) await section62();
if (run("6.3") || run("6.4")) seed63Data = await seed63();
if (run("6.3")) await section63(seed63Data);
if (run("6.4")) await section64(seed63Data);
if (run("6.5")) await section65();
if (run("6.6")) await section66();

const lines = [
  "# 6 Travel — run summary",
  "",
  `Run: ${new Date().toISOString()}${ONLY ? ` (only ${ONLY})` : ""}`,
  "",
  "| Sub-section | Result | Evidence |",
  "|---|---|---|",
  ...summary.map((s) => `| ${s.section} | ${s.result} | ${s.evidence} |`),
  "",
  "## Bugs & errors",
  "",
  ...(bugs.length ? bugs.map((b, i) => `${i + 1}. ${b}`) : ["(see per-feature reports for FAIL lines)"]),
  "",
  "## Created records",
  "",
  "| Table | Id / reference | Label |",
  "|---|---|---|",
  ...created.map((c) => `| ${c.table} | ${c.id} | ${c.label} |`),
  "",
];
const { writeFileSync } = await import("node:fs");
writeFileSync(new URL("./reports/06-travel-RUN.md", import.meta.url), lines.join("\n"));
console.log(lines.join("\n"));
