/**
 * Verification for the K7 papercut fixes (L1, L3, L4, L5, L6, L8).
 *
 *   node --env-file=.env.local qa-oct2/fix-papercuts.mjs
 */
import { createTestClient, db, QA_PREFIX, SAMPLE_PDF, settle, startFeature } from "./lib.mjs";

const t = await startFeature("fix-papercuts");
const { page } = t;
page.on("dialog", (d) => d.accept());
t.context.setDefaultTimeout(60_000);
t.context.setDefaultNavigationTimeout(150_000);
const created = [];
const nav = async (path, ms = 2500) => {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await settle(page, ms);
};
const step = async (name, fn) => {
  try {
    await fn();
  } catch (err) {
    t.fail(`${name}: ${String(err?.message ?? err).split("\n")[0]}`);
    await t.shot(`fail-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`).catch(() => {});
  }
};
const check = (ok, text) => (ok ? t.pass(text) : t.fail(text));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RUN = Date.now().toString(36).slice(-4);

/* Server actions POST to the page URL with a `next-action` header; slowing them makes the
   transient loading states observable. */
let actionDelayMs = 0;
await page.route("**/*", async (route) => {
  const req = route.request();
  if (actionDelayMs && req.method() === "POST" && req.headers()["next-action"]) {
    await new Promise((r) => setTimeout(r, actionDelayMs));
  }
  await route.continue();
});

/* ============================================================ L1 ===== */
await step("L1 proposal card past Proposal stage", async () => {
  const lead = await createTestClient(`PapercutL1 ${RUN}`, {
    product_interest: "Select",
    select_variant: "Select Plus",
    coverage_tier: "Semi-private",
    date_of_birth: "1990-01-01",
    gender: "Male",
    lead_stage: "Product Selected",
    lead_status: "Qualified",
  });
  created.push({ table: "clients", id: lead.id, label: `${lead.first_name} ${lead.last_name}` });
  await nav(`/clients/${lead.id}?from=prospects`);
  const before = page.getByText("Proposal actions are available once this lead reaches the");
  check((await before.count()) === 0, "No proposal yet: the old stage footnote is not shown");
  await page.getByRole("button", { name: "Generate Proposal", exact: true }).click();
  await page.getByRole("heading", { name: "Generate proposal" }).waitFor();
  const freq = page.locator("div:has(> label:has-text('Payment frequency')) > select");
  for (let i = 0; i < 40 && (await freq.inputValue()) === ""; i++) await page.waitForTimeout(500);
  await freq.selectOption("Semi-annual");
  const popup = t.context.waitForEvent("page", { timeout: 15_000 }).catch(() => null);
  await page.getByRole("button", { name: "Generate in Pacific Cross" }).click();
  (await popup)?.close().catch(() => {});
  await page.getByText("Details to encode").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByRole("button", { name: "Upload later" }).click();
  await settle(page, 2000);
  const { data } = await db.from("clients").select("proposal_status, lead_stage").eq("id", lead.id).single();
  t.note(`DB after generate: proposal_status=${data?.proposal_status} lead_stage=${data?.lead_stage}`);
  const card = page.locator("div", { has: page.getByText("Proposal tracking", { exact: true }) }).last();
  const mark = page.getByRole("button", { name: "Mark Received without PDF" });
  await mark.waitFor({ state: "visible", timeout: 30_000 });
  check(true, 'Product Selected lead with proposal Requested offers "Mark Received without PDF"');
  check((await page.getByText("Upload the proposal PDF…").count()) === 1, "…and the proposal PDF upload");
  check((await page.getByText("Proposal actions are available once this lead reaches the").count()) === 0, "Old 'available once … Proposal stage' footnote gone");
  const note = await page.getByText(/This lead is at the/).first().textContent().catch(() => "");
  check(/Product Selected/.test(note ?? ""), `Stage note reads: "${note?.trim()}"`);
  void card;
  await t.shot("L1-product-selected-requested");
  await mark.click();
  await page.getByRole("button", { name: "Email proposal" }).waitFor({ state: "visible", timeout: 60_000 });
  check(true, "Mark Received moves the card on (Email proposal / Mark sent manually offered)");
  await t.shot("L1-after-mark-received");
});

