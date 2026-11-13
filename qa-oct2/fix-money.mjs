/**
 * Fix verification for K1 money formatting (M1, M2, M3, L15 policies, L17, L18, L19).
 *   node --env-file=.env.local qa-oct2/fix-money.mjs [run-tag]
 * Seeds one QA client with a USD Blue Royale policy (→ USD renewal payment) and one with a
 * PHP Semi-Annual policy (→ two ₱ installments), then screenshots every affected surface.
 */
import { startFeature, settle, db, createTestClient, QA_PREFIX } from "./lib.mjs";

const BLUE_ROYALE_VERSION = "427d8fa0-2ce1-4a20-90bc-b477b6a13e0c";
const BLUE_ROYALE_PRODUCT = "80e401c9-9ddc-40bf-961a-aed182a1dd69";
const RUN = process.argv[2] ?? Date.now().toString(36).slice(-4);
const label = (base) => `${base} ${RUN}`;
const NAV = { timeout: 90000 };
const created = [];

async function insert(table, row) {
  const { data, error } = await db.from(table).insert(row).select("*").single();
  if (error) throw new Error(`${table} insert: ${error.message}`);
  created.push({ table, id: data.id, ref: data.reference_no ?? data.policy_number ?? "" });
  return data;
}
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

const t = await startFeature("fix-money");
const { page } = t;
t.context.setDefaultTimeout(45000);

// Re-running with the same tag reuses the earlier seed instead of piling up QA rows.
const existing = async (last) => (await db.from("clients").select("*").eq("first_name", QA_PREFIX).eq("last_name", last).maybeSingle()).data;
const reuse = !!(await existing(label("FixMoney USD")));
const usdClient = (await existing(label("FixMoney USD"))) ?? (await createTestClient(label("FixMoney USD"), { lifecycle_stage: "Client", product_interest: "Blue Royale" }));
const semiClient = (await existing(label("FixMoney Semi"))) ?? (await createTestClient(label("FixMoney Semi"), { lifecycle_stage: "Client", product_interest: "Blue Royale" }));
created.push({ table: "clients", id: usdClient.id }, { table: "clients", id: semiClient.id });
const usdName = `${QA_PREFIX} ${label("FixMoney USD")}`;
const semiName = `${QA_PREFIX} ${label("FixMoney Semi")}`;

await step(t, "seed", async () => {
  if (!reuse) {
    await insert("policies", {
      client_id: usdClient.id, product_id: BLUE_ROYALE_PRODUCT, product_version_id: BLUE_ROYALE_VERSION,
      policy_number: `QA-FIX-USD-${RUN}`, status: "Active", effective_date: "2026-05-01", expiry_date: "2027-04-30",
      renewal_date: "2027-04-30", currency: "USD", premium_amount: 1200, payment_mode: "Annual", notes: "QA OCT2 fix-money USD policy",
    });
    await insert("policies", {
      client_id: semiClient.id, product_id: BLUE_ROYALE_PRODUCT, product_version_id: BLUE_ROYALE_VERSION,
      policy_number: `QA-FIX-SEMI-${RUN}`, status: "Active", effective_date: "2026-06-01", expiry_date: "2027-05-31",
      renewal_date: "2027-05-31", currency: "PHP", premium_amount: 21225.6, payment_mode: "Semi-Annual", notes: "QA OCT2 fix-money semi policy",
    });
    await new Promise((r) => setTimeout(r, 1200));
  } else {
    const { data: pols } = await db.from("policies").select("id, reference_no").in("client_id", [usdClient.id, semiClient.id]);
    for (const p of pols ?? []) created.push({ table: "policies", id: p.id, ref: p.reference_no });
  }
  for (const c of [usdClient, semiClient]) {
    const { data: ren } = await db.from("renewals").select("id, reference_no").eq("client_id", c.id);
    for (const r of ren ?? []) created.push({ table: "renewals", id: r.id, ref: r.reference_no });
    const { data: pays } = await db.from("payments").select("id, reference_no, amount, currency, installment_number, installment_count").eq("client_id", c.id);
    for (const p of pays ?? []) created.push({ table: "payments", id: p.id, ref: p.reference_no });
    t.note(`${c.first_name} ${c.last_name}: payments ${JSON.stringify(pays)}`);
  }
});

await step(t, "L18 /payments full width", async () => {
  await gotoPayments(page);
  const m = await page.evaluate(() => {
    const table = document.querySelector("table");
    const wrap = table.parentElement;
    const last = table.querySelector("tbody tr td:last-child");
    const btn = last?.querySelector("button");
    return {
      wrapClient: wrap.clientWidth, tableScroll: wrap.scrollWidth,
      lastRight: last?.getBoundingClientRect().right, wrapRight: wrap.getBoundingClientRect().right,
      btnRight: btn?.getBoundingClientRect().right,
      cols: [...table.querySelectorAll("thead th")].map((th) => Math.round(th.getBoundingClientRect().width)),
    };
  });
  t.note(`payments table metrics: ${JSON.stringify(m)}`);
  await t.shot("l18-payments-full-width");
  if (m.tableScroll <= m.wrapClient + 1 && (m.btnRight ?? 0) <= m.wrapRight + 1) t.pass("L18: /payments table fits the card at 1440×900, last column not clipped");
  else t.fail(`L18: table still overflows (${JSON.stringify(m)})`);
});

