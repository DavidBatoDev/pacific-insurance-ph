/**
 * Fix verification — K5 commissions (M8 pending-rate notice, L20 verify toast, L21 agent persona).
 *   node --env-file=.env.local qa-oct2/fix-commissions.mjs
 * Seeds a QA client + FlexiShield policy + Awaiting payment, verifies it via the UI (no voucher filed).
 */
import { startFeature, settle, db, loadProducts, createTestClient, SAMPLE_PDF, QA_PREFIX } from "./lib.mjs";

const today = new Date().toISOString().slice(0, 10);
const plusYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
const created = [];
const record = (table, row) => created.push({ table, id: row.id, ref: row.reference_no ?? row.policy_number ?? null });

const t = await startFeature("fix-commissions");
const page = t.page;
t.context.setDefaultTimeout(60_000);
page.setDefaultNavigationTimeout(120_000);

try {
  const products = await loadProducts();
  const { data: versions } = await db.from("product_versions").select("id,product_id").eq("status", "Active");
  const flexVersion = versions.find((v) => v.product_id === products.flexiShield.id)?.id;
  const { data: rates } = await db.from("commission_rates").select("id,rate_pct,business_type").eq("product_id", products.flexiShield.id);
  const hasRate = (rates ?? []).some((r) => r.rate_pct != null);
  t.note(`FlexiShield rate rows: ${JSON.stringify(rates ?? [])} → pending=${!hasRate}`);

  const client = await createTestClient(`FixComm ${Date.now().toString().slice(-5)}`, { lifecycle_stage: "Policyholder" });
  record("clients", client);
  const { data: policy, error: pErr } = await db.from("policies").insert({
    client_id: client.id, product_version_id: flexVersion, policy_number: `QA-OCT2-FIXC-${Date.now().toString().slice(-6)}`,
    status: "Active", effective_date: today, expiry_date: plusYear, currency: "PHP", premium_amount: 30000, payment_mode: "Annual",
  }).select("*").single();
  if (pErr) throw new Error(pErr.message);
  record("policies", policy);
  const { data: existingPay } = await db.from("payments").select("*").eq("policy_id", policy.id);
  let payment = existingPay?.[0] ?? null;
  if (!payment) {
    const { data, error } = await db.from("payments").insert({ client_id: client.id, policy_id: policy.id, amount: 30000, currency: "PHP", status: "Awaiting" }).select("*").single();
    if (error) throw new Error(error.message);
    payment = data;
  }
  record("payments", payment);
  const orNumber = `QA-OR-FIX-${Date.now().toString().slice(-5)}`;

  // ---- L20: verify through the UI and time the toast ----
  await page.goto("/payments", { waitUntil: "domcontentloaded" });
  await settle(page, 2500);
  await page.getByPlaceholder("Search payments…").fill(payment.reference_no);
  await page.waitForTimeout(800);
  const row = page.getByRole("row").filter({ hasText: payment.reference_no });
  await row.getByRole("button", { name: "Verify Payment" }).click();
  await page.getByLabel("Proof of payment").setInputFiles(SAMPLE_PDF);
  await page.getByLabel("Payment status").selectOption("Verified");
  await page.getByPlaceholder("OR-2026-XXXXX").fill(orNumber);
  const clickAt = Date.now();
  await page.getByRole("button", { name: "Verify & record invoice" }).click();
  let toastAt = null, drawerClosedAt = null, rowAt = null;
  const toast = page.getByText("Payment verified · invoice recorded");
  const drawerBtn = page.getByRole("button", { name: /Verify & record invoice|Saving…/ });
  while (Date.now() - clickAt < 120_000) {
    if (toastAt == null && (await toast.count())) { toastAt = Date.now() - clickAt; await t.shot("L20-toast"); }
    if (drawerClosedAt == null && !(await drawerBtn.count())) drawerClosedAt = Date.now() - clickAt;
    if (rowAt == null) {
      const { data } = await db.from("commissions").select("id").eq("payment_id", payment.id).maybeSingle();
      if (data) rowAt = Date.now() - clickAt;
    }
    if (toastAt != null && drawerClosedAt != null && rowAt != null) break;
    await page.waitForTimeout(250);
  }
  t.note(`L20 timings (ms after click): commission row=${rowAt} drawer closed=${drawerClosedAt} toast=${toastAt}`);
  if (toastAt != null) t.pass(`L20 toast observed ${toastAt}ms after click`); else t.fail("L20 toast never observed within 120s");
  const { data: commission } = await db.from("commissions").select("*").eq("payment_id", payment.id).maybeSingle();
  if (commission) record("commissions", commission);
  const { data: docs } = await db.from("documents").select("id,reference_no").eq("client_id", client.id);
  for (const d of docs ?? []) record("documents", d);
  const { data: tasks } = await db.from("tasks").select("id,title").eq("client_id", client.id);
  for (const task of tasks ?? []) record("tasks", task);
  t.note(`commission: estimated=${commission?.estimated_amount} rate_pct=${commission?.rate_pct} rate_id=${commission?.commission_rate_id}`);

  // ---- M8: pending-rate notice on /commissions ----
  await page.goto("/commissions", { waitUntil: "domcontentloaded" });
  await settle(page, 2500);
  await page.getByPlaceholder("Search commissions…").fill(orNumber);
  await page.waitForTimeout(800);
  const crow = page.getByRole("row").filter({ hasText: orNumber });
  const rtxt = ((await crow.textContent()) ?? "").replace(/\s+/g, " ");
  const link = crow.getByRole("link", { name: "Settings → Commission Rates" });
  if (rtxt.includes("Commission rate pending for FlexiShield")) t.pass("M8 row shows 'Commission rate pending for FlexiShield — set it in Settings → Commission Rates.'");
  else t.fail(`M8 row text: ${rtxt}`);
  if ((await link.count()) === 1 && (await link.getAttribute("href")) === "/settings?tab=Commission%20Rates") t.pass("M8 Settings link → /settings?tab=Commission Rates");
  else t.fail(`M8 link count=${await link.count()} href=${await link.first().getAttribute("href").catch(() => null)}`);
  await t.shot("M8-pending-rate-admin");
  const actionNames = ["File voucher", "Replace voucher", "Request Voucher", "Log Follow-up", "Mark Paid"];
  const adminBtns = [];
  for (const n of actionNames) if (await crow.getByRole("button", { name: n }).count()) adminBtns.push(n);
  t.note(`admin buttons on row: ${adminBtns.join(", ")}`);
  if (adminBtns.includes("File voucher") && adminBtns.includes("Mark Paid")) t.pass("Admin still sees File voucher / Mark Paid"); else t.fail("Admin lost action buttons");

  // Settings link lands on the Commission Rates tab
  await link.click();
  await page.waitForURL(/\/settings\?tab=Commission/);
  await settle(page, 2500);
  const tabBtn = page.getByRole("button", { name: "Commission Rates" });
  const cls = (await tabBtn.getAttribute("class")) ?? "";
  if (cls.includes("bg-brand-soft")) t.pass("M8 Settings opens on the Commission Rates tab"); else t.fail(`M8 Commission Rates tab not active: ${cls}`);
  await t.shot("M8-settings-commission-rates");

  // ---- L21: View as Agent ----
  await page.goto("/commissions", { waitUntil: "domcontentloaded" });
  await settle(page, 2500);
  const { data: me } = await db.from("users").select("full_name").eq("email", "playwright-staff@prodigitality.net").single();
  const first = (me?.full_name ?? "").split(" ")[0];
  await page.getByRole("button", { name: new RegExp(`${first}$`) }).first().click();
  await page.getByRole("button", { name: /^Agent( ·|$)/ }).click();
  await settle(page, 1500);
  await page.getByPlaceholder("Search commissions…").fill(orNumber);
  await page.waitForTimeout(800);
  const arow = page.getByRole("row").filter({ hasText: orNumber });
  const atxt = ((await arow.textContent()) ?? "").replace(/\s+/g, " ");
  const agentBtns = [];
  for (const n of actionNames) if (await arow.getByRole("button", { name: n }).count()) agentBtns.push(n);
  if (agentBtns.length === 0) t.pass("L21 Agent persona: no File/Replace/Request/Follow-up/Mark Paid buttons"); else t.fail(`L21 agent still sees: ${agentBtns.join(", ")}`);
  if (atxt.includes("•••••")) t.pass("L21 Agent persona: amount masked"); else t.fail(`L21 amount not masked: ${atxt}`);
  if ((await arow.locator("select").count()) === 0) t.pass("L21 Agent persona: contact select hidden"); else t.fail("L21 contact select still shown");
  if (atxt.includes("Restricted") || atxt.includes("Original not filed")) t.note(`L21 voucher column: ${atxt.includes("Restricted") ? "Restricted" : "Original not filed"}`);
  await t.shot("L21-agent-persona");
  // Restore admin persona
  await page.getByRole("button", { name: new RegExp(`${first}$`) }).first().click();
  await page.getByRole("button", { name: /^Admin( ·|$)/ }).click();
  await settle(page, 1000);
} catch (err) {
  t.fail(`script error: ${err.message.split("\n")[0]}`);
  await t.shot("fail").catch(() => {});
} finally {
  console.log("\nCreated records:");
  for (const c of created) console.log(`  ${c.table} ${c.id} ${c.ref ?? ""}`);
  await t.finish();
}
