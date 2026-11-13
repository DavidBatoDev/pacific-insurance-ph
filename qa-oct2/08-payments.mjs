/**
 * TESTING-OCT2.md §8 Payments — 8.1 sources & links, 8.2 USD premiums, 8.3 installments.
 *   node --env-file=.env.local qa-oct2/08-payments.mjs [8.1|8.2|8.3] [run-tag]
 * Labels carry a run tag so re-runs never collide with earlier QA rows.
 */
import { startFeature, settle, db, createTestClient, SAMPLE_PDF, QA_PREFIX } from "./lib.mjs";

const BLUE_ROYALE_VERSION = "427d8fa0-2ce1-4a20-90bc-b477b6a13e0c"; // Blue Royale · Rates effective 1 November 2025 (Active)
const BLUE_ROYALE_PRODUCT = "80e401c9-9ddc-40bf-961a-aed182a1dd69";
const TRAVEL_VERSION = "e6f25cd4-71a6-4bf9-8670-76358dca6e16"; // TravelSafe (Active)

const created = []; // { table, id, ref }
const record = (table, row) => created.push({ table, id: row.id, ref: row.reference_no ?? row.policy_number ?? row.last_name ?? "" });
const today = new Date().toISOString().slice(0, 10);
const ONLY = process.argv[2] ?? null;
const RUN = process.argv[3] ?? Date.now().toString(36).slice(-4);
const label = (base) => `${base} ${RUN}`;
const NAV = { timeout: 90000 };
/** Wait for the application workflow modal to finish loading its payload. */
async function waitWorkflow(dialog) {
  await dialog.waitFor({ timeout: 60000 });
  await dialog.getByText("Loading the application…").waitFor({ state: "hidden", timeout: 120000 }).catch(() => {});
  await dialog.page().waitForTimeout(800);
}

async function insert(table, row) {
  const { data, error } = await db.from(table).insert(row).select("*").single();
  if (error) throw new Error(`${table} insert: ${error.message}`);
  record(table, data);
  return data;
}
async function paymentsFor(clientId) {
  const { data, error } = await db.from("payments").select("*").eq("client_id", clientId).order("created_at");
  if (error) throw new Error(error.message);
  return data;
}
const paySource = (p) => (p.application_id ? "Application" : p.renewal_id ? "Renewal" : p.travel_request_id ? "Travel" : p.policy_id ? "Policy" : "Other");

/** Value next to an uppercase summary key (Verify drawer / workflow summaries). */
const summaryValue = (page, key) =>
  page.locator("span", { hasText: new RegExp(`^${key}$`) }).last().locator("xpath=following-sibling::span[1]").textContent().then((s) => s?.trim());
async function step(t, name, fn) {
  try {
    await fn();
  } catch (err) {
    t.fail(`${name}: ${err.message.split("\n")[0]}`);
    await t.shot(`fail-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`).catch(() => {});
  }
}
async function gotoPayments(page, search) {
  await page.goto("/payments", NAV);
  await settle(page);
  if (search) {
    await page.getByPlaceholder("Search payments…").fill(search);
    await page.waitForTimeout(500);
  }
}
const paymentRows = (page, text) => page.locator("tbody tr", { hasText: text });

/* ======================================================================================
 * 8.1 Pending payments created from their sources and linked back
 * ==================================================================================== */