await step(t, "M1 + L17 verify drawer (USD)", async () => {
  await gotoPayments(page, label("FixMoney USD"));
  const row = page.locator("tbody tr", { hasText: usdName }).first();
  await row.getByRole("button", { name: "Verify Payment" }).click();
  await page.locator("h2", { hasText: "Verify payment" }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
  const amount = await summaryValue(page, "Amount");
  const fieldLabel = await page.locator("label", { hasText: /Premium amount \(/ }).first().textContent();
  await t.shot("m1-verify-drawer-usd");
  if (amount === "US$1,200" && /Premium amount \(US\$\)/.test(fieldLabel ?? "")) t.pass(`M1: verify drawer shows ${amount}, label "${fieldLabel?.trim()}"`);
  else t.fail(`M1: amount "${amount}", label "${fieldLabel?.trim()}"`);
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(300);

  await gotoPayments(page, label("FixMoney Semi"));
  const semiRow = page.locator("tbody tr", { hasText: semiName }).filter({ hasText: "installment 1/2" }).first();
  const semiAmt = await semiRow.locator("td").nth(3).textContent();
  await semiRow.getByRole("button", { name: "Verify Payment" }).click();
  await page.locator("h2", { hasText: "Verify payment" }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
  const inst = await summaryValue(page, "Installment");
  const phpAmt = await summaryValue(page, "Amount");
  await t.shot("l17-verify-drawer-installment");
  if (/Renewal installment 1\/2/.test(inst ?? "")) t.pass(`L17: verify drawer shows "${inst}"`);
  else t.fail(`L17: installment line "${inst}"`);
  if (phpAmt === "₱10,612.80" && semiAmt?.trim() === "₱10,612.80") t.pass(`L19: cents keep trailing zero (${phpAmt}; row ${semiAmt?.trim()})`);
  else t.fail(`L19: drawer "${phpAmt}", row "${semiAmt?.trim()}"`);
  await page.getByRole("button", { name: "Cancel" }).click();
});

await step(t, "M2 dashboard + M3 payment links", async () => {
  await page.goto("/dashboard", NAV);
  await settle(page);
  const big = page.locator("div.text-\\[33px\\]").first();
  const widget = big.locator("xpath=..");
  const text = (await widget.textContent())?.replace(/\s+/g, " ").trim();
  t.note(`Revenue widget: ${text}`);
  await t.shot("m2-dashboard-revenue");
  if (/US\$/.test(text ?? "") && /₱/.test(text ?? "")) t.pass("M2: dashboard revenue shows ₱ and US$ separately");
  else t.fail(`M2: widget text "${text}"`);

  await page.getByRole("button", { name: "Log payment links" }).click();
  await page.locator("h2", { hasText: "Log payment links" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  const item = page.locator("button", { hasText: usdName }).first();
  const itemText = (await item.textContent().catch(() => ""))?.replace(/\s+/g, " ").trim();
  const selectedLine = (await page.getByText(/recipients ·/).first().textContent())?.replace(/\s+/g, " ").trim();
  const semiItem = page.locator("button", { hasText: semiName }).first();
  const semiText = (await semiItem.textContent().catch(() => ""))?.replace(/\s+/g, " ").trim();
  await item.scrollIntoViewIfNeeded().catch(() => {});
  await t.shot("m3-payment-links-usd");
  if (/US\$1,200/.test(itemText)) t.pass(`M3: payment-links row "${itemText}"`);
  else t.fail(`M3: row "${itemText}"`);
  if (/US\$/.test(selectedLine ?? "") && /₱/.test(selectedLine ?? "")) t.pass(`M3: selected totals split: "${selectedLine}"`);
  else t.fail(`M3: selected line "${selectedLine}"`);
  if (/installment [12]\/2/.test(semiText)) t.pass(`L17: payment-links row shows installment: "${semiText}"`);
  else t.fail(`L17: payment-links row "${semiText}"`);
  await page.getByRole("button", { name: "Cancel" }).last().click().catch(() => page.keyboard.press("Escape"));
});

await step(t, "L15 /policies USD", async () => {
  await page.goto("/policies", NAV);
  await settle(page);
  const stat = (await page.locator("div", { hasText: /^Premium under management$/ }).last().locator("xpath=..").textContent())?.replace(/\s+/g, " ").trim();
  t.note(`Premium under management stat: ${stat}`);
  await page.locator("input[placeholder^='Search']").first().fill(label("FixMoney USD"));
  await page.waitForTimeout(500);
  const row = page.locator("tbody tr", { hasText: usdName }).first();
  const text = (await row.textContent())?.replace(/\s+/g, " ").trim();
  await t.shot("l15-policies-usd");
  if (/US\$1,200/.test(text)) t.pass(`L15: /policies row "${text.slice(0, 120)}"`);
  else t.fail(`L15: row "${text}"`);
  if (/US\$/.test(stat ?? "") && /₱/.test(stat ?? "")) t.pass(`L15: stat split per currency: "${stat}"`);
  else t.fail(`L15: stat "${stat}"`);
});

console.log("\nQA rows created:");
for (const c of created) console.log(`  ${c.table} ${c.id} ${c.ref ?? ""}`);
const fails = await t.finish();
process.exit(fails ? 1 : 0);