/* ============================================================ L3/L4 ===== */
const wiz = () => page.getByRole("dialog", { name: "New Client Application" });
const byLabel = (scope, label) => scope.getByLabel(new RegExp(`^${esc(label)}( \\*)?\\s*$`));
const fieldSelect = (label) => byLabel(wiz(), label);
await step("L3 wizard dialog semantics + L4 Step 4 loading", async () => {
  await nav("/applications");
  const btns = page.getByRole("button", { name: "New application" });
  await btns.nth((await btns.count()) - 1).click();
  await wiz().waitFor({ state: "visible" });
  check(true, 'getByRole("dialog", { name: "New Client Application" }) resolves the wizard');
  check((await wiz().getAttribute("aria-modal")) === "true", "aria-modal=true on the wizard");
  check((await wiz().getByRole("button", { name: "Close", exact: true }).count()) === 1, 'Close "×" has accessible name "Close"');
  const labelled = ["Application type", "Source", "Product", "Assigned agent", "Application priority"];
  for (const label of labelled) {
    const n = await fieldSelect(label).count();
    check(n === 1 && (await fieldSelect(label).evaluate((el) => el.tagName)) === "SELECT", `getByLabel("${label}") reaches the <select>`);
  }
  await t.shot("L3-wizard-dialog");

  await fieldSelect("Application type").selectOption({ label: "New Insurance Application" });
  await fieldSelect("Source").selectOption({ label: "Referral" });
  await page.waitForTimeout(500);
  // Slow the template-preview action so the loading state is observable, then watch Step 4.
  actionDelayMs = 4000;
  const rail = wiz().locator("button").filter({ hasText: /^(\d\s*)?Requirements$/ });
  await fieldSelect("Product").selectOption({ label: "BC Flexi" });
  await rail.click();
  const seen = { old: 0, loading: 0, rows: 0 };
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const body = (await wiz().innerText()).replace(/\s+/g, " ");
    if (body.includes("Select a product in Step 1 to generate the checklist.")) seen.old++;
    if (body.includes("Loading the requirement checklist for BC Flexi")) {
      if (!seen.loading) await t.shot("L4-step4-loading");
      seen.loading++;
    }
    if (body.includes("Proposal Information Sheet")) { seen.rows++; break; }
    await page.waitForTimeout(100);
  }
  actionDelayMs = 0;
  check(seen.loading > 0, `Step 4 showed the loading state while the BC Flexi template loaded (${seen.loading} polls)`);
  check(seen.old === 0, `Old "Select a product in Step 1…" text never appeared (${seen.old} polls)`);
  check(seen.rows > 0, "BC Flexi checklist rows rendered after the load");
  await t.shot("L4-step4-loaded");
  await wiz().getByRole("button", { name: "Close", exact: true }).click();
  await page.waitForTimeout(800);
  check((await wiz().count()) === 0, "Close button closes the wizard");
});

