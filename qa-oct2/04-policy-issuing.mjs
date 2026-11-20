/**
 * TESTING-OCT2.md §4.1 — Log policy copy and retrieve the PDF (H4a).
 *
 *   node --env-file=.env.local qa-oct2/04-policy-issuing.mjs
 */
import { basename } from "node:path";

import { createTestClient, db, SAMPLE_PDF, settle, startFeature } from "./lib.mjs";

const t = await startFeature("4.1-log-policy-copy");
const { page } = t;
// The dev server is shared with sibling test runs; first compiles can take well over 20s.
t.context.setDefaultTimeout(60_000);
const nav = async (path, ms = 2500) => {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 150_000 });
  await settle(page, ms);
};
const created = []; // { table, id, ref }

const step = async (name, fn) => {
  try {
    await fn();
  } catch (err) {
    t.fail(`${name}: ${err.message.split("\n")[0]}`);
    await t.shot(`fail-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`).catch(() => {});
  }
};

/** The control that follows an uppercase <Field label> (labels are not htmlFor-linked). */
const control = (root, label) => root.locator("label", { hasText: label }).first().locator("xpath=following-sibling::*[1]");
const drawerOf = (title) => page.locator("div.fixed.inset-0").filter({ has: page.locator("h2", { hasText: title }) });
const policyBlock = (no) => page.locator("div")
  .filter({ has: page.getByRole("button", { name: `Edit policy ${no}` }) })
  .filter({ has: page.locator("span.font-mono", { hasText: no }) })
  .last();