async function section81() {
  const t = await startFeature("8.1-payment-sources");
  const { page } = t;
  t.context.setDefaultTimeout(45000);
  const client = await createTestClient(label("Payments App"), { lifecycle_stage: "Client", product_interest: "Blue Royale" });
  record("clients", client);
  const clientName = `${QA_PREFIX} ${label("Payments App")}`;
  const app = await insert("applications", {
    client_id: client.id,
    product_version_id: BLUE_ROYALE_VERSION,
    application_type: "Standard",
    status: "Submitted to Pacific Cross",
    date_started: today,
    date_submitted: today,
    pre_existing_status: "No",
    estimated_premium: 25000,
    preferred_payment_mode: "Annual",
    notes: "QA OCT2 seeded application (8.1)",
  });
  t.note(`Seeded client ${client.id} + application ${app.reference_no} (${app.id}) status "Submitted to Pacific Cross"`);

  // --- Step 1: Payment step → Awaiting payment ---------------------------------------
  const dialog = page.getByRole("dialog", { name: "Application workflow" });
  await step(t, "1 open application workflow", async () => {
    await page.goto("/applications", NAV);
    await settle(page);
    await page.getByPlaceholder("Search applications…").fill(label("Payments App"));
    await page.waitForTimeout(500);
    const row = page.locator("tbody tr", { hasText: label("Payments App") }).first();
    if (!(await row.count())) throw new Error("application row not listed on /applications");
    await row.getByRole("button", { name: "Requirements" }).click();
    await waitWorkflow(dialog);
    await t.shot("81-workflow-opened");
    const heading = await dialog.textContent();
    t.note(`Workflow opened; shows step text: ${/Step \d of 6/.exec(heading)?.[0] ?? "?"}`);
  });

  await step(t, "1 file illustrative proposal (step 4) to unlock Payment", async () => {
    if (!(await dialog.getByText("Illustrative proposal (final billing)").count())) {
      // Not on step 4 — navigate via rail
      await dialog.getByText("Pacific Cross reply", { exact: false }).first().click();
      await page.waitForTimeout(800);
    }
    const fileInput = dialog.locator('input[type="file"][accept*="pdf"]').first();
    await fileInput.setInputFiles(SAMPLE_PDF);
    await page.getByText("Proposal filed").first().waitFor({ timeout: 90000 });
    t.pass("Illustrative proposal uploaded on step 4 → toast “Proposal filed”");
    await dialog.getByText("Proposal on file").first().waitFor({ timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(800);
    await t.shot("81-proposal-filed");
  });

  await step(t, "1 record billed premium in Payment step", async () => {
    const cont = dialog.getByRole("button", { name: "Continue" });
    if (await cont.count()) {
      const disabled = await cont.isDisabled();
      if (disabled) throw new Error("Continue to Payment is disabled after filing proposal (outstanding/proposal gating)");
      await cont.click();
    }
    await page.waitForTimeout(800);
    const amount = dialog.getByLabel("Premium billed by Pacific Cross");
    await amount.waitFor({ timeout: 10000 });
    const prefilled = await amount.inputValue();
    t.note(`Payment step amount prefilled from estimate: "${prefilled}"`);
    await amount.fill("25000");
    await dialog.getByRole("button", { name: "Create payment request" }).click();
    await page.getByText("Payment request created").first().waitFor({ timeout: 45000 });
    t.pass("Payment step: “Create payment request” → toast “Payment request created”");
    await page.waitForTimeout(1500);
    await t.shot("81-payment-requested");
    const after = await dialog.textContent();
    if (after.includes("Awaiting Payment")) t.pass("Application status badge now “Awaiting Payment”");
    else t.fail("Application status did not change to Awaiting Payment in the workflow header");
  });

  let appPayment = null;
  await step(t, "1 /payments shows one Awaiting Application payment", async () => {
    const rows = await paymentsFor(client.id);
    const appRows = rows.filter((p) => p.application_id === app.id);
    appPayment = appRows[0] ?? null;
    if (appRows.length === 1 && appRows[0].status === "Awaiting" && Number(appRows[0].amount) === 25000) {
      record("payments", appRows[0]);
      t.pass(`DB: exactly one Awaiting application payment ${appRows[0].reference_no} amount 25000 currency ${appRows[0].currency}`);
    } else t.fail(`DB: expected 1 Awaiting app payment of 25000, got ${JSON.stringify(appRows.map((p) => [p.status, p.amount]))}`);
    await gotoPayments(page, label("Payments App"));
    const row = paymentRows(page, clientName).filter({ hasText: "Application" });
    const n = await row.count();
    const text = n ? await row.first().textContent() : "";
    if (n === 1 && text.includes("Awaiting") && text.includes("₱25,000") && text.includes(app.reference_no)) {
      t.pass(`/payments row: Application · ${app.reference_no} · ₱25,000 · Awaiting`);
    } else t.fail(`/payments: expected one Awaiting Application row ₱25,000 for ${app.reference_no}; found ${n} row(s): ${text.trim().slice(0, 200)}`);
    await t.shot("81-payments-app-row");
  });

  // --- Step 2: Log policy copy (standalone) → Policy payment ---------------------------
  const client2 = await createTestClient(label("Payments PolicyCopy"), { lifecycle_stage: "Client", product_interest: "Blue Royale" });
  record("clients", client2);
  const client2Name = `${QA_PREFIX} ${label("Payments PolicyCopy")}`;
  await step(t, "2 Log policy copy (standalone, no premium)", async () => {
    await page.goto("/policies", NAV);
    await settle(page);
    await page.getByRole("button", { name: "Log policy copy" }).click();
    const drawer = page.locator("h2", { hasText: "Log policy copy" }).locator("xpath=ancestor::*[contains(@class,'fixed') or @role='dialog'][1]");
    await page.locator("h2", { hasText: "Log policy copy" }).waitFor({ timeout: 10000 });
    await page.getByPlaceholder("Search a client…").fill(label("Payments PolicyCopy"));
    const pick = page.locator("button", { hasText: client2Name });
    await pick.first().waitFor({ timeout: 90000 });
    await pick.first().click();
    const product = page.locator("select").filter({ has: page.locator("option", { hasText: "Choose a product…" }) }).first();
    await product.selectOption({ label: "Blue Royale" });
    await page.getByRole("button", { name: "Log policy copy" }).last().click();
    await page.getByText("Policy copy logged").first().waitFor({ timeout: 45000 });
    t.pass("Standalone “Log policy copy” saved (Blue Royale, premium left blank) → toast “Policy copy logged”");
    await page.waitForTimeout(1500);
    await t.shot("82-policy-logged");
    void drawer;
  });

  let policyPayment = null;
  await step(t, "2 Policy payment appears on /payments", async () => {
    const { data: pols } = await db.from("policies").select("*").eq("client_id", client2.id);
    for (const p of pols ?? []) record("policies", p);
    const rows = await paymentsFor(client2.id);
    for (const p of rows) record("payments", p);
    const polRows = rows.filter((p) => p.policy_id && !p.application_id && !p.renewal_id);
    policyPayment = polRows[0] ?? null;
    if (polRows.length === 1 && polRows[0].status === "Awaiting" && polRows[0].amount == null) {
      t.pass(`DB: one Awaiting Policy payment ${polRows[0].reference_no} with amount null (no premium entered)`);
    } else t.fail(`DB: expected one Awaiting Policy payment with null amount; got ${JSON.stringify(rows.map((p) => [paySource(p), p.status, p.amount]))}`);
    await gotoPayments(page, label("Payments PolicyCopy"));
    const row = paymentRows(page, client2Name).filter({ hasText: "Policy" });
    const n = await row.count();
    const text = n ? await row.first().textContent() : "";
    if (n === 1 && text.includes("Awaiting")) t.pass(`/payments: Policy row for ${client2Name} shown as Awaiting (amount "${/—/.test(text) ? "—" : "?"}")`);
    else t.fail(`/payments: expected one Policy row for ${client2Name}; found ${n}: ${text.trim().slice(0, 200)}`);
    await t.shot("81-payments-policy-row");
  });

  // --- Step 5: null amount → Verify Payment needs positive premium ------------------------
  await step(t, "5 Verify Payment requires positive premium before proof/invoice", async () => {
    await gotoPayments(page, label("Payments PolicyCopy"));
    const row = paymentRows(page, client2Name).filter({ hasText: "Policy" }).first();
    await row.getByRole("button", { name: "Verify Payment" }).click();
    await page.locator("h2", { hasText: "Verify payment" }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(500);
    const save = page.getByRole("button", { name: /^(Save|Verify & record invoice|Saving…)$/ }).last();
    const amount = page.getByLabel("Premium amount");
    const summaryAmount = await summaryValue(page, "Amount");
    t.note(`Verify drawer summary Amount reads: "${summaryAmount?.trim()}"`);
    if ((await page.getByText("Premium needed").count()) > 0) t.pass("Verify drawer flags “Premium needed” for a payment with no amount");
    if (await save.isDisabled()) t.pass("Save is disabled with no amount (before proof)");
    else t.fail("Save enabled with no amount and no proof");
    await page.getByLabel("Proof of payment").setInputFiles(SAMPLE_PDF);
    await page.waitForTimeout(400);
    if (await save.isDisabled()) t.pass("Save still disabled after attaching proof while amount is empty — proof cannot be recorded without a premium");
    else t.fail("Save became enabled after attaching proof although amount is empty");
    await amount.fill("0");
    await page.waitForTimeout(300);
    if (await save.isDisabled()) t.pass("Amount 0 is rejected (Save disabled) — no amount invented");
    else t.fail("Amount 0 accepted (Save enabled)");
    await page.getByLabel("Payment status").selectOption("Verified");
    await page.waitForTimeout(200);
    if ((await page.getByText("Invoice no. needed").count()) || (await save.isDisabled())) t.pass("Verified status without OR keeps Save disabled / asks for invoice no.");
    await page.getByLabel("Payment status").selectOption("Received");
    await amount.fill("15000");
    await page.waitForTimeout(300);
    await t.shot("81-verify-null-amount");
    if (!(await save.isDisabled())) {
      t.pass("Entering a positive premium (15000) enables Save");
      await save.click();
      await page.getByText("Payment updated").first().waitFor({ timeout: 25000 });
      t.pass("Saved as Received with proof → toast “Payment updated”");
      await page.waitForTimeout(1500);
      const { data: p } = await db.from("payments").select("*").eq("id", policyPayment.id).single();
      if (p && Number(p.amount) === 15000 && p.status === "Received" && p.proof_document_id) t.pass(`DB: payment now amount 15000 · Received · proof ${p.proof_document_id}`);
      else t.fail(`DB: expected amount 15000/Received/proof, got ${JSON.stringify([p?.amount, p?.status, p?.proof_document_id])}`);
      if (p?.proof_document_id) created.push({ table: "documents", id: p.proof_document_id, ref: "proof of payment (policy copy)" });
    } else t.fail("Save remains disabled after entering a positive premium + proof");
    await t.shot("81-verify-saved");
  });

  // --- Verify the application payment (needed before Log policy & convert) -------------
  await step(t, "2 verify application payment (proof + OR)", async () => {
    await gotoPayments(page, label("Payments App"));
    const row = paymentRows(page, clientName).filter({ hasText: "Application" }).first();
    await row.getByRole("button", { name: "Verify Payment" }).click();
    await page.locator("h2", { hasText: "Verify payment" }).waitFor({ timeout: 10000 });
    await page.getByLabel("Proof of payment").setInputFiles(SAMPLE_PDF);
    await page.getByLabel("Payment status").selectOption("Verified");
    await page.getByPlaceholder("OR-2026-XXXXX").fill("QA-OCT2-OR-APP");
    const save = page.getByRole("button", { name: "Verify & record invoice" });
    await save.click();
    await page.getByText("Payment verified · invoice recorded").first().waitFor({ timeout: 30000 });
    t.pass("Application payment verified with OR QA-OCT2-OR-APP");
    await page.waitForTimeout(1500);
    const { data: coms } = await db.from("commissions").select("*").eq("client_id", client.id);
    for (const c of coms ?? []) record("commissions", c);
    const { data: tasks } = await db.from("tasks").select("*").eq("client_id", client.id);
    for (const k of tasks ?? []) record("tasks", k);
    const { data: p } = await db.from("payments").select("*").eq("id", appPayment.id).single();
    if (p?.proof_document_id) created.push({ table: "documents", id: p.proof_document_id, ref: "proof of payment (application)" });
  });

  await step(t, "2 Log policy & convert from application reuses the application payment", async () => {
    const before = await paymentsFor(client.id);
    await page.goto("/applications", NAV);
    await settle(page);
    await page.getByPlaceholder("Search applications…").fill(label("Payments App"));
    await page.waitForTimeout(500);
    await page.locator("tbody tr", { hasText: label("Payments App") }).first().getByRole("button", { name: "Requirements" }).click();
    await waitWorkflow(dialog);
    const txt = await dialog.textContent();
    if (/Step 6 of 6/.test(txt)) t.pass("Workflow reopens on step 6 “Log policy copy” after verification");
    else t.note(`Workflow reopened on: ${/Step \d of 6/.exec(txt)?.[0] ?? "?"}`);
    const convert = dialog.getByRole("button", { name: "Log policy & convert" });
    if (!(await convert.count())) {
      await dialog.getByText("Log policy copy", { exact: false }).first().click();
      await page.waitForTimeout(800);
    }
    await dialog.getByPlaceholder("PC-000000").fill("QA-OCT2-PC-FROMAPP");
    const premium = dialog.getByPlaceholder("0", { exact: true }).first();
    t.note(`Policy form prefilled premium: "${await premium.inputValue()}"`);
    await t.shot("81-log-policy-convert-form");
    await convert.click();
    await page.getByText("is now a policyholder").first().waitFor({ timeout: 25000 });
    t.pass("“Log policy & convert” → toast “… is now a policyholder”");
    await page.waitForTimeout(2000);
    await t.shot("81-converted");
    const after = await paymentsFor(client.id);
    const { data: pols } = await db.from("policies").select("*").eq("client_id", client.id);
    for (const p of pols ?? []) record("policies", p);
    const appPays = after.filter((p) => p.application_id === app.id);
    const policyOnly = after.filter((p) => p.policy_id && !p.application_id && !p.renewal_id);
    const renewalPays = after.filter((p) => p.renewal_id);
    for (const p of after) if (!created.some((c) => c.id === p.id)) record("payments", p);
    const { data: ren } = await db.from("renewals").select("*").eq("client_id", client.id);
    for (const r of ren ?? []) record("renewals", r);
    if (appPays.length === 1 && appPays[0].policy_id && policyOnly.length === 0) {
      t.pass(`Application payment reused: still 1 application payment (${appPays[0].reference_no}), now linked to policy ${appPays[0].policy_id}; no separate Policy payment created (payments before ${before.length} → after ${after.length})`);
    } else t.fail(`Expected the application payment to be reused; app payments=${appPays.length} (policy_id ${appPays[0]?.policy_id}), standalone policy payments=${policyOnly.length}`);
    if (renewalPays.length) t.note(`Logging the policy (Active, no expiry) also produced ${renewalPays.length} Renewal payment(s): ${renewalPays.map((p) => `${p.reference_no} ${p.amount}`).join(", ")}`);
    const { data: c } = await db.from("clients").select("lifecycle_stage").eq("id", client.id).single();
    if (c?.lifecycle_stage === "Policyholder") t.pass("Client lifecycle_stage → Policyholder");
    else t.fail(`Client lifecycle_stage is ${c?.lifecycle_stage}, expected Policyholder`);
    const pol = (pols ?? []).find((p) => p.policy_number === "QA-OCT2-PC-FROMAPP");
    if (pol?.or_number === "QA-OCT2-OR-APP") t.pass("Verified payment's OR carried onto the new policy (policies.or_number)");
    else t.fail(`policies.or_number = ${pol?.or_number}, expected QA-OCT2-OR-APP`);
  });

  // --- Steps 3/4: seed Renewal + Travel payments, verify Source links ----------------------
  let renewalPolicy = null;
  let travel = null;
  await step(t, "3 renewal creates its Awaiting renewal payment", async () => {
    renewalPolicy = await insert("policies", {
      client_id: client.id,
      product_id: BLUE_ROYALE_PRODUCT,
      product_version_id: BLUE_ROYALE_VERSION,
      policy_number: "QA-OCT2-PC-RENEWAL",
      status: "Active",
      effective_date: "2026-04-01",
      expiry_date: "2027-03-31",
      renewal_date: "2027-03-31",
      currency: "PHP",
      premium_amount: 20000,
      payment_mode: "Annual",
      notes: "QA OCT2 seeded policy (8.1 renewal link)",
    });
    await new Promise((r) => setTimeout(r, 1000));
    const { data: ren } = await db.from("renewals").select("*").eq("policy_id", renewalPolicy.id);
    for (const r of ren ?? []) record("renewals", r);
    const pays = (await paymentsFor(client.id)).filter((p) => ren?.some((r) => r.id === p.renewal_id));
    for (const p of pays) record("payments", p);
    if (ren?.length === 1 && pays.length === 1 && pays[0].status === "Awaiting" && Number(pays[0].amount) === 20000) {
      t.pass(`Inserting an Active policy with a renewal date created renewal ${ren[0].reference_no} and Awaiting payment ${pays[0].reference_no} ₱20,000 (installment ${pays[0].installment_number}/${pays[0].installment_count})`);
    } else t.fail(`Expected 1 renewal + 1 Awaiting renewal payment of 20000; got renewals=${ren?.length} payments=${JSON.stringify(pays.map((p) => [p.status, p.amount]))}`);
    travel = await insert("travel_requests", {
      client_id: client.id,
      product_version_id: TRAVEL_VERSION,
      destination: "QA OCT2 Tokyo",
      departure_date: "2027-01-10",
      return_date: "2027-01-20",
      status: "Awaiting Payment",
      quoted_premium: 3000,
      currency: "PHP",
      notes: "QA OCT2 seeded trip (8.1 travel link)",
    });
    const tp = await insert("payments", { client_id: client.id, travel_request_id: travel.id, amount: 3000, status: "Awaiting", notes: "QA OCT2 seeded travel payment" });
    t.note(`Seeded travel request ${travel.reference_no} + Travel payment ${tp.reference_no}`);
  });

  await step(t, "4 Source column links back to each record", async () => {
    await gotoPayments(page, label("Payments App"));
    await t.shot("81-source-links");
    // Application → requirements workflow
    const appBtn = paymentRows(page, clientName).filter({ hasText: "Application" }).first().getByRole("button", { name: /^Application/ });
    const appBtnText = await appBtn.textContent();
    await appBtn.click();
    await waitWorkflow(dialog);
    t.pass(`Source “${appBtnText.trim()}” opens the Application workflow dialog`);
    await page.waitForTimeout(1500);
    await t.shot("81-source-application");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    if (await dialog.count()) await page.getByRole("button", { name: "Close" }).last().click().catch(() => {});
    await page.waitForTimeout(500);
    // Travel → workflow
    const trBtn = paymentRows(page, clientName).filter({ hasText: "Travel" }).first().getByRole("button", { name: /^Travel/ });
    const trText = await trBtn.textContent();
    await trBtn.click();
    await page.getByRole("button", { name: "Save workflow" }).waitFor({ timeout: 60000 });
    t.pass(`Source “${trText.trim()}” opens the Travel workflow modal`);
    await page.waitForTimeout(1200);
    await t.shot("81-source-travel");
    await page.getByRole("button", { name: "Close" }).last().click();
    await page.waitForTimeout(600);
    // Renewal → /renewals
    const rnBtn = paymentRows(page, clientName).filter({ hasText: "Renewal" }).first().getByRole("button", { name: /^Renewal/ });
    const rnText = await rnBtn.textContent();
    await rnBtn.click();
    await page.waitForURL(/\/renewals/, { timeout: 20000 });
    await settle(page);
    t.pass(`Source “${rnText.trim()}” navigates to ${new URL(page.url()).pathname}`);
    await t.shot("81-source-renewal");
    // Policy → client
    await gotoPayments(page, label("Payments PolicyCopy"));
    const poBtn = paymentRows(page, client2Name).filter({ hasText: "Policy" }).first().getByRole("button", { name: /^Policy/ });
    const poText = await poBtn.textContent();
    await poBtn.click();
    await page.waitForURL(new RegExp(`/clients/${client2.id}`), { timeout: 20000 });
    await settle(page);
    t.pass(`Source “${poText.trim()}” navigates to ${new URL(page.url()).pathname} (the client)`);
    await t.shot("81-source-policy-client");
  });

  await step(t, "4 Source filter includes Policy", async () => {
    await gotoPayments(page);
    await page.getByRole("button", { name: "Filters" }).click();
    await page.waitForTimeout(300);
    const sourceLabel = page.getByText("Source", { exact: true });
    if (!(await sourceLabel.count())) throw new Error("Filter popover does not show a Source label");
    const chips = ["All", "Application", "Renewal", "Travel", "Policy"];
    for (const c of chips) {
      if (!(await page.getByRole("button", { name: c, exact: true }).count())) t.fail(`Source filter chip “${c}” missing`);
    }
    await page.getByRole("button", { name: "Policy", exact: true }).click();
    await page.waitForTimeout(500);
    await t.shot("81-source-filter-policy");
    const rows = page.locator("tbody tr");
    const n = await rows.count();
    let nonPolicy = 0;
    for (let i = 0; i < n; i++) {
      const src = await rows.nth(i).locator("td").nth(2).textContent();
      if (!/^Policy/.test(src.trim())) nonPolicy++;
    }
    if (n > 0 && nonPolicy === 0) t.pass(`Source filter “Policy” shows ${n} row(s), all with Source = Policy`);
    else t.fail(`Source filter Policy: ${n} rows, ${nonPolicy} not Policy-sourced`);
  });

  return t.finish();
}

/* ======================================================================================
 * 8.2 USD premiums
 * ==================================================================================== */
async function section82() {
  const t = await startFeature("8.2-usd-premiums");
  const { page } = t;
  t.context.setDefaultTimeout(45000);
  const client = await createTestClient(label("Payments USD"), { lifecycle_stage: "Client", product_interest: "Blue Royale" });
  record("clients", client);
  const clientName = `${QA_PREFIX} ${label("Payments USD")}`;

  // Baseline dashboard total before USD payment exists
  let baselineTotal = null;
  await step(t, "dashboard baseline", async () => {
    await page.goto("/dashboard", NAV);
    await settle(page);
    const widget = page.locator("div", { hasText: "Revenue opportunity awaiting collection" }).last();
    const big = page.locator("div.text-\\[33px\\]").first();
    baselineTotal = (await big.textContent())?.trim() ?? null;
    t.note(`Dashboard revenue total before USD payment: ${baselineTotal}`);
    void widget;
  });

  let policy = null;
  let payment = null;
  await step(t, "seed USD Blue Royale policy → renewal payment in USD", async () => {
    policy = await insert("policies", {
      client_id: client.id,
      product_id: BLUE_ROYALE_PRODUCT,
      product_version_id: BLUE_ROYALE_VERSION,
      policy_number: "QA-OCT2-PC-USD",
      status: "Active",
      effective_date: "2026-05-01",
      expiry_date: "2027-04-30",
      renewal_date: "2027-04-30",
      currency: "USD",
      premium_amount: 1200,
      payment_mode: "Annual",
      notes: "QA OCT2 seeded USD policy (8.2)",
    });
    await new Promise((r) => setTimeout(r, 1000));
    const { data: ren } = await db.from("renewals").select("*").eq("policy_id", policy.id);
    for (const r of ren ?? []) record("renewals", r);
    const pays = await paymentsFor(client.id);
    for (const p of pays) record("payments", p);
    payment = pays[0] ?? null;
    if (pays.length === 1 && pays[0].currency === "USD" && Number(pays[0].amount) === 1200) t.pass(`DB: renewal payment ${pays[0].reference_no} keeps currency USD, amount 1200`);
    else t.fail(`DB: expected one USD 1200 payment, got ${JSON.stringify(pays.map((p) => [p.currency, p.amount]))}`);
  });

  await step(t, "/payments shows US$ and separate totals", async () => {
    await gotoPayments(page);
    const awaiting = await page.locator("div.rounded-lg.border.px-4", { hasText: /Awaiting payment · \d+/ }).first().locator("div").first().textContent();
    t.note(`Awaiting payment stat: "${awaiting.trim()}"`);
    if (/US\$/.test(awaiting) && /₱/.test(awaiting) && awaiting.includes(" · ")) t.pass(`Awaiting total shows PHP and USD separately: ${awaiting.trim()}`);
    else if (/US\$/.test(awaiting)) t.pass(`Awaiting total shows USD separately: ${awaiting.trim()}`);
    else t.fail(`Awaiting total does not show a separate US$ figure: ${awaiting.trim()}`);
    await page.getByPlaceholder("Search payments…").fill(label("Payments USD"));
    await page.waitForTimeout(500);
    const row = paymentRows(page, clientName).first();
    const amt = await row.locator("td").nth(3).textContent();
    if (amt.trim() === "US$1,200") t.pass(`Payment row amount renders "US$1,200"`);
    else t.fail(`Payment row amount renders "${amt.trim()}", expected "US$1,200"`);
    await t.shot("82-payments-usd");
    // Verify drawer summary
    await row.getByRole("button", { name: "Verify Payment" }).click();
    await page.locator("h2", { hasText: "Verify payment" }).waitFor({ timeout: 10000 });
    const summaryAmount = await summaryValue(page, "Amount");
    const fieldLabel = await page.getByText(/Premium amount \(/).first().textContent();
    await t.shot("82-verify-drawer-usd");
    if (/US\$/.test(summaryAmount ?? "")) t.pass(`Verify drawer summary amount: ${summaryAmount}`);
    else t.bug(`Verify payment drawer shows a USD payment as pesos — summary "${summaryAmount}", field label "${fieldLabel?.trim()}" (expected US$1,200 / a USD label)`);
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.waitForTimeout(400);
  });

  await step(t, "payment links drawer shows US$", async () => {
    await page.goto("/dashboard", NAV);
    await settle(page);
    const big = page.locator("div.text-\\[33px\\]").first();
    const total = (await big.textContent())?.trim();
    const renewalsRow = await page.locator("div", { hasText: /^Renewals awaiting payment/ }).last().locator("xpath=..").textContent().catch(() => "");
    t.note(`Dashboard revenue total after USD payment: ${total} (before: ${baselineTotal}); Renewals row: ${renewalsRow?.replace(/\s+/g, " ").trim()}`);
    await t.shot("82-dashboard");
    if (/US\$/.test(total ?? "") || (await page.getByText(/US\$/).count()) > 0) t.pass("Dashboard shows a US$ figure");
    else t.bug(`Dashboard revenue widget shows no US$ anywhere: total "${total}" (baseline "${baselineTotal}") — USD 1,200 renewal payment is summed into the peso total as ₱ (peso() in dashboard.tsx:176/202)`);
    await page.getByRole("button", { name: "Log payment links" }).click();
    await page.locator("h2", { hasText: "Log payment links" }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const item = page.locator("button", { hasText: clientName }).first();
    const itemText = (await item.textContent().catch(() => ""))?.replace(/\s+/g, " ").trim();
    await t.shot("82-payment-links");
    if (/US\$1,200/.test(itemText)) t.pass(`Payment links row: ${itemText}`);
    else if (itemText) t.bug(`Payment links drawer lists the USD payment as "${itemText}" — expected US$1,200 (peso() in payment-links.tsx:236; selected total also peso-only)`);
    else t.fail("Payment links drawer did not list the QA USD client");
    await page.getByRole("button", { name: "Cancel" }).last().click().catch(() => page.keyboard.press("Escape"));
  });

  await step(t, "verify USD payment → commission keeps USD", async () => {
    await gotoPayments(page, label("Payments USD"));
    const row = paymentRows(page, clientName).first();
    await row.getByRole("button", { name: "Verify Payment" }).click();
    await page.locator("h2", { hasText: "Verify payment" }).waitFor({ timeout: 10000 });
    await page.getByLabel("Proof of payment").setInputFiles(SAMPLE_PDF);
    await page.getByLabel("Payment status").selectOption("Verified");
    await page.getByPlaceholder("OR-2026-XXXXX").fill("QA-OCT2-OR-USD");
    await page.getByRole("button", { name: "Verify & record invoice" }).click();
    await page.getByText("Payment verified · invoice recorded").first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    const { data: p } = await db.from("payments").select("*").eq("id", payment.id).single();
    if (p?.proof_document_id) created.push({ table: "documents", id: p.proof_document_id, ref: "proof (USD)" });
    const { data: coms } = await db.from("commissions").select("*").eq("client_id", client.id);
    for (const c of coms ?? []) record("commissions", c);
    const { data: tasks } = await db.from("tasks").select("*").eq("client_id", client.id);
    for (const k of tasks ?? []) record("tasks", k);
    if (p?.status === "Verified" && p.currency === "USD") t.pass(`Payment verified, currency still USD (OR ${p.or_number})`);
    else t.fail(`After verify: status ${p?.status}, currency ${p?.currency}`);
    if (coms?.length === 1 && coms[0].currency === "USD") t.pass(`Commission row ${coms[0].id} created with currency USD (est ${coms[0].estimated_amount}, rate ${coms[0].rate_pct})`);
    else t.fail(`Expected one USD commission row, got ${JSON.stringify((coms ?? []).map((c) => [c.currency, c.estimated_amount]))}`);
    await t.shot("82-verified");
  });

  await step(t, "/commissions shows US$ separately", async () => {
    await page.goto("/commissions", NAV);
    await settle(page);
    await page.locator("input[placeholder^='Search']").first().fill(label("Payments USD")).catch(() => {});
    await page.waitForTimeout(500);
    const row = page.locator("tbody tr", { hasText: clientName }).first();
    const text = (await row.textContent().catch(() => ""))?.replace(/\s+/g, " ").trim();
    await t.shot("82-commissions");
    if (/US\$/.test(text)) t.pass(`Commission row shows US$: ${text.slice(0, 160)}`);
    else t.fail(`Commission row has no US$: "${text.slice(0, 160)}"`);
    const stats = await page.locator("div.rounded-lg.border.px-4").allTextContents();
    const usdStat = stats.find((s) => /US\$/.test(s));
    if (usdStat) t.pass(`Commission stat separates USD: ${usdStat.replace(/\s+/g, " ").trim()}`);
    else t.note(`No commission stat card shows US$ (stats: ${stats.map((s) => s.replace(/\s+/g, " ").trim()).join(" | ")})`);
    await page.getByRole("button", { name: /^Paid$/ }).count();
  });

  await step(t, "renewals/policies pages for the USD policy", async () => {
    await page.goto("/policies", NAV);
    await settle(page);
    await page.locator("input[placeholder^='Search']").first().fill(label("Payments USD"));
    await page.waitForTimeout(500);
    const row = page.locator("tbody tr", { hasText: clientName }).first();
    const text = (await row.textContent().catch(() => ""))?.replace(/\s+/g, " ").trim();
    await t.shot("82-policies");
    if (/US\$/.test(text)) t.pass(`/policies row shows US$: ${text.slice(0, 160)}`);
    else t.bug(`/policies lists the USD policy premium without US$: "${text.slice(0, 160)}" (peso() regardless of policies.currency)`);
    await page.goto("/renewals", NAV);
    await settle(page);
    await page.locator("input[placeholder^='Search']").first().fill(label("Payments USD"));
    await page.waitForTimeout(500);
    const rrow = page.locator("tbody tr", { hasText: clientName }).first();
    const rtext = (await rrow.textContent().catch(() => ""))?.replace(/\s+/g, " ").trim();
    await t.shot("82-renewals");
    if (/US\$/.test(rtext)) t.pass(`/renewals row shows US$: ${rtext.slice(0, 160)}`);
    else t.bug(`/renewals lists the USD policy's premium without US$: "${rtext.slice(0, 160)}" (peso() in operations.tsx:346)`);
  });

  return t.finish();
}

/* ======================================================================================
 * 8.3 Installments
 * ==================================================================================== */
async function section83() {
  const t = await startFeature("8.3-installments");
  const { page } = t;
  t.context.setDefaultTimeout(45000);
  const clientA = await createTestClient(label("Payments SemiAnnual"), { lifecycle_stage: "Client", product_interest: "Blue Royale" });
  const clientB = await createTestClient(label("Payments Annual"), { lifecycle_stage: "Client", product_interest: "Blue Royale" });
  const clientC = await createTestClient(label("Payments FreqFallback"), { lifecycle_stage: "Client", product_interest: "Blue Royale", payment_frequency: "Semi-annual" });
  for (const c of [clientA, clientB, clientC]) record("clients", c);

  const seedPolicy = (client, extra) =>
    insert("policies", {
      client_id: client.id,
      product_id: BLUE_ROYALE_PRODUCT,
      product_version_id: BLUE_ROYALE_VERSION,
      status: "Active",
      effective_date: "2026-06-01",
      expiry_date: "2027-05-31",
      renewal_date: "2027-05-31",
      currency: "PHP",
      premium_amount: 10000,
      notes: "QA OCT2 seeded policy (8.3)",
      ...extra,
    });

  const check = async (label, client, expected) => {
    await new Promise((r) => setTimeout(r, 800));
    const { data: ren } = await db.from("renewals").select("*").eq("client_id", client.id);
    for (const r of ren ?? []) record("renewals", r);
    const pays = (await paymentsFor(client.id)).sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0));
    for (const p of pays) record("payments", p);
    const got = pays.map((p) => `${p.status} ${p.amount} ${p.installment_number}/${p.installment_count}`);
    const ok = pays.length === expected.length && expected.every((e, i) => pays[i].status === "Awaiting" && Number(pays[i].amount) === e.amount && pays[i].installment_number === e.n && pays[i].installment_count === e.of);
    if (ok) t.pass(`${label}: DB has ${pays.length} Awaiting renewal payment(s): ${got.join(" · ")}`);
    else t.fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
    return pays;
  };

  await step(t, "1 Semi-Annual policy → two half payments", async () => {
    const p = await seedPolicy(clientA, { policy_number: "QA-OCT2-PC-SEMI", payment_mode: "Semi-Annual" });
    t.note(`Seeded policy ${p.reference_no} Semi-Annual ₱10,000, renewal 2027-05-31`);
    await check("Semi-Annual", clientA, [{ amount: 5000, n: 1, of: 2 }, { amount: 5000, n: 2, of: 2 }]);
  });
  await step(t, "2 Annual policy → one full payment", async () => {
    const p = await seedPolicy(clientB, { policy_number: "QA-OCT2-PC-ANNUAL", payment_mode: "Annual" });
    t.note(`Seeded policy ${p.reference_no} Annual ₱10,000`);
    await check("Annual", clientB, [{ amount: 10000, n: 1, of: 1 }]);
  });
  await step(t, "3 no payment_mode, client payment_frequency Semi-annual → two halves", async () => {
    const p = await seedPolicy(clientC, { policy_number: "QA-OCT2-PC-FALLBACK", payment_mode: null, premium_amount: 8000 });
    t.note(`Seeded policy ${p.reference_no} payment_mode NULL, client.payment_frequency "Semi-annual", ₱8,000`);
    await check("Fallback to client frequency", clientC, [{ amount: 4000, n: 1, of: 2 }, { amount: 4000, n: 2, of: 2 }]);
  });

  await step(t, "Sync policies on /renewals (admin)", async () => {
    await page.goto("/renewals", NAV);
    await settle(page);
    const sync = page.getByRole("button", { name: "Sync policies" });
    if (!(await sync.count())) throw new Error("Sync policies button not visible for admin");
    await sync.click();
    const toast = page.getByText("Policy renewals synced").first();
    await toast.waitFor({ timeout: 30000 });
    const detail = await toast.locator("xpath=..").textContent();
    t.pass(`Sync policies → ${detail?.replace(/\s+/g, " ").trim()}`);
    await page.waitForTimeout(1500);
    await t.shot("83-synced");
    const before = await paymentsFor(clientA.id);
    if (before.length === 2) t.pass("Sync did not duplicate the Semi-Annual installments (still 2)");
    else t.fail(`After sync, Semi-Annual client has ${before.length} payments`);
    await page.locator("input[placeholder^='Search']").first().fill(RUN);
    await page.waitForTimeout(500);
    await t.shot("83-renewals-rows");
    const n = await page.locator("tbody tr", { hasText: RUN }).count();
    t.note(`/renewals lists ${n} QA OCT2 Payments * ${RUN} renewal rows`);
  });

  await step(t, "/payments shows installment 1/2 and 2/2 at ₱5,000", async () => {
    await gotoPayments(page, label("Payments SemiAnnual"));
    const rows = paymentRows(page, label("Payments SemiAnnual"));
    const n = await rows.count();
    const texts = [];
    for (let i = 0; i < n; i++) texts.push((await rows.nth(i).textContent()).replace(/\s+/g, " ").trim());
    await t.shot("83-payments-semi");
    const has = (re) => texts.some((x) => re.test(x));
    if (n === 2 && has(/installment 1\/2/) && has(/installment 2\/2/) && texts.every((x) => /₱5,000/.test(x) && /Renewal/.test(x) && /Awaiting/.test(x)))
      t.pass("Two Awaiting Renewal rows at ₱5,000 labelled installment 1/2 and 2/2");
    else t.fail(`Expected two ₱5,000 Awaiting Renewal rows (1/2, 2/2); got ${n}: ${texts.join(" || ")}`);
    await gotoPayments(page, label("Payments Annual"));
    const arows = paymentRows(page, `${QA_PREFIX} ${label("Payments Annual")}`);
    const an = await arows.count();
    const atext = an ? (await arows.first().textContent()).replace(/\s+/g, " ").trim() : "";
    await t.shot("83-payments-annual");
    if (an === 1 && /₱10,000/.test(atext) && /Awaiting/.test(atext)) t.pass(`Annual: one Awaiting Renewal row ₱10,000 (${/installment \d\/\d/.exec(atext)?.[0] ?? "no installment label"})`);
    else t.fail(`Annual: expected one ₱10,000 row, got ${an}: ${atext}`);
    if (/installment 1\/1/.test(atext)) t.bug("Low: an Annual (single) renewal payment is labelled “installment 1/1” on /payments — redundant for a non-installment payment");
    await gotoPayments(page, label("Payments FreqFallback"));
    const frows = paymentRows(page, label("Payments FreqFallback"));
    const fn = await frows.count();
    const ftexts = [];
    for (let i = 0; i < fn; i++) ftexts.push((await frows.nth(i).textContent()).replace(/\s+/g, " ").trim());
    await t.shot("83-payments-fallback");
    if (fn === 2 && ftexts.every((x) => /₱4,000/.test(x)) && ftexts.some((x) => /installment 1\/2/.test(x)) && ftexts.some((x) => /installment 2\/2/.test(x)))
      t.pass("Client payment_frequency fallback: two ₱4,000 rows labelled 1/2 and 2/2");
    else t.fail(`Fallback: expected two ₱4,000 rows; got ${fn}: ${ftexts.join(" || ")}`);
  });

  await step(t, "Verify first installment advances renewal", async () => {
    await gotoPayments(page, label("Payments SemiAnnual"));
    const row = paymentRows(page, label("Payments SemiAnnual")).filter({ hasText: "installment 1/2" }).first();
    await row.getByRole("button", { name: "Verify Payment" }).click();
    await page.locator("h2", { hasText: "Verify payment" }).waitFor({ timeout: 10000 });
    const summary = await summaryValue(page, "Amount");
    t.note(`Verify drawer for installment 1/2 summary: ${summary}`);
    const srcLine = await summaryValue(page, "Source");
    if (!/installment/i.test(srcLine ?? "") && !/installment/i.test(summary ?? "")) t.bug(`Low: Verify payment drawer summary does not mention which installment (1/2) is being verified — Source line "${srcLine}"`);
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  return t.finish();
}

/* ====================================================================================== */
const fails = [];
const sections = { "8.1": section81, "8.2": section82, "8.3": section83 };
console.log(`run tag: ${RUN}`);
for (const fn of ONLY ? [sections[ONLY]] : Object.values(sections)) {
  try {
    fails.push(await fn());
  } catch (err) {
    console.error(`${fn.name} crashed: ${err.stack}`);
    fails.push(1);
  }
}
console.log("\n## Created records");
for (const c of created) console.log(`- ${c.table} · ${c.id} · ${c.ref}`);
console.log(`\nfail/bug counts: ${fails.join(", ")}`);