/* ============================================================ L5 ===== */
await step("L5 workflow Step 6 loading state", async () => {
  const client = await createTestClient(`PapercutL5 ${RUN}`, {
    lifecycle_stage: "Client",
    client_type: "Individual Client",
    product_interest: "Select",
    gender: "Male",
    date_of_birth: "1988-05-05",
  });
  created.push({ table: "clients", id: client.id, label: `${client.first_name} ${client.last_name}` });
  const { data: plan, error: planErr } = await db.from("plan_options").select("id, product_version_id").eq("plan_name", "Select Plus Ward").eq("status", "Active").single();
  if (planErr) throw new Error(planErr.message);
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const app = await db.from("applications").insert({
    client_id: client.id, product_version_id: plan.product_version_id, plan_option_id: plan.id, application_type: "Standard", status: "Approved",
    coverage_type: "Individual", date_started: todayIso, date_submitted: todayIso, desired_start_date: todayIso, preferred_payment_mode: "Annual",
    estimated_premium: 45000, pre_existing_status: "No", smoker_status: "Never",
  }).select("*").single();
  if (app.error) throw new Error(app.error.message);
  created.push({ table: "applications", id: app.data.id, label: app.data.reference_no });
  const pay = await db.from("payments").insert({
    client_id: client.id, application_id: app.data.id, amount: 45000, currency: "PHP", status: "Verified", payment_method: "Bank Transfer",
    payment_date: todayIso, or_number: `QAOCT2-OR-${RUN}`, or_received_date: todayIso,
  }).select("*").single();
  if (pay.error) throw new Error(pay.error.message);
  created.push({ table: "payments", id: pay.data.id, label: pay.data.reference_no });

  await nav("/applications");
  const row = page.locator("tr", { hasText: `${QA_PREFIX} PapercutL5 ${RUN}` }).first();
  actionDelayMs = 4000;
  await row.getByRole("button", { name: "Requirements" }).click();
  const dialog = page.getByRole("dialog", { name: "Application workflow" });
  await dialog.waitFor({ state: "visible" });
  const seen = { stillNeeded: 0, loading: 0, settled: false, disabledWhileLoading: 0 };
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const text = (await dialog.innerText()).replace(/\s+/g, " ");
    if (/Still needed: Select variant/.test(text)) seen.stillNeeded++;
    if (text.includes("Loading product options…")) {
      if (!seen.loading) await t.shot("L5-step6-loading");
      seen.loading++;
      if (await dialog.getByRole("button", { name: "Log policy & convert" }).isDisabled().catch(() => false)) seen.disabledWhileLoading++;
    }
    if (!text.includes("Loading product options") && (await dialog.getByRole("button", { name: "Log policy & convert" }).isEnabled().catch(() => false))) { seen.settled = true; break; }
    await page.waitForTimeout(100);
  }
  actionDelayMs = 0;
  check(seen.loading > 0, `Step 6 showed "Loading product options…" while listProductOptionsAction was pending (${seen.loading} polls)`);
  check(seen.stillNeeded === 0, `"Still needed: Select variant, matching active plan" never appeared (${seen.stillNeeded} polls)`);
  check(seen.settled, "Once options arrived: variant/plan prefilled and \"Log policy & convert\" enabled");
  await t.shot("L5-step6-loaded");
  await dialog.getByRole("button", { name: "Close" }).click().catch(() => {});
});

/* ============================================================ L6 ===== */
await step("L6 Policies card PDF link opens in a new tab", async () => {
  // Reuse an existing QA policy that has a Policy Copy; otherwise seed one and attach via the UI.
  const { data: qaClients } = await db.from("clients").select("id").ilike("first_name", `${QA_PREFIX}%`);
  const ids = (qaClients ?? []).map((c) => c.id);
  let clientId = null;
  if (ids.length) {
    const { data: docs } = await db.from("documents").select("client_id, policy_id").eq("document_type", "Policy Copy").in("client_id", ids).not("policy_id", "is", null).limit(1);
    clientId = docs?.[0]?.client_id ?? null;
  }
  if (!clientId) {
    const client = await createTestClient(`PapercutL6 ${RUN}`, { lifecycle_stage: "Client", client_type: "Individual Client", product_interest: "Select" });
    created.push({ table: "clients", id: client.id, label: `${client.first_name} ${client.last_name}` });
    const { data: plan } = await db.from("plan_options").select("id, product_version_id").eq("plan_name", "Select Plus Ward").eq("status", "Active").single();
    const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const pol = await db.from("policies").insert({ client_id: client.id, product_version_id: plan.product_version_id, plan_option_id: plan.id, policy_number: `QAOCT2-L6-${RUN}`, status: "Active", premium_amount: 30000, currency: "PHP", payment_mode: "Annual", effective_date: todayIso, expiry_date: todayIso }).select("*").single();
    if (pol.error) throw new Error(pol.error.message);
    created.push({ table: "policies", id: pol.data.id, label: `${pol.data.reference_no} (+ DB renewal/payment automation rows)` });
    await nav(`/clients/${client.id}`);
    await page.getByRole("button", { name: "Attach PDF" }).first().click();
    await page.locator("input[type=file]").first().setInputFiles(SAMPLE_PDF);
    await page.getByText("Policy copy attached").first().waitFor({ state: "visible", timeout: 30_000 });
    const { data: docs } = await db.from("documents").select("id, reference_no").eq("policy_id", pol.data.id);
    for (const d of docs ?? []) created.push({ table: "documents", id: d.id, label: d.reference_no });
    clientId = client.id;
  }
  await nav(`/clients/${clientId}`);
  const link = page.getByRole("link", { name: /PDF/ }).filter({ has: page.locator("svg") }).first();
  await link.waitFor({ state: "visible", timeout: 60_000 });
  check((await link.getAttribute("target")) === "_blank", `Policies card PDF link target="${await link.getAttribute("target")}"`);
  check((await link.getAttribute("rel")) === "noopener", `rel="${await link.getAttribute("rel")}"`);
  // target=_blank on a download route: Chromium may surface it as a popup page or a download.
  const popup = page.waitForEvent("popup", { timeout: 15_000 }).catch(() => null);
  const download = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
  await link.click();
  const opened = await Promise.race([popup, download]);
  check(!!opened, `Plain click opens a new tab/download (${opened?.url ? "popup" : "download"}); the profile tab stays put`);
  check(page.url().includes(`/clients/${clientId}`), `Profile tab still at ${page.url()}`);
  await opened?.close?.().catch(() => {});
  await t.shot("L6-policies-pdf-link");
});

