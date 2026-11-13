/**
 * TESTING-OCT2.md §9 — Commissions.
 *   9.1 rates, net formula, breakdown (H9a–c)
 *   9.2 file the commission voucher (H9d)
 *
 *   node --env-file=.env.local qa-oct2/09-commissions.mjs
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { startFeature, settle, db, loadProducts, createTestClient, SAMPLE_PDF, QA_PREFIX, ROOT } from "./lib.mjs";

const today = new Date().toISOString().slice(0, 10);
const plusYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
const created = []; // { table, id, ref }
const settingsLog = [];
const record = (table, row) => created.push({ table, id: row.id, ref: row.reference_no ?? row.policy_number ?? null });

async function step(t, name, fn) {
  try {
    await fn();
  } catch (err) {
    t.fail(`${name}: ${err.message.split("\n")[0]}`);
    await t.shot(`fail-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`).catch(() => {});
  }
}

async function openPersona(page, label) {
  const { data: me } = await db.from("users").select("full_name").eq("email", "playwright-staff@prodigitality.net").single();
  const first = (me?.full_name ?? "").split(" ")[0];
  await page.getByRole("button", { name: new RegExp(`${first}$`) }).first().click();
  await page.getByRole("button", { name: new RegExp(`^${label}( ·|$)`) }).click();
  await settle(page);
}

const products = await loadProducts();
const { data: versions } = await db.from("product_versions").select("id,product_id").eq("status", "Active");
const versionOf = (product) => versions.find((v) => v.product_id === product.id)?.id;
const activeVersion = {
  select: versionOf(products.select),
  blueRoyale: versionOf(products.blueRoyale),
  flexiShield: versionOf(products.flexiShield),
};

async function seedPolicy(client, product, premium, suffix) {
  const { data, error } = await db
    .from("policies")
    .insert({
      client_id: client.id,
      product_version_id: activeVersion[product],
      policy_number: `QA-OCT2-${suffix}-${Date.now().toString().slice(-6)}`,
      status: "Active",
      effective_date: today,
      expiry_date: plusYear,
      currency: "PHP",
      premium_amount: premium,
      payment_mode: "Annual",
    })
    .select("*")
    .single();
  if (error) throw new Error(`policy insert: ${error.message}`);
  record("policies", data);
  return data;
}

async function seedPayment(client, policy, amount, extra = {}) {
  const { data, error } = await db
    .from("payments")
    .insert({ client_id: client.id, policy_id: policy.id, amount, currency: "PHP", status: "Awaiting", ...extra })
    .select("*")
    .single();
  if (error) throw new Error(`payment insert: ${error.message}`);
  record("payments", data);
  return data;
}
async function seedRenewal(client, policy) {
  // A DB trigger may already open a renewal cycle for a new policy (unique open cycle per policy).
  const { data: existing } = await db.from("renewals").select("*").eq("policy_id", policy.id).limit(1);
  if (existing?.length) {
    record("renewals", existing[0]);
    return existing[0];
  }
  const { data, error } = await db
    .from("renewals")
    .insert({ client_id: client.id, policy_id: policy.id, policy_expiry_date: plusYear, renewal_due_date: plusYear, status: "Reminder Sent" })
    .select("*")
    .single();
  if (error) throw new Error(`renewal insert: ${error.message}`);
  record("renewals", data);
  return data;
}

/** Drive Payments → Verify Payment for one seeded payment; returns the commission row. */
async function verifyPaymentViaUi(t, payment, orNumber) {
  const page = t.page;
  t.context.setDefaultTimeout(45_000);
  page.setDefaultNavigationTimeout(120_000);
  await page.goto("/payments", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await settle(page, 2500);
  await page.getByPlaceholder("Search payments…").fill(payment.reference_no);
  await page.waitForTimeout(600);
  const row = page.getByRole("row").filter({ hasText: payment.reference_no });
  if ((await row.count()) !== 1) throw new Error(`payment row ${payment.reference_no} not found (count ${await row.count()})`);
  await row.getByRole("button", { name: "Verify Payment" }).click();
  await page.getByLabel("Proof of payment").setInputFiles(SAMPLE_PDF);
  await page.getByLabel("Payment status").selectOption("Verified");
  await page.getByPlaceholder("OR-2026-XXXXX").fill(orNumber);
  await page.getByRole("button", { name: "Verify & record invoice" }).click();
  const started = Date.now();
  let toastSeen = false;
  let commission = null;
  while (Date.now() - started < 150_000) {
    if (!toastSeen && (await page.getByText("Payment verified · invoice recorded").count())) toastSeen = true;
    const { data } = await db.from("commissions").select("*").eq("payment_id", payment.id).maybeSingle();
    if (data) { commission = data; break; }
    await page.waitForTimeout(2000);
  }
  t.note(`verify ${payment.reference_no}: commission row after ${Math.round((Date.now() - started) / 1000)}s; success toast observed=${toastSeen}`);
  await settle(page, 2500);
  if (!commission) throw new Error("no commissions row created for payment within 150s");
  record("commissions", commission);
  const { data: docs } = await db.from("documents").select("id,reference_no").eq("client_id", payment.client_id).eq("document_type", "Proof of Payment");
  for (const d of docs ?? []) if (!created.some((c) => c.id === d.id)) record("documents", d);
  const { data: tasks } = await db.from("tasks").select("id,title,notes").eq("client_id", payment.client_id).ilike("title", `%OR ${orNumber}%`);
  for (const task of tasks ?? []) record("tasks", task);
  return { commission, task: tasks?.[0] ?? null };
}

const shared = {};

/* ============================== 9.1 ============================== */
{
  const t = await startFeature("9.1-commission-rates");
  const page = t.page;
  t.context.setDefaultTimeout(45_000);
  page.setDefaultNavigationTimeout(120_000);
  let addedRateId = null;

  await step(t, "9.1.1 open Settings → Commission Rates", async () => {
    await page.goto("/settings", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await settle(page, 3000);
    await page.getByRole("button", { name: "Commission Rates" }).click();
    await settle(page);
    await page.getByRole("heading", { name: "Commission rates" }).waitFor();
    await t.shot("9.1-rates-table");
  });

  const rateRow = (product, business) =>
    page.getByRole("row").filter({ has: page.locator("td", { hasText: new RegExp(`^${product}$`) }) }).filter({ has: page.locator("td", { hasText: new RegExp(`^${business}$`) }) });

  const expectRate = async (product, business, expected) => {
    const row = rateRow(product, business);
    const n = await row.count();
    if (n !== 1) return t.fail(`9.1.1 rate row ${product}/${business}: expected 1 row, found ${n}`);
    const txt = (await row.first().textContent()) ?? "";
    if (txt.includes(expected)) t.pass(`9.1.1 ${product} ${business} shows ${expected}`);
    else t.fail(`9.1.1 ${product} ${business}: expected "${expected}" in row, got "${txt.trim()}"`);
  };

  await step(t, "9.1.1 seeded rates", async () => {
    await expectRate("Select", "New", "20%");
    await expectRate("Select", "Renewal", "20%");
    await expectRate("Blue Royale", "New", "22.5%");
    await expectRate("Blue Royale", "Renewal", "20%");
    await expectRate("TravelSafe", "New", "30%");
    await expectRate("TravelSafe", "Renewal", "30%");
    await expectRate("FlexiShield", "New", "Pending");
    await expectRate("FlexiShield", "Renewal", "Pending");
    await expectRate("BC Flexi", "New", "Pending");
    await expectRate("BC Flexi", "Renewal", "Pending");
    const travelIns = await page.getByRole("row").filter({ hasText: "Travel Insurance" }).count();
    t.note(`9.1.1 rows for product "Travel Insurance" (inactive product): ${travelIns} — rates exist for "TravelSafe" (active)`);
    const formula = await page.getByText("Estimates = premium × 0.88").count();
    if (formula) t.pass("9.1.1 formula explanation shown above table"); else t.fail("9.1.1 formula explanation text missing");
  });

  await step(t, "9.1.1 admin adds effective-dated FlexiShield New rate 15%", async () => {
    const { data: before } = await db.from("commission_rates").select("id").eq("product_id", products.flexiShield.id).eq("business_type", "New");
    const beforeIds = new Set((before ?? []).map((r) => r.id));
    await rateRow("FlexiShield", "New").getByRole("button", { name: "Edit" }).click();
    await page.getByRole("heading", { name: "Edit commission rate" }).waitFor();
    await page.getByPlaceholder("Blank = pending").fill("15");
    const dateInput = page.locator('input[type="date"]');
    const dateVal = await dateInput.inputValue();
    if (dateVal !== today) t.note(`9.1.1 edit modal default effective date = ${dateVal} (today ${today})`);
    await dateInput.fill(today);
    const hint = await page.getByText("A new effective date adds a new row").count();
    if (hint) t.pass("9.1.1 modal explains a new effective date adds a history row"); else t.fail("9.1.1 modal history hint not shown for new date");
    await page.getByPlaceholder("e.g. Per Pacific Cross schedule").fill("QA OCT2 temporary rate");
    await t.shot("9.1-edit-rate-modal");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Commission rate saved").waitFor({ timeout: 90_000 });
    await settle(page, 2500);
    const { data: after } = await db.from("commission_rates").select("*").eq("product_id", products.flexiShield.id).eq("business_type", "New");
    const added = (after ?? []).find((r) => !beforeIds.has(r.id));
    if (!added) throw new Error("no new commission_rates row inserted");
    addedRateId = added.id;
    settingsLog.push(`commission_rates ${added.id} (FlexiShield / New / 15% / ${added.effective_date}) INSERTED by UI`);
    if (added.rate_pct === 15 && added.effective_date === today && (after ?? []).length === before.length + 1)
      t.pass(`9.1.1 new rate row ${added.id} (15%, ${today}); earlier row kept (${after.length} rows for FlexiShield/New)`);
    else t.fail(`9.1.1 unexpected new row ${JSON.stringify(added)}`);
    const row = rateRow("FlexiShield", "New");
    const cell = row.first().locator("td", { hasText: "15%" });
    try { await cell.waitFor({ timeout: 60_000 }); } catch { /* checked below */ }
    const txt = (await row.first().textContent()) ?? "";
    if (txt.includes("15%")) t.pass("9.1.1 table now shows FlexiShield New = 15% (after router.refresh)"); else t.fail(`9.1.1 table did not update to 15% within 60s: "${txt.trim()}"`);
    const hist = row.getByRole("button", { name: /History \(1\)/ });
    if (await hist.count()) {
      await hist.click();
      const earlier = await page.getByText("Earlier rate").count();
      if (earlier) t.pass("9.1.1 History (1) expands to show the earlier Pending rate"); else t.fail("9.1.1 History toggle did not reveal earlier rate");
      await t.shot("9.1-rate-history");
    } else t.fail("9.1.1 History (1) button not shown after adding a new effective-dated rate");
  });

  await step(t, "9.1.1 View as Staff → read-only", async () => {
    await openPersona(page, "Staff");
    await page.getByRole("button", { name: "Commission Rates" }).click();
    await settle(page);
    const ro = await page.getByText("Only admins can change commission rates.").count();
    const edits = await page.getByRole("button", { name: "Edit", exact: true }).count();
    if (ro && edits === 0) t.pass("9.1.1 Staff preview: read-only notice shown, no Edit buttons");
    else t.fail(`9.1.1 Staff preview: notice=${ro} editButtons=${edits}`);
    await t.shot("9.1-staff-readonly");
    await openPersona(page, "Admin");
  });

  await step(t, "9.1.1 restore: delete temporary FlexiShield rate", async () => {
    if (!addedRateId) throw new Error("nothing to delete");
    const { error } = await db.from("commission_rates").delete().eq("id", addedRateId);
    if (error) throw new Error(error.message);
    const { data: check } = await db.from("commission_rates").select("id").eq("id", addedRateId);
    if ((check ?? []).length === 0) settingsLog.push(`commission_rates ${addedRateId} DELETED via db — verified gone`);
    await page.goto("/settings", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await settle(page, 2500);
    await page.getByRole("button", { name: "Commission Rates" }).click();
    await settle(page);
    const txt = (await rateRow("FlexiShield", "New").first().textContent()) ?? "";
    if (txt.includes("Pending") && !txt.includes("15%")) t.pass("9.1.1 after deleting temp rate, FlexiShield New shows Pending again");
    else t.fail(`9.1.1 FlexiShield New after restore: "${txt.trim()}"`);
  });

  /* ---- seed client, policies, payments ---- */
  let client;
  let paySelect, payBrRenewal, payBrNew, payFlexi;
  await step(t, "9.1.2 seed QA client + policies + awaiting payments", async () => {
    client = await createTestClient("Commissions", { product_interest: "Select" });
    record("clients", client);
    const polSelect = await seedPolicy(client, "select", 134000, "SEL");
    const polBrRen = await seedPolicy(client, "blueRoyale", 250000, "BRR");
    const polBrNew = await seedPolicy(client, "blueRoyale", 250000, "BRN");
    const polFlexi = await seedPolicy(client, "flexiShield", 50000, "FLX");
    const renewal = await seedRenewal(client, polBrRen);
    paySelect = await seedPayment(client, polSelect, 134000);
    payBrRenewal = await seedPayment(client, polBrRen, 250000, { renewal_id: renewal.id });
    payBrNew = await seedPayment(client, polBrNew, 250000);
    payFlexi = await seedPayment(client, polFlexi, 50000);
    shared.client = client;
    t.pass(`9.1.2 seeded client ${client.id}, 4 policies, renewal ${renewal.reference_no}, payments ${[paySelect, payBrRenewal, payBrNew, payFlexi].map((p) => p.reference_no).join(", ")}`);
  });

  const or = (s) => `QA-OR-${s}-${Date.now().toString().slice(-5)}`;
  const checkNet = async (label, payment, orNo, expectedNet, expectedRate) => {
    const { commission, task } = await verifyPaymentViaUi(t, payment, orNo);
    if (commission.estimated_amount === expectedNet && commission.rate_pct === expectedRate)
      t.pass(`${label}: commission ${commission.id} estimated_amount=${commission.estimated_amount} rate_pct=${commission.rate_pct}`);
    else t.fail(`${label}: expected net ${expectedNet} @ ${expectedRate}%, got estimated_amount=${commission.estimated_amount} rate_pct=${commission.rate_pct} rate_id=${commission.commission_rate_id}`);
    return { commission, task };
  };

  await step(t, "9.1.2 verify ₱134,000 Select payment → ₱21,225.60", async () => {
    const orNo = or("SEL");
    shared.orSelect = orNo;
    const { commission } = await checkNet("9.1.2 Select 134,000", paySelect, orNo, 21225.6, 20);
    shared.commissionSelect = commission;
    await t.shot("9.1-select-verified");
  });

  await step(t, "9.1.3 Blue Royale renewal ₱250,000 → ₱39,600", async () => {
    const orNo = or("BRR");
    shared.orBrRenewal = orNo;
    const { commission } = await checkNet("9.1.3 Blue Royale renewal 250,000", payBrRenewal, orNo, 39600, 20);
    shared.commissionBrRenewal = commission;
  });

  await step(t, "9.1.3 Blue Royale new ₱250,000 → ₱44,550", async () => {
    const orNo = or("BRN");
    shared.orBrNew = orNo;
    const { commission } = await checkNet("9.1.3 Blue Royale new 250,000", payBrNew, orNo, 44550, 22.5);
    shared.commissionBrNew = commission;
  });

  await step(t, "9.1.5 FlexiShield (pending rate) payment", async () => {
    const orNo = or("FLX");
    shared.orFlexi = orNo;
    const { commission, task } = await verifyPaymentViaUi(t, payFlexi, orNo);
    shared.commissionFlexi = commission;
    if (commission.estimated_amount == null && commission.rate_pct == null) t.pass(`9.1.5 FlexiShield commission ${commission.id}: no invented amount (estimated_amount null, rate_pct null)`);
    else t.fail(`9.1.5 FlexiShield commission has amount ${commission.estimated_amount} rate ${commission.rate_pct} although rate is pending`);
    if (task?.notes?.includes("Commission rate pending for FlexiShield") && task.notes.includes("Settings → Commission Rates"))
      t.pass(`9.1.5 follow-up task "${task.title}" carries note: ${task.notes}`);
    else t.fail(`9.1.5 follow-up task note missing/incorrect: ${JSON.stringify(task)}`);
  });

  /* ---- commissions screen ---- */
  await step(t, "9.1.2-5 /commissions rows + Show breakdown", async () => {
    await page.goto("/commissions", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await settle(page, 3000);
    await page.getByPlaceholder("Search commissions…").fill(QA_PREFIX);
    await page.waitForTimeout(600);
    await t.shot("9.1-commissions-list");
    const rowFor = (orNo) => page.getByRole("row").filter({ hasText: orNo });

    const expectText = async (label, orNo, needle) => {
      const row = rowFor(orNo);
      if ((await row.count()) !== 1) return t.fail(`${label}: row for ${orNo} count ${await row.count()}`);
      const txt = (await row.textContent()) ?? "";
      if (txt.includes(needle)) t.pass(`${label}: row shows "${needle}"`);
      else t.fail(`${label}: expected "${needle}" in row, got "${txt.trim()}"`);
      return txt;
    };
    const selTxt = await expectText("9.1.2 Select row", shared.orSelect, "₱21,225.6");
    if (selTxt && !selTxt.includes("₱21,225.60")) t.bug(`9.1.2 papercut: net shown as "₱21,225.6" instead of "₱21,225.60" (money() uses maximumFractionDigits 2 without minimumFractionDigits)`);
    await expectText("9.1.3 Blue Royale renewal row", shared.orBrRenewal, "₱39,600");
    await expectText("9.1.3 Blue Royale new row", shared.orBrNew, "₱44,550");
    await expectText("9.1.2 Select row rate subtitle", shared.orSelect, "20% · net of VAT and WHT");

    // breakdown on the Select row
    const sel = rowFor(shared.orSelect);
    await sel.getByRole("button", { name: "Show breakdown" }).click();
    await page.waitForTimeout(400);
    await t.shot("9.1-breakdown-select");
    const txt = (await sel.textContent()) ?? "";
    const expectedLines = ["Premium₱134,000", "Less VAT (12%)− ₱16,080", "Commission base₱117,920", "× rate (20%)₱23,584", "Less WHT (10%)− ₱2,358.4", "Net commission₱21,225.6", "Select · New · rate effective", "VAT basis is an assumption pending finance (DH16)"];
    for (const line of expectedLines) {
      if (txt.includes(line)) t.pass(`9.1.4 breakdown line "${line}"`);
      else t.fail(`9.1.4 breakdown missing "${line}" — row text: ${txt.trim()}`);
    }
    if (await sel.getByRole("button", { name: "Hide breakdown" }).count()) t.pass("9.1.4 toggle flips to Hide breakdown");

    // breakdown on the Blue Royale renewal row (rate source shows Renewal)
    const brr = rowFor(shared.orBrRenewal);
    await brr.getByRole("button", { name: "Show breakdown" }).click();
    await page.waitForTimeout(400);
    const brTxt = (await brr.textContent()) ?? "";
    for (const line of ["Premium₱250,000", "Less VAT (12%)− ₱30,000", "Commission base₱220,000", "× rate (20%)₱44,000", "Less WHT (10%)− ₱4,400", "Net commission₱39,600", "Blue Royale · Renewal · rate effective"]) {
      if (brTxt.includes(line)) t.pass(`9.1.4 BR renewal breakdown "${line}"`);
      else t.fail(`9.1.4 BR renewal breakdown missing "${line}" — ${brTxt.trim()}`);
    }
    await t.shot("9.1-breakdown-blue-royale");

    // pending-rate row
    const flx = rowFor(shared.orFlexi);
    const flxTxt = (await flx.textContent()) ?? "";
    if (flxTxt.includes("Commission rate pending")) t.pass("9.1.5 FlexiShield row shows 'Commission rate pending … Settings → Commission Rates'");
    else {
      t.bug(`9.1.5 FlexiShield commission row shows no "Commission rate pending … set it in Settings → Commission Rates" text in the Commission column (row shows "${flxTxt.replace(/\s+/g, " ").trim().slice(0, 160)}"). The pending note only lands in the follow-up task notes.`);
    }
    if (!/₱\d/.test(flxTxt.split("Commission")[0] ?? flxTxt.replace(/Assign contact…[\s\S]*/, ""))) t.pass("9.1.5 FlexiShield row has no invented amount (Commission column is —)");
    await t.shot("9.1-flexishield-pending");

    // tasks view of the pending note
    await page.goto("/tasks", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await settle(page, 2500);
    const taskVisible = await page.getByText(`Request commission voucher — ${QA_PREFIX}`, { exact: false }).count();
    t.note(`9.1.5 /tasks shows ${taskVisible} "Request commission voucher — ${QA_PREFIX}…" task card(s)`);
    const pendingVisible = await page.getByText("Commission rate pending for FlexiShield").count();
    t.note(`9.1.5 /tasks shows the "Commission rate pending for FlexiShield" note ${pendingVisible} time(s) without opening the task`);
    await t.shot("9.1-tasks");
  });

  await step(t, "9.1 final: rates table back to seeded state", async () => {
    const { data: rows } = await db.from("commission_rates").select("id").eq("product_id", products.flexiShield.id).eq("business_type", "New");
    if ((rows ?? []).length === 1 && !(rows ?? []).some((r) => r.id === addedRateId)) t.pass(`9.1 commission_rates FlexiShield/New back to 1 row; temp ${addedRateId} gone`);
    else t.fail(`9.1 commission_rates FlexiShield/New rows: ${JSON.stringify(rows)}`);
  });

  await t.finish();
}

/* ============================== 9.2 ============================== */
{
  const t = await startFeature("9.2-commission-voucher");
  const page = t.page;
  t.context.setDefaultTimeout(45_000);
  page.setDefaultNavigationTimeout(120_000);
  const target = shared.commissionSelect;
  const other = shared.commissionBrNew;
  const rowFor = (orNo) => page.getByRole("row").filter({ hasText: orNo });
  const snapshot = async (id) => {
    const { data } = await db.from("commissions").select("*").eq("id", id).single();
    return data;
  };
  const FIN = ["estimated_amount", "rate_pct", "commission_rate_id", "amount", "currency", "or_number", "payment_id"];
  const diffFin = (a, b) => FIN.filter((k) => a[k] !== b[k]);

  if (!target) {
    t.fail("9.2 no Select commission from 9.1 — cannot run voucher checks");
  } else {
    let before, paymentBefore;
    await step(t, "9.2 open /commissions and snapshot", async () => {
      before = await snapshot(target.id);
      const { data: p } = await db.from("payments").select("*").eq("id", target.payment_id).single();
      paymentBefore = p;
      await page.goto("/commissions", { waitUntil: "domcontentloaded", timeout: 120_000 });
      await settle(page, 3000);
      await page.getByPlaceholder("Search commissions…").fill(QA_PREFIX);
      await page.waitForTimeout(600);
      const txt = (await rowFor(shared.orSelect).textContent()) ?? "";
      if (txt.includes("Original not filed")) t.pass("9.2.2 before filing: row shows 'Original not filed'");
      else t.fail(`9.2.2 before filing expected 'Original not filed': ${txt.trim()}`);
    });

    // Mark the Blue Royale new row Paid first so we can check filing never moves Paid backwards.
    await step(t, "9.2.3 mark Blue Royale new row Paid (pre-filing)", async () => {
      const row = rowFor(shared.orBrNew);
      await row.getByRole("button", { name: "Mark Paid" }).click();
      await page.getByRole("button", { name: "Record payment" }).click();
      await page.getByText("Commission payment recorded").waitFor({ timeout: 90_000 });
      await settle(page, 2000);
      const r = await snapshot(other.id);
      if (r.voucher_status === "Paid" && r.paid_date) t.pass(`9.2.3 ${other.id} now Paid (paid_date ${r.paid_date})`);
      else t.fail(`9.2.3 Mark Paid did not set Paid: ${r.voucher_status}/${r.paid_date}`);
      const paidWait = Date.now();
      try { await rowFor(shared.orBrNew).getByText("Paid ·").waitFor({ timeout: 90_000 }); } catch { /* checked below */ }
      t.note(`9.2.3 row reflected Paid after ${Math.round((Date.now() - paidWait) / 1000)}s (router.refresh latency)`);
      const rtxt = (await rowFor(shared.orBrNew).textContent()) ?? "";
      if (rtxt.includes("Paid ·")) t.pass("9.2.3 row shows Paid · date and no Mark Paid button"); else t.fail(`9.2.3 row after paid: ${rtxt.trim()}`);
    });

    let docId1 = null;
    await step(t, "9.2.1 File voucher on Select row", async () => {
      await rowFor(shared.orSelect).getByRole("button", { name: "File voucher" }).click();
      await page.getByRole("heading", { name: "File voucher" }).waitFor();
      const modal = page.locator("div").filter({ has: page.getByRole("heading", { name: "File voucher" }) }).last();
      const mtxt = (await modal.textContent()) ?? "";
      for (const needle of ["Remove its password before uploading", "Client", "Assigned agent", "Product", "Plan", "Premium", "Commission estimate", "Current original", "Original not filed"]) {
        if (mtxt.includes(needle)) t.pass(`9.2.1 modal shows "${needle}"`); else t.fail(`9.2.1 modal missing "${needle}"`);
      }
      if (mtxt.includes("Select")) t.pass("9.2.1 modal Product = Select"); else t.bug(`9.2.1 modal Product/Plan not populated: ${mtxt.replace(/\s+/g, " ").slice(0, 300)}`);
      if (mtxt.includes("₱134,000")) t.pass("9.2.1 modal Premium = ₱134,000"); else t.fail("9.2.1 modal premium not ₱134,000");
      await t.shot("9.2-file-voucher-modal");
      await page.locator("label", { hasText: "Carrier voucher number" }).locator("input").fill("QA-OCT2-V-001");
      await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles(SAMPLE_PDF);
      await page.getByText("Voucher filed").waitFor({ timeout: 120_000 });
      await settle(page, 2500);
      const after = await snapshot(target.id);
      docId1 = after.voucher_document_id;
      if (docId1 && after.voucher_reference === "QA-OCT2-V-001" && after.voucher_received_at) t.pass(`9.2.1 commission now points at document ${docId1}, reference QA-OCT2-V-001`);
      else t.fail(`9.2.1 commission after filing: ${JSON.stringify(after)}`);
      const d = diffFin(before, after);
      if (d.length === 0) t.pass("9.2.3 premium/rate/estimate unchanged after filing (DB compare)"); else t.fail(`9.2.3 financial fields changed by filing: ${d.join(", ")}`);
      const { data: p } = await db.from("payments").select("*").eq("id", target.payment_id).single();
      if (p.amount === paymentBefore.amount && p.status === paymentBefore.status) t.pass("9.2.3 linked payment amount/status unchanged"); else t.fail("9.2.3 payment changed by filing");
      const fileWait = Date.now();
      try { await rowFor(shared.orSelect).getByText("Original filed ·").waitFor({ timeout: 90_000 }); } catch { /* checked below */ }
      t.note(`9.2.2 row reflected filed voucher after ${Math.round((Date.now() - fileWait) / 1000)}s (router.refresh latency)`);
      const rtxt = (await rowFor(shared.orSelect).textContent()) ?? "";
      if (rtxt.includes("QA-OCT2-V-001") && rtxt.includes("Original filed ·")) t.pass("9.2.2 row shows the voucher link + 'Original filed · date'"); else t.fail(`9.2.2 row after filing: ${rtxt.trim()}`);
      if (rtxt.includes("Replace voucher")) t.pass("9.2.2 button now reads Replace voucher"); else t.fail("9.2.2 no Replace voucher button");
      if (!rtxt.includes("Request Voucher") && !rtxt.includes("Log Follow-up")) t.pass("9.2.2 Request Voucher / Log Follow-up hidden once original filed"); else t.note("9.2.2 Request Voucher / Log Follow-up still shown after filing");
      await t.shot("9.2-after-filing");
    });

    await step(t, "9.2.2 original opens from the row (download route)", async () => {
      const link = rowFor(shared.orSelect).getByRole("link", { name: /QA-OCT2-V-001/ });
      const href = await link.getAttribute("href");
      if (href !== `/api/documents/${docId1}/download`) t.fail(`9.2.2 link href ${href}`);
      const res = await page.request.get(href);
      const ct = res.headers()["content-type"] ?? "";
      const body = await res.body();
      if (res.status() === 200 && ct.includes("pdf") && body.length > 100) t.pass(`9.2.2 GET ${href} → 200 ${ct} (${body.length} bytes)`);
      else t.fail(`9.2.2 GET ${href} → ${res.status()} ${ct} ${body.length} bytes`);
      const { data: docs } = await db.from("documents").select("id,reference_no,document_type,status,name,commission_id,version").eq("commission_id", target.id);
      for (const d of docs ?? []) record("documents", d);
      if ((docs ?? []).length === 1 && docs[0].document_type === "Commission Voucher") t.pass(`9.2.1 documents row ${docs[0].id} type 'Commission Voucher' status ${docs[0].status}`);
      else t.fail(`9.2.1 documents rows for commission: ${JSON.stringify(docs)}`);
    });

    await step(t, "9.2.2 Replace voucher keeps history", async () => {
      await rowFor(shared.orSelect).getByRole("button", { name: "Replace voucher" }).click();
      await page.getByRole("heading", { name: "Replace voucher" }).waitFor();
      const hint = await page.getByText("The previous original stays in the filing history when replaced.").count();
      if (hint) t.pass("9.2.2 replace modal explains history is kept"); else t.fail("9.2.2 replace modal history hint missing");
      const cur = await page.getByText("Current original").count();
      if (cur) t.pass("9.2.2 replace modal shows Current original");
      await page.locator("label", { hasText: "Carrier voucher number" }).locator("input").fill("QA-OCT2-V-002");
      await t.shot("9.2-replace-modal");
      await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles(SAMPLE_PDF);
      await page.getByText("Voucher filed").waitFor({ timeout: 120_000 });
      await settle(page, 2500);
      const after = await snapshot(target.id);
      const { data: docs } = await db.from("documents").select("id,reference_no,document_type,status,name,commission_id,version,file_path").eq("commission_id", target.id).order("created_at");
      for (const d of docs ?? []) if (!created.some((c) => c.id === d.id)) record("documents", d);
      if (after.voucher_document_id && after.voucher_document_id !== docId1 && after.voucher_reference === "QA-OCT2-V-002") t.pass(`9.2.2 commission now points at new document ${after.voucher_document_id}`);
      else t.fail(`9.2.2 commission after replace: ${JSON.stringify(after)}`);
      const old = (docs ?? []).find((d) => d.id === docId1);
      if ((docs ?? []).length === 2 && old) t.pass(`9.2.2 history kept: 2 documents rows for the commission (old ${docId1} status=${old.status}, new ${after.voucher_document_id})`);
      else t.fail(`9.2.2 documents after replace: ${JSON.stringify(docs)}`);
      const oldRes = await page.request.get(`/api/documents/${docId1}/download`);
      t.note(`9.2.2 previous original ${docId1} download → ${oldRes.status()} (history still retrievable: ${oldRes.status() === 200})`);
      const d = diffFin(before, after);
      if (d.length === 0) t.pass("9.2.3 premium/rate/estimate still unchanged after replace"); else t.fail(`9.2.3 changed by replace: ${d.join(", ")}`);
      if (after.voucher_status === before.voucher_status) t.pass(`9.2.3 voucher_status stays "${after.voucher_status}" after filing (filing does not record payment)`); else t.note(`9.2.3 voucher_status moved ${before.voucher_status} → ${after.voucher_status} on filing`);
      await t.shot("9.2-after-replace");
    });

    await step(t, "9.2.2 other rows show 'Original not filed'", async () => {
      for (const orNo of [shared.orBrRenewal, shared.orBrNew, shared.orFlexi]) {
        const txt = (await rowFor(orNo).textContent()) ?? "";
        if (txt.includes("Original not filed")) t.pass(`9.2.2 ${orNo} shows Original not filed`); else t.fail(`9.2.2 ${orNo}: ${txt.trim()}`);
      }
    });

    await step(t, "9.2.3 filing on a Paid row does not move it backwards", async () => {
      const paidBefore = await snapshot(other.id);
      await rowFor(shared.orBrNew).getByRole("button", { name: "File voucher" }).click();
      await page.getByRole("heading", { name: "File voucher" }).waitFor();
      await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles(SAMPLE_PDF);
      await page.getByText("Voucher filed").waitFor({ timeout: 120_000 });
      await settle(page, 2500);
      const paidAfter = await snapshot(other.id);
      const { data: docs } = await db.from("documents").select("id").eq("commission_id", other.id);
      for (const d of docs ?? []) record("documents", d);
      if (paidAfter.voucher_status === "Paid" && paidAfter.paid_date === paidBefore.paid_date && paidAfter.voucher_document_id)
        t.pass(`9.2.3 Paid row stays Paid (paid_date ${paidAfter.paid_date}) after filing voucher ${paidAfter.voucher_document_id}`);
      else t.fail(`9.2.3 Paid row after filing: ${paidAfter.voucher_status} paid_date ${paidAfter.paid_date}`);
      if (diffFin(paidBefore, paidAfter).length === 0) t.pass("9.2.3 Paid row financials unchanged"); else t.fail("9.2.3 Paid row financials changed");
      try { await rowFor(shared.orBrNew).getByText("Original filed ·").waitFor({ timeout: 90_000 }); } catch { /* checked below */ }
      const rtxt = (await rowFor(shared.orBrNew).textContent()) ?? "";
      if (rtxt.includes("Paid ·")) t.pass("9.2.3 UI still shows Paid · date"); else t.fail(`9.2.3 UI row: ${rtxt.trim()}`);
      await t.shot("9.2-paid-row-filed");
    });

    await step(t, "9.2.2 Mark Paid after filing (payment can be recorded after filing)", async () => {
      const row = rowFor(shared.orSelect);
      await row.getByRole("button", { name: "Mark Paid" }).click();
      await page.getByRole("button", { name: "Record payment" }).click();
      await page.getByText("Commission payment recorded").waitFor({ timeout: 90_000 });
      await settle(page, 2000);
      const after = await snapshot(target.id);
      if (after.voucher_status === "Paid" && after.voucher_document_id) t.pass("9.2.2 Select row Paid after filing; voucher pointer kept"); else t.fail(`9.2.2 after Mark Paid: ${after.voucher_status} doc ${after.voucher_document_id}`);
      if (after.estimated_amount === before.estimated_amount && after.amount === before.amount) t.pass("9.2.3 Mark Paid did not turn the estimate into an actual amount");
    });

    await step(t, "9.2.4 View as Agent", async () => {
      const { data: me } = await db.from("users").select("full_name").eq("email", "playwright-staff@prodigitality.net").single();
      const first = (me?.full_name ?? "").split(" ")[0];
      await page.getByRole("button", { name: new RegExp(`${first}$`) }).first().click();
      await page.getByRole("button", { name: /^Agent$/ }).click();
      await settle(page, 2000);
      await page.getByPlaceholder("Search commissions…").fill(QA_PREFIX);
      await page.waitForTimeout(600);
      const txt = (await rowFor(shared.orSelect).textContent()) ?? "";
      if (txt.includes("•••••")) t.pass("9.2.4 Agent preview hides commission amounts (•••••)"); else t.fail(`9.2.4 Agent preview amount: ${txt.trim()}`);
      const stats = (await page.getByText("Restricted").count());
      t.note(`9.2.4 Agent preview: "Restricted" stat tiles = ${stats}; voucher link visible = ${txt.includes("QA-OCT2-V-002")}; File/Replace button visible = ${txt.includes("Replace voucher")}; Mark Paid visible = ${txt.includes("Mark Paid")}`);
      t.note("9.2.4 'View as' is client-side only: canReadVoucher/canFileVoucher come from the server for the real (admin) role, so an admin previewing Agent still sees voucher links and filing controls; true agent scoping (own clients only, via commissionCapabilities) cannot be exercised headlessly without an agent login.");
      await t.shot("9.2-agent-preview");
      await page.getByRole("button", { name: new RegExp(`${first}$`) }).first().click();
      await page.getByRole("button", { name: /^Admin · Owner$/ }).click();
      await settle(page);
    });

    await step(t, "9.2.4 client profile: voucher document hidden from delete + file path", async () => {
      await page.goto(`/clients/${shared.client.id}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await settle(page, 3000);
      const vouch = await page.getByText("Commission Voucher").count();
      t.note(`9.2.4 client profile mentions "Commission Voucher" ${vouch} time(s)`);
      await t.shot("9.2-client-profile");
    });
  }

  await t.finish();
}

/* ============================== summary data ============================== */
const out = { created, settingsLog, shared: { client: shared.client?.id, orSelect: shared.orSelect, commissions: [shared.commissionSelect, shared.commissionBrRenewal, shared.commissionBrNew, shared.commissionFlexi].filter(Boolean).map((c) => c.id) } };
writeFileSync(join(ROOT, "reports", "09-commissions-data.json"), JSON.stringify(out, null, 2));
console.log("\nCreated records:");
for (const c of created) console.log(`  ${c.table}\t${c.id}\t${c.ref ?? ""}`);
console.log("Settings log:");
for (const s of settingsLog) console.log(`  ${s}`);