const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const plusOneYear = (() => { const d = new Date(todayIso); d.setUTCFullYear(d.getUTCFullYear() + 1); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();

/* ---------- seed ---------- */
const RUN = `H4a${Date.now().toString(36).slice(-4)}`;
const LABEL = `PolCopy ${RUN}`;
const FULL_NAME = `QA OCT2 ${LABEL}`;
const client = await createTestClient(LABEL, {
  lifecycle_stage: "Client",
  client_type: "Individual Client",
  product_interest: "Select",
  gender: "Male",
  date_of_birth: "1988-05-05",
});
created.push({ table: "clients", id: client.id, ref: client.reference_no });
t.note(`Seeded client ${client.reference_no} (${client.id}) lifecycle=Client`);

const { data: selectPlans, error: planErr } = await db
  .from("plan_options")
  .select("id, product_version_id, plan_name, plan_family")
  .in("plan_name", ["Select Plus Ward", "Select Standard Ward"])
  .eq("status", "Active");
if (planErr) throw new Error(planErr.message);
const selectPlusWard = selectPlans.find((p) => p.plan_name === "Select Plus Ward");
const selectStandardWard = selectPlans.find((p) => p.plan_name === "Select Standard Ward");
const SELECT_VERSION_ID = selectPlusWard.product_version_id;

/* ---------- step 1: /policies → Log policy copy ---------- */
let policy1 = null;
await step("Open Log policy copy drawer", async () => {
  await nav("/policies");
  const heading = page.getByRole("heading", { name: "Policies" }).first();
  if (!(await heading.isVisible())) throw new Error("Policies heading not visible");
  const issueWording = await page.getByRole("button", { name: /issue policy/i }).count();
  if (issueWording) t.bug(`/policies still has an "Issue policy" button (${issueWording})`);
  else t.pass('/policies has no "Issue policy" button');
  const primary = page.getByRole("button", { name: "Log policy copy" }).first();
  if (!(await primary.isVisible())) throw new Error('"Log policy copy" primary button not visible');
  t.pass('Policies page primary action reads "Log policy copy"');
  await primary.click();
  const drawer = drawerOf("Log policy copy");
  await drawer.waitFor({ state: "visible" });
  t.pass('Drawer titled "Log policy copy" opened');
  await t.shot("01-drawer-open");
});

await step("Fill client, product, policy number, dates, attach PDF", async () => {
  const drawer = drawerOf("Log policy copy");
  // Client picker (debounced search over first/last name)
  const search = drawer.getByPlaceholder("Search a client…");
  await search.fill(LABEL);
  const hit = drawer.getByRole("button", { name: FULL_NAME }).first();
  await hit.waitFor({ state: "visible" });
  await hit.click();
  if (!(await drawer.getByText(FULL_NAME).first().isVisible())) throw new Error("picked client not shown");
  t.pass("Client picker found and selected the QA client");

  // Product (native select) → Select; then variant + plan
  const productSel = control(drawer, "Product");
  await productSel.waitFor({ state: "visible" });
  // options load async
  await page.waitForFunction(() => {
    const sels = [...document.querySelectorAll("select")];
    return sels.some((s) => [...s.options].some((o) => o.textContent?.trim() === "Select"));
  }, null, { timeout: 15_000 });
  await productSel.selectOption({ label: "Select" });
  const variantSel = control(drawer, "Select variant");
  if (!(await variantSel.isVisible())) throw new Error("Select variant field did not appear for Select");
  t.pass('Choosing product "Select" reveals the Select variant field');
  await variantSel.selectOption({ label: "Select Plus" });
  const planSel = control(drawer, "Plan option");
  await planSel.selectOption({ label: "Select Plus Ward" });
  const planOptions = await planSel.locator("option").allTextContents();
  if (planOptions.some((o) => /Select Standard/.test(o))) t.bug(`Plan option list for Select Plus still lists Standard plans: ${planOptions.join(", ")}`);
  else t.pass(`Plan options filtered to the variant: ${planOptions.filter(Boolean).join(", ")}`);

  await control(drawer, "Pacific Cross policy no.").fill("QAOCT2-POL-001");
  await control(drawer, "Premium (₱)").fill("45000");
  await control(drawer, "Effective date").fill(todayIso);
  const expiryVal = await control(drawer, "Expiry date").inputValue();
  if (expiryVal === plusOneYear) t.pass(`Expiry auto-filled to one year (${expiryVal})`);
  else t.note(`Expiry after effective=${todayIso} is "${expiryVal}" (expected ${plusOneYear})`);

  // PDF via the hidden file input inside the Policy copy section
  const fileInput = control(drawer, "PDF file").locator("input[type=file]");
  if (!(await fileInput.count())) throw new Error("PDF file input not rendered (client picked?)");
  await fileInput.setInputFiles(SAMPLE_PDF);
  await drawer.getByText(basename(SAMPLE_PDF)).first().waitFor({ state: "visible", timeout: 30_000 });
  t.pass(`PDF uploaded to storage; drawer shows "${basename(SAMPLE_PDF)}" with Replace`);
  const attached = await drawer.getByText("Attached").count();
  if (attached) t.pass('Policy copy section state reads "Attached"');
  else t.fail('Policy copy section did not switch to "Attached"');
  await t.shot("02-form-filled");
});

await step("Save the policy copy", async () => {
  const drawer = drawerOf("Log policy copy");
  const save = drawer.getByRole("button", { name: "Log policy copy" });
  if (await save.isDisabled()) throw new Error("Save button disabled with a complete form");
  await save.click();
  const ok = page.getByText("Policy copy logged").first();
  const bad = page.getByText("Couldn’t log the policy copy").first();
  await Promise.race([ok.waitFor({ state: "visible", timeout: 30_000 }), bad.waitFor({ state: "visible", timeout: 30_000 })]);
  if (await bad.isVisible()) {
    const txt = await bad.locator("xpath=..").textContent();
    throw new Error(`save failed: ${txt}`);
  }
  t.pass('Toast "Policy copy logged" shown');
  await settle(page, 2500);
  await t.shot("03-after-save");
  if (await drawer.count()) t.fail("Drawer still open after save");
  else t.pass("Drawer closed after save");

  const { data: rows, error } = await db.from("policies").select("*").eq("client_id", client.id).eq("policy_number", "QAOCT2-POL-001");
  if (error) throw new Error(error.message);
  if (rows.length !== 1) throw new Error(`expected 1 policy row, found ${rows.length}`);
  policy1 = rows[0];
  created.push({ table: "policies", id: policy1.id, ref: policy1.reference_no });
  t.pass(`Policy row created ${policy1.reference_no} status=${policy1.status} plan_option=${policy1.plan_option_id === selectPlusWard.id ? "Select Plus Ward" : policy1.plan_option_id}`);

  const { data: pays } = await db.from("payments").select("id, reference_no, status, amount").eq("policy_id", policy1.id);
  for (const p of pays ?? []) created.push({ table: "payments", id: p.id, ref: p.reference_no });
  t.note(`Standalone policy auto-created ${pays?.length ?? 0} payment(s): ${(pays ?? []).map((p) => `${p.reference_no} ${p.status} ₱${p.amount}`).join("; ")}`);
});

/* ---------- step 2: policy appears + Policy Copy document ---------- */
await step("Policy row visible on /policies", async () => {
  await nav("/policies");
  const row = page.locator("tr", { hasText: "QAOCT2-POL-001" }).first();
  if (!(await row.count())) throw new Error("No row with PC number QAOCT2-POL-001");
  const txt = (await row.textContent()) ?? "";
  if (!txt.includes(FULL_NAME)) t.fail(`Row found but client name missing: ${txt}`);
  else t.pass(`Row on /policies: ${txt.replace(/\s+/g, " ").trim().slice(0, 160)}`);
  await t.shot("04-policies-list");
});

let doc1 = null;
await step("Policy Copy document registered", async () => {
  const { data: docs, error } = await db.from("documents").select("*").eq("policy_id", policy1.id);
  if (error) throw new Error(error.message);
  for (const d of docs) created.push({ table: "documents", id: d.id, ref: d.reference_no });
  doc1 = docs.find((d) => d.document_type === "Policy Copy");
  if (!doc1) throw new Error(`no document_type="Policy Copy" row for the policy (found: ${docs.map((d) => d.document_type).join(", ") || "none"})`);
  t.pass(`documents row ${doc1.reference_no} type="Policy Copy" name="${doc1.name}" path=${doc1.file_path}`);
});

await step("Client profile Policies card: PDF opens in one click", async () => {
  await nav(`/clients/${client.id}`);
  // Innermost div holding both the PC-number span and that policy's Edit button = one Policies-card block.
  const card = policyBlock("QAOCT2-POL-001");
  if (!(await card.count())) throw new Error("policy block for QAOCT2-POL-001 not on the Policies card");
  t.pass("Policies card lists QAOCT2-POL-001");
  const link = card.getByRole("link", { name: /PDF/ }).first();
  if (!(await link.count())) throw new Error('No "PDF" link in the policy block');
  const href = await link.getAttribute("href");
  if (href !== `/api/documents/${doc1.id}/download`) t.fail(`PDF href is ${href}, expected /api/documents/${doc1.id}/download`);
  else t.pass(`PDF link href = ${href} (one click, no intermediate dialog)`);
  const attachBtn = await card.getByRole("button", { name: "Attach PDF" }).count();
  if (attachBtn) t.fail('"Attach PDF" still offered even though a PDF is filed');
  await t.shot("05-profile-policies-card");

  // Download route: expect redirect to a signed Storage URL, then 200 PDF bytes
  const res = await page.request.get(href, { maxRedirects: 0 });
  const loc = res.headers()["location"] ?? "";
  if (![302, 303, 307, 308].includes(res.status())) throw new Error(`download route returned ${res.status()} (expected redirect)`);
  if (!/\/storage\/v1\/object\/sign\//.test(loc)) t.fail(`redirect target is not a signed storage URL: ${loc.slice(0, 120)}`);
  else t.pass(`GET ${href} → ${res.status()} redirect to signed Storage URL`);
  const file = await page.request.get(loc);
  const bytes = await file.body();
  if (file.status() !== 200) throw new Error(`signed URL returned ${file.status()}`);
  if (bytes.subarray(0, 4).toString() !== "%PDF") t.fail(`signed URL body is not a PDF (starts with ${bytes.subarray(0, 8).toString("hex")})`);
  else t.pass(`Signed URL served ${bytes.length} bytes starting with %PDF`);
  const ct = file.headers()["content-type"];
  if (!/pdf/.test(ct ?? "")) t.note(`Signed URL content-type is "${ct}" (not application/pdf)`);

  // Open via real click in a new tab to confirm it needs no second step
  const [popup] = await Promise.all([
    page.context().waitForEvent("page", { timeout: 10_000 }).catch(() => null),
    link.click({ modifiers: ["Control"] }),
  ]);
  if (popup) {
    await popup.waitForLoadState("load").catch(() => {});
    t.pass(`Ctrl+click opened ${popup.url().slice(0, 100)}…`);
    await popup.close();
  } else t.note("Ctrl+click did not open a new tab in headless (link has no target); href verified via request instead");

  // Documents card also lists it as Policy Copy
  const docsCardHit = await page.getByText("Policy Copy", { exact: false }).count();
  if (docsCardHit) t.pass(`"Policy Copy" label present on the profile (${docsCardHit} match(es))`);
  else t.fail('"Policy Copy" document type not visible anywhere on the profile');
});

/* ---------- step 3: Attach PDF on a policy logged without one ---------- */
let policy2 = null;
await step("Seed a second policy without a PDF", async () => {
  const { data, error } = await db
    .from("policies")
    .insert({
      client_id: client.id,
      product_version_id: SELECT_VERSION_ID,
      plan_option_id: selectStandardWard.id,
      policy_number: "QAOCT2-POL-002",
      status: "Active",
      premium_amount: 30000,
      currency: "PHP",
      payment_mode: "Annual",
      effective_date: todayIso,
      expiry_date: plusOneYear,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  policy2 = data;
  created.push({ table: "policies", id: policy2.id, ref: policy2.reference_no });
  t.note(`Seeded policy ${policy2.reference_no} (QAOCT2-POL-002) with no document`);
});

await step("Attach PDF from the Policies card", async () => {
  await nav(`/clients/${client.id}`);
  const block = policyBlock("QAOCT2-POL-002");
  if (!(await block.count())) throw new Error("policy 2 block not found on profile");
  const attach = block.getByRole("button", { name: "Attach PDF" });
  if (!(await attach.count())) throw new Error('"Attach PDF" button not shown on a policy without a PDF');
  t.pass('Policy without a PDF shows "Attach PDF"');
  if (await block.getByRole("link", { name: /PDF/ }).count()) t.fail("Policy without a PDF shows a PDF link");
  await attach.click();
  const input = block.locator("input[type=file]");
  await input.waitFor({ state: "attached" });
  if (!(await block.getByRole("button", { name: "Cancel" }).count())) t.note('Attach toggle did not relabel to "Cancel"');
  await t.shot("06-attach-dropzone");
  await input.setInputFiles(SAMPLE_PDF);
  const ok = page.getByText("Policy copy attached").first();
  await ok.waitFor({ state: "visible", timeout: 30_000 });
  t.pass('Toast "Policy copy attached" shown');
  await settle(page, 3000);
  const block2 = () => policyBlock("QAOCT2-POL-002");
  let link = block2().getByRole("link", { name: /PDF/ });
  const appeared = await link.waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
  if (!appeared) {
    t.fail('PDF link did not appear within 60s after "Policy copy attached" toast (router.refresh); reloading to check persistence');
    await t.shot("06b-no-link-after-attach");
    await nav(`/clients/${client.id}`);
    link = block2().getByRole("link", { name: /PDF/ });
    await link.waitFor({ state: "visible", timeout: 30_000 });
    t.note("PDF link present after a full reload");
  }
  const href = await link.getAttribute("href");
  const { data: docs } = await db.from("documents").select("*").eq("policy_id", policy2.id);
  for (const d of docs ?? []) created.push({ table: "documents", id: d.id, ref: d.reference_no });
  const doc2 = (docs ?? []).find((d) => d.document_type === "Policy Copy");
  if (!doc2) throw new Error("no Policy Copy document row after attach");
  if (href !== `/api/documents/${doc2.id}/download`) t.fail(`attached PDF href ${href} ≠ /api/documents/${doc2.id}/download`);
  else t.pass(`After attach, the block shows a PDF link → ${href}`);
  const res = await page.request.get(href, { maxRedirects: 0 });
  if ([302, 303, 307, 308].includes(res.status())) t.pass(`Attached PDF download route → ${res.status()} redirect`);
  else t.fail(`Attached PDF download route → ${res.status()}`);
  await t.shot("07-after-attach");
});

/* ---------- step 4: wording ---------- */
await step("Wording: no agency-issues wording on policies/profile/drawer", async () => {
  const found = [];
  const scan = async (label) => {
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const re = /[^.]{0,60}\bissu(e|es|ed|ing)\b[^.]{0,60}/gi;
    for (const m of text.match(re) ?? []) found.push(`${label}: …${m.trim()}…`);
  };
  await nav("/policies", 1500);
  await scan("/policies");
  await page.getByRole("button", { name: "Log policy copy" }).first().click();
  await drawerOf("Log policy copy").waitFor({ state: "visible" });
  await scan("/policies drawer");
  await page.keyboard.press("Escape");
  await nav(`/clients/${client.id}`, 1500);
  await scan("client profile");
  const agencyIssues = found.filter((f) => /issue policy|agency issu|we issu/i.test(f));
  if (agencyIssues.length) t.bug(`Agency-issues wording found: ${agencyIssues.join(" | ")}`);
  else t.pass('No "Issue policy" / agency-issues wording on /policies, the drawer, or the profile');
  if (found.length) t.note(`Other "issue" mentions (carrier wording, acceptable?): ${found.join(" | ")}`);
});

/* ---------- step 4b: application last step reads "Log policy & convert" ---------- */
let application = null;
await step("Application last workflow step button", async () => {
  const ins = await db
    .from("applications")
    .insert({
      client_id: client.id,
      product_version_id: SELECT_VERSION_ID,
      plan_option_id: selectPlusWard.id,
      application_type: "Standard",
      status: "Approved",
      coverage_type: "Individual",
      date_started: todayIso,
      date_submitted: todayIso,
      desired_start_date: todayIso,
      preferred_payment_mode: "Annual",
      estimated_premium: 45000,
      pre_existing_status: "No",
      smoker_status: "Never",
    })
    .select("*")
    .single();
  if (ins.error) throw new Error(`seed application: ${ins.error.message}`);
  application = ins.data;
  created.push({ table: "applications", id: application.id, ref: application.reference_no });
  const pay = await db
    .from("payments")
    .insert({ client_id: client.id, application_id: application.id, amount: 45000, currency: "PHP", status: "Verified", payment_method: "Bank Transfer", payment_date: todayIso, or_number: "QAOCT2-OR-001", or_received_date: todayIso })
    .select("*")
    .single();
  if (pay.error) throw new Error(`seed payment: ${pay.error.message}`);
  created.push({ table: "payments", id: pay.data.id, ref: pay.data.reference_no });
  t.note(`Seeded application ${application.reference_no} (Approved) + Verified payment ${pay.data.reference_no} to reach workflow step 6`);

  await nav("/applications");
  const row = page.locator("tr", { hasText: FULL_NAME }).first();
  if (!(await row.count())) throw new Error("application row for QA client not listed");
  await row.getByRole("button", { name: "Requirements" }).click();
  const stepLabel = page.getByText(/Step \d of 6/i).first();
  await stepLabel.waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(3000);
  await t.shot("08-application-workflow");
  const stepText = (await stepLabel.textContent())?.trim();
  if (/Step 6 of 6/i.test(stepText ?? "")) t.pass(`Workflow opened straight at "${stepText}" (payment Verified → last step)`);
  else t.note(`Workflow opened at "${stepText}"`);
  const convertBtn = page.getByRole("button", { name: "Log policy & convert" });
  if (await convertBtn.count()) {
    t.pass('Application workflow step 6 shows the "Log policy & convert" button (UI-verified)');
    const prefilled = await page.getByText(FULL_NAME).nth(1).isVisible().catch(() => false);
    if (prefilled) t.pass("Step 6 form shows the application's client locked (no picker)");
    const issueBtn = await page.getByRole("button", { name: /issue/i }).count();
    if (issueBtn) t.bug('Workflow still has an "Issue…" button');
    // Prefill from the application: product + plan were on the application (Select / Select Plus Ward)
    const productVal = await control(page, "Product").evaluate((s) => s.options[s.selectedIndex]?.textContent?.trim());
    const variantVal = await control(page, "Select variant").evaluate((s) => s.value).catch(() => "(no variant field)");
    const planVal = await control(page, "Plan option").evaluate((s) => s.options[s.selectedIndex]?.textContent?.trim());
    const needed = (await page.getByText(/greyed out until you add/).first().textContent().catch(() => "")) ?? "";
    if (productVal === "Select") t.pass("Product prefilled from the application: Select");
    else t.fail(`Product prefilled as "${productVal}" (application product is Select)`);
    if (variantVal === "Select Plus" && planVal === "Select Plus Ward") t.pass("Select variant + plan prefilled from the application's plan (Select Plus Ward)");
    else t.bug(`Step 6 does not derive the Select variant from the application's plan: variant="${variantVal}", plan shown="${planVal}", footer="${needed.trim()}" — staff must re-pick the variant although the application already has plan Select Plus Ward`);
    if (await convertBtn.isDisabled()) t.note('"Log policy & convert" is disabled until the variant/plan are picked');
    // Pick the variant and confirm the prefilled plan snaps back and the button enables
    await control(page, "Select variant").selectOption({ label: "Select Plus" }).catch(() => {});
    await page.waitForTimeout(500);
    const planAfter = await control(page, "Plan option").evaluate((s) => s.options[s.selectedIndex]?.textContent?.trim());
    if (planAfter === "Select Plus Ward" && !(await convertBtn.isDisabled())) t.pass(`After choosing "Select Plus", plan reads "${planAfter}" and "Log policy & convert" is enabled`);
    else t.fail(`After choosing "Select Plus": plan="${planAfter}", button disabled=${await convertBtn.isDisabled()}`);
  } else {
    const heading = (await page.locator("body").innerText()).match(/Log policy[^\n]*/g)?.join(" / ");
    t.fail(`"Log policy & convert" button not present at workflow open (seen: ${heading ?? "none"}); label is source-verified only (issue-policy.tsx:108)`);
  }
  await page.keyboard.press("Escape");
});

/* ---------- report ---------- */
t.note(`Created records: ${created.map((r) => `${r.table}:${r.id}${r.ref ? ` (${r.ref})` : ""}`).join("; ")}`);
const fails = await t.finish();
console.log(JSON.stringify({ fails, created }, null, 2));
process.exit(0);