/* ============================================================ L8 ===== */
await step("L8 travel wizard Existing → New clears Traveler 1", async () => {
  const repeat = await createTestClient(`PapercutL8 ${RUN}`, { product_interest: "TravelSafe", gender: "Female", date_of_birth: "1988-05-20", lifecycle_stage: "Client", mobile_number: "09170000004" });
  created.push({ table: "clients", id: repeat.id, label: `${repeat.first_name} ${repeat.last_name}` });
  await nav("/travel");
  const twiz = page.getByRole("dialog", { name: "New Travel Insurance Request" });
  for (let attempt = 1; attempt <= 4 && !(await twiz.count()); attempt++) {
    await page.getByRole("button", { name: "New travel quote" }).click();
    await twiz.waitFor({ timeout: 20_000 }).catch(() => {});
  }
  await twiz.waitFor({ state: "visible" });
  check(true, 'getByRole("dialog", { name: "New Travel Insurance Request" }) resolves the travel wizard');
  await page.waitForTimeout(2000);
  const source = byLabel(twiz, "Source");
  if (!(await source.inputValue())) await source.selectOption({ index: 1 });
  await twiz.getByRole("button", { name: "Existing client" }).click();
  await twiz.getByPlaceholder("Search a client…").fill(`PapercutL8 ${RUN}`);
  const hit = twiz.getByRole("button", { name: new RegExp(esc(`PapercutL8 ${RUN}`)) }).first();
  await hit.waitFor({ timeout: 15_000 });
  await hit.click();
  await twiz.getByText(/Traveler details filled from/).waitFor({ timeout: 20_000 });
  const filledName = await twiz.getByLabel("Traveler 1 name").inputValue();
  check(filledName === `${QA_PREFIX} PapercutL8 ${RUN}`, `Existing client auto-fills Traveler 1: "${filledName}"`);
  await t.shot("L8-existing-filled");

  await twiz.getByRole("button", { name: "New client" }).click();
  await page.waitForTimeout(600);
  check((await twiz.getByText(/Traveler details filled from/).count()) === 0, "Fill note disappears after switching to New client");
  const rows = await twiz.locator("input[aria-label$=' name']").count();
  check(rows === 0, `Traveler rows after switching to New client: ${rows} (auto-filled Traveler 1 cleared)`);
  const passport = await byLabel(twiz, "Passport number").inputValue().catch(async () => (await twiz.locator("label:has-text('Passport number') + input").inputValue().catch(() => "")));
  check(passport === "", `Passport field after switch: "${passport}"`);
  await t.shot("L8-after-new-client");

  await byLabel(twiz, "First name").fill(QA_PREFIX);
  await byLabel(twiz, "Last name").fill(`ManualL8 ${RUN}`);
  await byLabel(twiz, "Mobile number").fill("09170000006");
  await twiz.getByRole("button", { name: "Use applicant" }).click();
  const names = await twiz.locator("input[aria-label$=' name']").evaluateAll((els) => els.map((e) => [e.getAttribute("aria-label"), e.value]));
  check(names.length === 1 && names[0][0] === "Traveler 1 name" && names[0][1] === `${QA_PREFIX} ManualL8 ${RUN}`, `Use applicant fills Traveler 1 (not 2): ${JSON.stringify(names)}`);
  await t.shot("L8-use-applicant");
  await twiz.getByRole("button", { name: "Cancel" }).click().catch(() => {});
});

t.note(`QA rows created: ${created.map((c) => `${c.table}:${c.id} (${c.label})`).join("; ") || "none"}`);
const fails = await t.finish();
process.exit(fails ? 1 : 0);
