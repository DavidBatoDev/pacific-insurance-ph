/**
 * TESTING-OCT2.md §5 Renewals — 5.1 generated from policies, 5.2 notice received date,
 * 5.3 configurable email schedule. Run: node --env-file=.env.local qa-oct2/05-renewals.mjs
 */
import { appendFileSync } from "node:fs";
import { join } from "node:path";

import { startFeature, settle, db, loadProducts, createTestClient, QA_PREFIX, REPORT_ROOT } from "./lib.mjs";

const STAFF_USER_ID = "61d2e861-5b7e-4bc8-95e8-0695e9dab1c6"; // playwright-staff@prodigitality.net
const CLIENT_LABEL = "Renewals";
const CLIENT_NAME = `${QA_PREFIX} ${CLIENT_LABEL}`;
const POLICY_NO_1 = "PC-QA0501";
const POLICY_NO_2 = "PC-QA0502";

const created = []; // { table, id, ref }
const bugs = [];
const results = []; // { section, result, evidence }
const videos = [];

/* ---------- date helpers (Asia/Manila calendar dates, tz-safe string math) ---------- */
function manilaToday() {
  // "YYYY-MM-DD" for today's date in Manila regardless of the machine's zone.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function isoPlus(days, from = manilaToday()) {
  const [y, m, d] = from.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function isoPlusYear(from) {
  // Mirrors issue-policy.tsx addOneYear: a one-year term ends the day before the anniversary.
  const [y, m, d] = from.split("-").map(Number);
  return new Date(Date.UTC(y + 1, m - 1, d - 1)).toISOString().slice(0, 10);
}
/** Poll a DB read until the predicate holds (server actions on the shared dev server can take tens of seconds). */
async function waitDb(read, pred, { timeout = 90_000, every = 1500 } = {}) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    last = await read();
    if (pred(last)) return { value: last, ms: Date.now() - started };
    await new Promise((r) => setTimeout(r, every));
  }
  return { value: last, ms: Date.now() - started, timedOut: true };
}
/** Wait for toast/body text; returns true if seen within the timeout. */
async function waitText(page, text, timeout = 90_000) {
  try {
    await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}
function fmtLikeApp(iso) {
  // lib/format.ts fmtDate: new Date(iso).toLocaleDateString("en-PH", { year:"numeric", month:"short", day:"numeric" })
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}
function fmtVariants(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const out = new Set([fmtLikeApp(iso)]);
  for (const tz of ["Asia/Manila", "UTC", "America/Los_Angeles"]) {
    out.add(dt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: tz }));
    out.add(dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: tz }));
  }
  return [...out];
}

async function step(t, name, fn) {
  try {
    await fn();
  } catch (err) {
    const msg = err?.message?.split("\n")[0] ?? String(err);
    t.fail(`${name}: ${msg}`);
    const shot = await t.shot(`fail-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`).catch(() => "");
    bugs.push({ title: `${name} — step failed`, detail: msg, shot });
  }
}

function bug(t, title, detail, shot) {
  t.bug(`${title}: ${detail}`);
  bugs.push({ title, detail, shot });
}

/** Inline assertion failure (no throw): recorded as a step failure for the summary verdict. */
function fail(t, msg) {
  t.fail(msg);
  bugs.push({ title: `${msg.slice(0, 80)} — step failed`, detail: msg, shot: "" });
}

/** FAIL when a step threw (assertion/selector), BUG when only observed app issues, else PASS. */
function verdict(fails, bugsBefore) {
  if (!fails) return "PASS";
  const mine = bugs.slice(bugsBefore);
  return mine.some((b) => b.title.endsWith("step failed")) ? "FAIL" : "BUG";
}

/** Form inputs rendered by <Field> have no htmlFor; locate the control under the label text. */
function fieldControl(scope, label, control = "input") {
  return scope.locator(`div:has(> label:text-is("${label}")) > ${control}, div:has(> label:text-is("${label} *")) > ${control}`).first();
}
function fieldControlLoose(scope, label, control = "input") {
  return scope.locator(`div:has(> label:has-text("${label}")) > ${control}`).first();
}

/** Dev server compiles routes lazily and siblings share it; give navigation plenty of room. */
function relax(t) {
  t.context.setDefaultTimeout(30_000);
  t.page.setDefaultNavigationTimeout(120_000);
}

/** Persona switcher: profile button (Avatar + first name + chevron) → "View as" option. */
async function viewAs(page, label) {
  const profile = page.locator("button:has(svg)").filter({ hasText: /^Admin$/ }).last();
  if (await profile.count()) {
    await profile.click();
  } else {
    // fallback: any header button containing the user's first name
    await page.getByRole("button", { name: /Admin/ }).first().click();
  }
  await page.waitForTimeout(400);
  const opt = page.getByRole("button", { name: label, exact: true });
  if (!(await opt.count())) throw new Error(`View as option "${label}" not visible`);
  await opt.click();
  await page.waitForTimeout(800);
}
async function resetPersona(page) {
  await page.evaluate(() => localStorage.setItem("pi_persona", "admin"));
  await page.reload();
  await settle(page);
}

async function openRenewalsRows(page) {
  await page.goto("/renewals");
  await settle(page, 2500);
  const search = page.getByPlaceholder("Search renewals…");
  await search.fill(QA_PREFIX);
  await page.waitForTimeout(600);
}

/* ======================================================================= */
/* Seed                                                                    */
/* ======================================================================= */
const products = await loadProducts();
const product = products.blueRoyale ?? products.flexiShield ?? products.all[0];
const CLIENT_EMAIL = `qa-oct2-${CLIENT_LABEL.toLowerCase()}@example.invalid`;
const existing = await db.from("clients").select("*").eq("email", CLIENT_EMAIL).eq("first_name", QA_PREFIX).maybeSingle();
const client = existing.data ?? await createTestClient(CLIENT_LABEL, {
  lifecycle_stage: "Client",
  assigned_user_id: STAFF_USER_ID,
  gender: "Male",
  date_of_birth: "1988-05-05",
});
if (existing.data) {
  // Re-run safety: drop leftovers from a previous attempt so counts stay exact.
  const del = async (table, col, val) => {
    const { error } = await db.from(table).delete().eq(col, val);
    if (error) console.log(`cleanup ${table}.${col}=${val}: ${error.message}`);
  };
  const { data: oldPols } = await db.from("policies").select("id").eq("client_id", client.id);
  const { data: oldRens } = await db.from("renewals").select("id").eq("client_id", client.id);
  for (const r of oldRens ?? []) {
    const { data: drafts } = await db.from("renewal_email_drafts").select("id,task_id").eq("renewal_id", r.id);
    for (const d of drafts ?? []) { await del("renewal_email_drafts", "id", d.id); await del("tasks", "id", d.task_id); }
    await del("communications", "renewal_id", r.id);
    await del("payments", "renewal_id", r.id);
  }
  await del("tasks", "client_id", client.id);
  await del("communications", "client_id", client.id);
  await del("payments", "client_id", client.id);
  await del("renewals", "client_id", client.id);
  for (const p of oldPols ?? []) {
    await del("payments", "policy_id", p.id);
    await del("documents", "policy_id", p.id);
    await del("policies", "id", p.id);
  }
  const { count } = await db.from("policies").select("id", { count: "exact", head: true }).eq("client_id", client.id);
  if (count) throw new Error(`rerun cleanup left ${count} policies on the QA client`);
  console.log(`Reusing QA client ${client.id}; removed ${oldPols?.length ?? 0} leftover policies / ${oldRens?.length ?? 0} renewals`);
}
created.push({ table: "clients", id: client.id, ref: `${client.first_name} ${client.last_name}` });
console.log(`QA client ${client.id}`);

const today = manilaToday();
const effectiveDate = isoPlus(-275, today); // auto-expiry (+1y) lands ~90 days out
const expectedExpiry = isoPlusYear(effectiveDate);
const editedRenewalDate = isoPlus(100, today);
const receiptDate = isoPlus(-2, today);
const receiptDate2 = isoPlus(-1, today);

let policy1 = null;
let renewal1 = null;
let policy2 = null;
let renewal2 = null;

/* ======================================================================= */
/* 5.1 Renewals generated from policies                                    */
/* ======================================================================= */
{
  const t = await startFeature("5.1-renewals-from-policies");
  relax(t);
  const { page } = t;
  const bugsBefore = bugs.length;

  await step(t, "Open /policies and Log policy copy", async () => {
    await page.goto("/policies");
    await settle(page, 2500);
    await page.getByRole("button", { name: "Log policy copy" }).first().click();
    await page.waitForTimeout(800);
    const drawerTitle = page.getByRole("heading", { name: "Log policy copy" });
    if (!(await drawerTitle.count())) throw new Error("Log policy copy drawer did not open");
    t.pass("Log policy copy drawer opened from /policies");
  });

  await step(t, "Fill policy form", async () => {
    const search = page.getByPlaceholder("Search a client…");
    await search.fill(CLIENT_NAME);
    await page.waitForTimeout(1500);
    let result = page.locator("button", { hasText: CLIENT_NAME }).first();
    if (!(await result.count())) {
      bug(t, "Client picker does not match a full name",
        `Typing the full name "${CLIENT_NAME}" into Log policy copy → Client search returns no results (search ORs first_name/last_name/email ILIKE separately — lib/repositories/clients/clients.repository.supabase.ts:204). Searching by the email prefix works. Low severity papercut.`,
        "qa-oct2/videos/5.1-renewals-from-policies/5.1-client-search-fullname.png");
      await t.shot("5.1-client-search-fullname");
      await search.fill(CLIENT_EMAIL);
      result = page.locator("button", { hasText: CLIENT_NAME }).first();
    }
    await result.waitFor({ timeout: 20000 });
    await result.click();
    await page.waitForTimeout(400);
    await fieldControl(page, "Product", "select").selectOption({ label: product.name });
    await page.waitForTimeout(400);
    await page.getByPlaceholder("PC-000000").fill(POLICY_NO_1);
    await page.getByPlaceholder("0", { exact: true }).first().fill("12000");
    const eff = fieldControl(page, "Effective date");
    await eff.fill(effectiveDate);
    await page.waitForTimeout(300);
    const exp = await fieldControl(page, "Expiry date").inputValue();
    if (exp === expectedExpiry) t.pass(`Expiry auto-filled to ${exp} (effective + 1 year)`);
    else {
      fail(t, `Expiry auto-fill gave "${exp}" (expected effective + 1 year − 1 day = ${expectedExpiry}); setting explicitly`);
      await fieldControl(page, "Expiry date").fill(expectedExpiry);
    }
    await t.shot("5.1-form-filled");
    const submit = page.getByRole("button", { name: "Log policy copy" }).last();
    if (await submit.isDisabled()) throw new Error("Submit button still disabled after filling required fields");
    const t0 = Date.now();
    await submit.click();
    const toastSeen = await waitText(page, "Policy copy logged");
    if (toastSeen) t.pass(`Toast: Policy copy logged (after ${Date.now() - t0} ms)`);
    else t.note("Did not observe 'Policy copy logged' toast within 90 s");
    await settle(page);
    await t.shot("5.1-after-log");
  });

  await step(t, "DB: policy + exactly one renewal", async () => {
    const polWait = await waitDb(() => db.from("policies").select("*").eq("client_id", client.id).then((r) => r.data ?? []), (rows) => rows.length >= 1);
    const pols = polWait.value;
    if (pols.length !== 1) throw new Error(`expected 1 policy for QA client, found ${pols.length}`);
    policy1 = pols[0];
    created.push({ table: "policies", id: policy1.id, ref: policy1.reference_no });
    if (policy1.status !== "Active") throw new Error(`policy status ${policy1.status}, expected Active`);
    if (policy1.expiry_date !== expectedExpiry) throw new Error(`policy expiry ${policy1.expiry_date} != ${expectedExpiry}`);
    t.pass(`Policy ${policy1.reference_no} Active, expiry ${policy1.expiry_date}, renewal_date ${policy1.renewal_date}`);
    const { data: rens } = await db.from("renewals").select("*").eq("policy_id", policy1.id);
    if (rens.length !== 1) throw new Error(`expected exactly 1 renewal, found ${rens.length}`);
    renewal1 = rens[0];
    created.push({ table: "renewals", id: renewal1.id, ref: renewal1.reference_no });
    const expectedDue = policy1.renewal_date ?? policy1.expiry_date;
    if (renewal1.renewal_due_date === expectedDue && renewal1.status === "Upcoming") {
      t.pass(`Renewal ${renewal1.reference_no} auto-created: due ${renewal1.renewal_due_date} (from policy ${policy1.renewal_date ? "renewal" : "expiry"} date), status Upcoming`);
    } else throw new Error(`renewal due=${renewal1.renewal_due_date} status=${renewal1.status}, expected due ${expectedDue} / Upcoming`);
    const { data: pays } = await db.from("payments").select("id,reference_no,renewal_id").eq("client_id", client.id);
    for (const p of pays ?? []) created.push({ table: "payments", id: p.id, ref: p.reference_no });
  });

  await step(t, "Renewals page shows the new renewal", async () => {
    await openRenewalsRows(page);
    const row = page.getByRole("row").filter({ hasText: CLIENT_NAME });
    if (!(await row.count())) throw new Error("QA renewal row not listed on /renewals");
    const txt = await row.first().innerText();
    const variants = fmtVariants(renewal1.renewal_due_date);
    if (variants.some((v) => txt.includes(v))) t.pass(`/renewals lists ${CLIENT_NAME} with renewal date ${renewal1.renewal_due_date}`);
    else throw new Error(`row text lacks renewal date (${variants.join(" | ")}): ${txt.replace(/\n/g, " | ")}`);
    await t.shot("5.1-renewals-list");
  });

  await step(t, "Edit policy renewal date from client profile", async () => {
    await page.goto(`/clients/${client.id}`);
    await settle(page, 3000);
    const edit = page.getByRole("button", { name: `Edit policy ${POLICY_NO_1}` });
    if (!(await edit.count())) throw new Error("Policies card Edit button not found on client profile");
    await edit.click();
    await page.waitForTimeout(800);
    const renewalInput = fieldControl(page, "Renewal date");
    await renewalInput.fill(editedRenewalDate);
    await t.shot("5.1-edit-policy");
    const t0 = Date.now();
    await page.getByRole("button", { name: "Save changes" }).click();
    const toastSeen = await waitText(page, "Policy updated");
    if (toastSeen) t.pass(`Toast: Policy updated (after ${Date.now() - t0} ms)`);
    else t.note("Did not observe 'Policy updated' toast within 90 s");
    await settle(page);
    const polWait = await waitDb(() => db.from("policies").select("*").eq("id", policy1.id).single().then((r) => r.data), (p) => p?.renewal_date === editedRenewalDate);
    const pol = polWait.value;
    if (pol.renewal_date !== editedRenewalDate) throw new Error(`policy renewal_date ${pol.renewal_date}, expected ${editedRenewalDate} (waited ${polWait.ms} ms)`);
    t.pass(`Policy renewal_date updated to ${pol.renewal_date}`);
    const { data: rens } = await db.from("renewals").select("*").eq("policy_id", policy1.id);
    if (rens.length !== 1) throw new Error(`after edit expected still 1 renewal, found ${rens.length}`);
    if (rens[0].id !== renewal1.id) throw new Error("renewal row id changed (new row instead of update)");
    if (rens[0].renewal_due_date !== editedRenewalDate) throw new Error(`renewal_due_date ${rens[0].renewal_due_date} not updated to ${editedRenewalDate}`);
    t.pass(`Same renewal row ${renewal1.reference_no} refreshed to due ${rens[0].renewal_due_date} (no second row)`);
    renewal1 = rens[0];
  });

  await step(t, "Sync policies twice (admin)", async () => {
    const before = await db.from("renewals").select("id", { count: "exact", head: true });
    await page.goto("/renewals");
    await settle(page, 2500);
    const sync = page.getByRole("button", { name: "Sync policies" });
    if (!(await sync.count())) throw new Error("Sync policies button not visible for admin");
    t.pass("Sync policies button visible for admin");
    for (let i = 1; i <= 2; i++) {
      await sync.click();
      await page.waitForTimeout(3000);
      await settle(page);
      const body = await page.locator("body").innerText();
      const m = body.match(/(\d+) created · (\d+) refreshed · (\d+) unchanged · (\d+) skipped/);
      if (m) t.pass(`Sync run ${i} toast: ${m[0]}`);
      else t.note(`Sync run ${i}: toast counts not captured`);
      await t.shot(`5.1-sync-${i}`);
    }
    const after = await db.from("renewals").select("id", { count: "exact", head: true });
    t.note(`renewals count before sync ${before.count} → after two syncs ${after.count}`);
    const { data: open } = await db.from("renewals").select("policy_id,status").not("status", "in", "(Paid,Renewed,Lapsed)");
    const perPolicy = {};
    for (const r of open) perPolicy[r.policy_id] = (perPolicy[r.policy_id] ?? 0) + 1;
    const dupes = Object.entries(perPolicy).filter(([, n]) => n > 1);
    if (dupes.length) throw new Error(`duplicate open renewals per policy: ${JSON.stringify(dupes)}`);
    t.pass(`No duplicate open renewals after two syncs (${Object.keys(perPolicy).length} policies, 1 open cycle each)`);
    const { data: mine } = await db.from("renewals").select("id").eq("policy_id", policy1.id);
    if (mine.length !== 1) throw new Error(`QA policy has ${mine.length} renewals after sync`);
    t.pass("QA policy still has exactly 1 renewal after sync ×2");
  });

  await step(t, "View as Staff hides Sync policies", async () => {
    await viewAs(page, "Staff · Broker");
    await settle(page);
    await t.shot("5.1-view-as-staff");
    const sync = page.getByRole("button", { name: "Sync policies" });
    if (await sync.count()) {
      bug(t, "Sync policies still visible under View as Staff",
        "Checklist 5.1: 'Staff don't see the button'. With the persona switcher set to Staff · Broker the Sync policies button is still rendered on /renewals (RenewalsLive gates on the server role only — components/hub/screens/operations.tsx:308 / app/(app)/renewals/page.tsx). Server action still rejects non-admins, so this is a preview-only inconsistency.",
        "qa-oct2/videos/5.1-renewals-from-policies/5.1-view-as-staff.png");
    } else t.pass("Sync policies hidden under View as Staff");
    await resetPersona(page);
    if (await page.getByRole("button", { name: "Sync policies" }).count()) t.pass("Persona reset to Admin; Sync policies visible again");
  });

  const fails = await t.finish();
  videos.push("qa-oct2/videos/5.1-renewals-from-policies/5.1-renewals-from-policies.webm");
  results.push({ section: "5.1 Renewals generated from policies", result: verdict(fails, bugsBefore), evidence: "1 renewal per policy from expiry; edit refreshed same row; sync ×2 no dupes; Sync button visible under View-as Staff (bug)" });
}

/* ======================================================================= */
/* 5.2 Notice received date                                                */
/* ======================================================================= */
{
  const t = await startFeature("5.2-notice-received");
  relax(t);
  const { page } = t;
  const bugsBefore2 = bugs.length;

  await step(t, "Mark notice received on Upcoming renewal", async () => {
    if (!renewal1) throw new Error("no renewal from 5.1");
    await openRenewalsRows(page);
    const row = page.getByRole("row").filter({ hasText: POLICY_NO_1 }).first();
    if (!(await row.count())) throw new Error("QA renewal row not found");
    const btn = row.getByRole("button", { name: "Mark notice received" });
    if (!(await btn.count())) throw new Error("Mark notice received button missing on Upcoming row");
    await btn.click();
    await page.waitForTimeout(600);
    const title = page.getByRole("heading", { name: "Mark notice received" });
    if (!(await title.count())) throw new Error("receipt modal did not open");
    const input = page.getByLabel("Notice received date");
    const def = await input.inputValue();
    t.note(`Modal default date: ${def}`);
    await input.fill(receiptDate);
    await t.shot("5.2-modal");
    const t0 = Date.now();
    await page.getByRole("button", { name: "Save receipt date" }).click();
    const toastSeen = await waitText(page, "Notice receipt recorded");
    if (toastSeen) t.pass(`Toast: Notice receipt recorded (after ${Date.now() - t0} ms)`);
    else t.note("Did not observe 'Notice receipt recorded' toast within 90 s");
    const w = await waitDb(() => db.from("renewals").select("*").eq("id", renewal1.id).single().then((r) => r.data), (r) => r?.notice_received_date === receiptDate);
    if (w.timedOut) throw new Error(`DB notice_received_date not set after ${w.ms} ms`);
    await settle(page);
  });

  await step(t, "Row shows date, status Notice Received, Edit receipt date", async () => {
    await openRenewalsRows(page);
    const row = page.getByRole("row").filter({ hasText: POLICY_NO_1 }).first();
    const txt = (await row.innerText()).replace(/\n/g, " | ");
    await t.shot("5.2-after-receipt");
    const variants = fmtVariants(receiptDate);
    if (variants.some((v) => txt.includes(v))) t.pass(`Notice received column shows ${receiptDate}`);
    else throw new Error(`Notice received date not in row: ${txt}`);
    if (txt.includes("Notice Received")) t.pass("Status badge: Notice Received");
    else throw new Error(`status not Notice Received: ${txt}`);
    if (await row.getByRole("button", { name: "Edit receipt date" }).count()) t.pass("Button now reads Edit receipt date");
    else throw new Error("Edit receipt date button not shown");
    const { data: r } = await db.from("renewals").select("*").eq("id", renewal1.id).single();
    if (r.notice_received_date === receiptDate && r.status === "Notice Received") t.pass(`DB: notice_received_date=${r.notice_received_date}, status=${r.status}`);
    else throw new Error(`DB renewal notice_received_date=${r.notice_received_date} status=${r.status}`);
    renewal1 = r;
  });

  await step(t, "Notice received column sorts", async () => {
    await page.goto("/renewals");
    await settle(page, 2000);
    const th = page.getByRole("columnheader", { name: "Notice received" });
    const btn = th.getByRole("button");
    await btn.click();
    await page.waitForTimeout(400);
    const s1 = await th.getAttribute("aria-sort");
    await btn.click();
    await page.waitForTimeout(400);
    const s2 = await th.getAttribute("aria-sort");
    if (["ascending", "descending"].includes(s1) && s1 !== s2) t.pass(`Notice received header sorts (aria-sort ${s1} → ${s2})`);
    else throw new Error(`aria-sort values ${s1} / ${s2}`);
    await t.shot("5.2-sorted");
  });

  await step(t, "Seed Awaiting Payment renewal and record receipt", async () => {
    const { data: pol, error } = await db.from("policies").insert({
      client_id: client.id,
      product_version_id: policy1.product_version_id,
      plan_option_id: policy1.plan_option_id,
      policy_number: POLICY_NO_2,
      status: "Active",
      effective_date: isoPlus(-245, today),
      expiry_date: isoPlus(120, today),
      premium_amount: 15000,
      payment_mode: "Annual",
      currency: "PHP",
    }).select("*").single();
    if (error) throw new Error(`seed policy: ${error.message}`);
    policy2 = pol;
    created.push({ table: "policies", id: pol.id, ref: pol.reference_no });
    const { data: rens } = await db.from("renewals").select("*").eq("policy_id", pol.id);
    if (rens.length !== 1) throw new Error(`seeded policy produced ${rens.length} renewals`);
    renewal2 = rens[0];
    created.push({ table: "renewals", id: renewal2.id, ref: renewal2.reference_no });
    const { data: pays } = await db.from("payments").select("id,reference_no").eq("renewal_id", renewal2.id);
    for (const p of pays ?? []) created.push({ table: "payments", id: p.id, ref: p.reference_no });
    const { error: upErr } = await db.from("renewals").update({ status: "Awaiting Payment" }).eq("id", renewal2.id);
    if (upErr) throw new Error(`set Awaiting Payment: ${upErr.message}`);
    t.note(`Seeded policy ${pol.reference_no} (${POLICY_NO_2}) → renewal ${renewal2.reference_no} set to Awaiting Payment`);

    await openRenewalsRows(page);
    const row = page.getByRole("row").filter({ hasText: POLICY_NO_2 }).first();
    if (!(await row.count())) throw new Error("Awaiting Payment QA row not listed");
    if (!(await row.innerText()).includes("Awaiting Payment")) throw new Error("row not showing Awaiting Payment");
    await row.getByRole("button", { name: "Mark notice received" }).click();
    await page.waitForTimeout(600);
    await page.getByLabel("Notice received date").fill(receiptDate2);
    const t0 = Date.now();
    await page.getByRole("button", { name: "Save receipt date" }).click();
    const toastSeen = await waitText(page, "Notice receipt recorded");
    if (toastSeen) t.pass(`Toast: Notice receipt recorded (after ${Date.now() - t0} ms)`);
    else t.note("Did not observe 'Notice receipt recorded' toast within 90 s");
    const w = await waitDb(() => db.from("renewals").select("*").eq("id", renewal2.id).single().then((r) => r.data), (r) => r?.notice_received_date === receiptDate2);
    if (w.timedOut) throw new Error(`DB notice_received_date not set after ${w.ms} ms`);
    await settle(page);
    await openRenewalsRows(page);
    const row2 = page.getByRole("row").filter({ hasText: POLICY_NO_2 }).first();
    const txt = (await row2.innerText()).replace(/\n/g, " | ");
    await t.shot("5.2-awaiting-payment-receipt");
    if (txt.includes("Awaiting Payment") && fmtVariants(receiptDate2).some((v) => txt.includes(v))) t.pass(`Awaiting Payment renewal keeps status; notice date ${receiptDate2} shown`);
    else throw new Error(`row after receipt: ${txt}`);
    const { data: r } = await db.from("renewals").select("*").eq("id", renewal2.id).single();
    if (r.status === "Awaiting Payment" && r.notice_received_date === receiptDate2) t.pass(`DB: status still Awaiting Payment, notice_received_date=${r.notice_received_date}`);
    else throw new Error(`DB status=${r.status} notice=${r.notice_received_date}`);
    renewal2 = r;
  });

  await step(t, "Edit receipt date re-opens with existing date", async () => {
    await openRenewalsRows(page);
    const row = page.getByRole("row").filter({ hasText: POLICY_NO_1 }).first();
    await row.getByRole("button", { name: "Edit receipt date" }).click();
    await page.waitForTimeout(600);
    const title = page.getByRole("heading", { name: "Edit receipt date" });
    if (!(await title.count())) throw new Error("Edit receipt date modal title missing");
    const val = await page.getByLabel("Notice received date").inputValue();
    if (val === receiptDate) t.pass(`Edit receipt date modal prefilled with ${val}`);
    else throw new Error(`modal prefilled ${val}, expected ${receiptDate}`);
    await t.shot("5.2-edit-modal");
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  const fails = await t.finish();
  videos.push("qa-oct2/videos/5.2-notice-received/5.2-notice-received.webm");
  results.push({ section: "5.2 Notice received date", result: verdict(fails, bugsBefore2), evidence: "date shown + sorts; Upcoming→Notice Received; Awaiting Payment unchanged; Edit receipt date prefilled" });
}

/* ======================================================================= */
/* 5.3 Configurable email schedule                                         */
/* ======================================================================= */
const settingsChanges = [];
{
  const t = await startFeature("5.3-email-schedule");
  relax(t);
  const { page } = t;
  const bugsBefore3 = bugs.length;
  const EXPECTED_RULES = [
    { key: "notice_received", name: "Client notice receipt", basis: "notice_received_date", offset: 0, recipient: "client" },
    { key: "client_reminder", name: "Client renewal reminder", basis: "renewal_due_date", offset: -30, recipient: "client" },
    { key: "missing_notice", name: "Carrier notice request", basis: "renewal_due_date", offset: -60, recipient: "carrier" },
    { key: "premium_breakdown", name: "Carrier premium breakdown request", basis: "renewal_due_date", offset: -60, recipient: "carrier" },
  ];
  const { data: rulesDb } = await db.from("renewal_email_rules").select("*");
  const ruleByKey = Object.fromEntries((rulesDb ?? []).map((r) => [r.rule_key, r]));
  const reminderRule = ruleByKey.client_reminder;
  const originalOffset = reminderRule?.offset_days;

  await step(t, "Settings → Notifications lists four rules with defaults", async () => {
    await page.goto("/settings?tab=Notifications");
    await settle(page, 3000);
    const tab = page.getByRole("button", { name: "Notifications" });
    if (await tab.count()) await tab.first().click();
    await settle(page);
    if (!(await page.getByRole("heading", { name: "Renewal email rules" }).count())) throw new Error("Renewal email rules heading missing");
    const forms = page.locator("form[aria-labelledby^='renewal-rule-']");
    const n = await forms.count();
    if (n === 4) t.pass("Four rule forms rendered"); else throw new Error(`expected 4 rule forms, found ${n}`);
    await t.shot("5.3-notifications");
    for (const exp of EXPECTED_RULES) {
      const r = ruleByKey[exp.key];
      if (!r) { fail(t, `rule ${exp.key} missing in DB`); continue; }
      const form = page.locator(`form[aria-labelledby='renewal-rule-${r.id}-title']`);
      if (!(await form.count())) { fail(t, `form for ${exp.name} not rendered`); continue; }
      const name = (await form.locator("h4").innerText()).trim();
      const basis = await form.locator(`#renewal-rule-${r.id}-basis`).inputValue();
      const offset = await form.locator(`#renewal-rule-${r.id}-offset`).inputValue();
      const timing = (await form.locator(`#renewal-rule-${r.id}-timing`).innerText()).trim();
      let recipient;
      if (exp.recipient === "client") recipient = (await form.getByText("Client · policy holder email").count()) ? "Client · policy holder email" : "(missing client recipient text)";
      else {
        const sel = form.locator(`#renewal-rule-${r.id}-contact`);
        recipient = await sel.locator("option:checked").innerText();
      }
      const active = await form.locator(`#renewal-rule-${r.id}-active`).isChecked();
      const ok = name === exp.name && basis === exp.basis && Number(offset) === exp.offset && active
        && (exp.recipient === "client" ? recipient.startsWith("Client") : recipient.includes("Thea Opura"));
      const line = `${name}: basis=${basis}, offset=${offset} (${timing}), recipient="${recipient}", active=${active}`;
      if (ok) t.pass(line); else fail(t, `${line} — expected ${JSON.stringify(exp)}`);
      if (exp.key === "premium_breakdown" && name !== "Carrier premium breakdown") {
        bug(t, "Rule name differs from checklist", `Checklist/table names the 4th rule "Carrier premium breakdown"; UI/DB show "${name}". Low severity (wording).`, "qa-oct2/videos/5.3-email-schedule/5.3-notifications.png");
      }
    }
  });

  await step(t, "Change reminder offset, save, verify, restore", async () => {
    if (!reminderRule) throw new Error("client_reminder rule missing");
    const id = reminderRule.id;
    const offsetInput = page.locator(`#renewal-rule-${id}-offset`);
    const form = page.locator(`form[aria-labelledby='renewal-rule-${id}-title']`);
    const newOffset = originalOffset - 1; // -30 → -31
    await offsetInput.fill(String(newOffset));
    settingsChanges.push({ what: `renewal_email_rules.client_reminder.offset_days`, before: originalOffset, changedTo: newOffset });
    const t0 = Date.now();
    await form.getByRole("button", { name: "Save rule" }).click();
    const status = form.getByRole("status");
    const seen = await status.filter({ hasText: "Rule saved." }).waitFor({ state: "visible", timeout: 90_000 }).then(() => true).catch(() => false);
    if (seen) t.pass(`Saved offset ${originalOffset} → ${newOffset}: "Rule saved." (after ${Date.now() - t0} ms)`);
    else {
      const alert = form.getByRole("alert");
      fail(t, `no "Rule saved." status within 90 s (alert: ${(await alert.count()) ? await alert.innerText() : "none"})`);
    }
    const w = await waitDb(() => db.from("renewal_email_rules").select("offset_days").eq("id", id).single().then((r) => r.data), (r) => r?.offset_days === newOffset);
    if (w.value?.offset_days === newOffset) t.pass(`DB offset_days=${w.value.offset_days}`); else throw new Error(`DB offset_days=${w.value?.offset_days} after ${w.ms} ms`);
    await page.reload();
    await settle(page, 2500);
    const tab = page.getByRole("button", { name: "Notifications" });
    if (await tab.count()) await tab.first().click();
    await settle(page);
    const shown = await page.locator(`#renewal-rule-${id}-offset`).inputValue();
    if (Number(shown) === newOffset) t.pass(`After reload UI shows offset ${shown}`); else throw new Error(`after reload UI shows ${shown}`);
    const timing = (await page.locator(`#renewal-rule-${id}-timing`).innerText()).trim();
    t.note(`Timing helper: ${timing}`);
    await t.shot("5.3-offset-changed");
  });

  await step(t, "Restore reminder offset", async () => {
    const id = reminderRule.id;
    const form = page.locator(`form[aria-labelledby='renewal-rule-${id}-title']`);
    await page.locator(`#renewal-rule-${id}-offset`).fill(String(originalOffset));
    const t0 = Date.now();
    await form.getByRole("button", { name: "Save rule" }).click();
    const seen = await form.getByRole("status").filter({ hasText: "Rule saved." }).waitFor({ state: "visible", timeout: 90_000 }).then(() => true).catch(() => false);
    if (seen) t.pass(`Restore save acknowledged "Rule saved." (after ${Date.now() - t0} ms)`);
    const w = await waitDb(() => db.from("renewal_email_rules").select("offset_days").eq("id", id).single().then((r) => r.data), (r) => r?.offset_days === originalOffset);
    const after = w.value;
    if (after?.offset_days === originalOffset) {
      t.pass(`Restored offset_days=${after.offset_days} (DB verified)`);
      settingsChanges[settingsChanges.length - 1].restoredTo = after.offset_days;
    } else throw new Error(`restore failed, DB offset_days=${after?.offset_days}`);
    await t.shot("5.3-offset-restored");
  });

  await step(t, "View as Staff → read-only; Agent → no tab", async () => {
    await viewAs(page, "Staff · Broker");
    await settle(page);
    const tab = page.getByRole("button", { name: "Notifications" });
    if (await tab.count()) await tab.first().click();
    await settle(page);
    await t.shot("5.3-staff");
    const fieldsets = page.locator("form[aria-labelledby^='renewal-rule-'] fieldset");
    const fsCount = await fieldsets.count();
    let allDisabled = fsCount > 0;
    for (let i = 0; i < fsCount; i++) {
      const fs = fieldsets.nth(i);
      const attr = await fs.getAttribute("disabled");
      const offsetEnabled = await fs.locator("input[type=number]").isEnabled();
      if (attr === null || offsetEnabled) allDisabled = false;
    }
    const saveCount = await page.getByRole("button", { name: "Save rule" }).count();
    const queueCount = await page.getByRole("button", { name: "Queue due now" }).count();
    const note = await page.getByText("Admin controls rule settings and queue runs.").count();
    if (allDisabled && saveCount === 0 && queueCount === 0) t.pass(`Staff: ${fsCount} rule fieldsets disabled, no Save rule / Queue due now buttons, read-only note=${note > 0}`);
    else throw new Error(`Staff view: fieldsets disabled=${allDisabled} saveButtons=${saveCount} queueButtons=${queueCount}`);

    await viewAs(page, "Agent");
    await settle(page);
    await t.shot("5.3-agent");
    const agentTab = page.getByRole("button", { name: "Notifications", exact: true });
    const rulesHeading = page.getByRole("heading", { name: "Renewal email rules" });
    if ((await agentTab.count()) === 0 && (await rulesHeading.count()) === 0) t.pass("Agent: no Notifications tab and rules not rendered");
    else throw new Error(`Agent view: Notifications tab count=${await agentTab.count()}, rules heading=${await rulesHeading.count()}`);
    await resetPersona(page);
  });

  await step(t, "DB: task + draft for the notice-receipt rule", async () => {
    if (!renewal1) throw new Error("no renewal from 5.1");
    const { data: drafts } = await db.from("renewal_email_drafts").select("*, renewal_email_rules(rule_key,name), tasks(id,title,status,due_date,assigned_user_id,reference_no)").eq("renewal_id", renewal1.id);
    for (const d of drafts) {
      created.push({ table: "renewal_email_drafts", id: d.id, ref: `${d.renewal_email_rules?.rule_key} / ${d.status}` });
      created.push({ table: "tasks", id: d.task_id, ref: d.tasks?.reference_no ?? d.tasks?.title });
    }
    const nr = drafts.filter((d) => d.renewal_email_rules?.rule_key === "notice_received");
    if (nr.length !== 1) throw new Error(`expected 1 notice_received draft for renewal, found ${nr.length} (all: ${drafts.map((d) => d.renewal_email_rules?.rule_key).join(",")})`);
    const d = nr[0];
    t.pass(`Draft ${d.id} status=${d.status} due=${d.due_date} to=${d.recipient_email} subject="${d.subject}"`);
    if (d.tasks?.title === "Review renewal email — Client notice receipt" && d.tasks.status === "Open") t.pass(`Linked task ${d.tasks.reference_no} "${d.tasks.title}" Open, due ${d.tasks.due_date}, assigned ${d.tasks.assigned_user_id}`);
    else throw new Error(`task: ${JSON.stringify(d.tasks)}`);
    if (d.due_date !== renewal1.notice_received_date) fail(t, `draft due_date ${d.due_date} != notice_received_date ${renewal1.notice_received_date}`);
    const others = drafts.filter((d) => d.renewal_email_rules?.rule_key !== "notice_received");
    if (others.length === 0) t.pass("No other rule drafts queued (reminder/carrier rules not yet due for a ~100-day-out renewal)");
    else t.note(`Other drafts present: ${others.map((o) => `${o.renewal_email_rules?.rule_key}:${o.status}`).join(", ")}`);
  });

  await step(t, "DB: at most one draft per rule per renewal", async () => {
    const { data: all } = await db.from("renewal_email_drafts").select("renewal_id,rule_id");
    const seen = {};
    for (const d of all) seen[`${d.renewal_id}:${d.rule_id}`] = (seen[`${d.renewal_id}:${d.rule_id}`] ?? 0) + 1;
    const dupes = Object.entries(seen).filter(([, n]) => n > 1);
    if (dupes.length) throw new Error(`duplicate drafts: ${JSON.stringify(dupes)}`);
    t.pass(`${all.length} drafts total, no (renewal, rule) duplicates (DB unique constraint)`);
    // Second receipt (Awaiting Payment renewal) also queued exactly one notice draft
    if (renewal2) {
      const { data: d2 } = await db.from("renewal_email_drafts").select("id,status,task_id, renewal_email_rules(rule_key), tasks(reference_no,title)").eq("renewal_id", renewal2.id);
      for (const d of d2) {
        created.push({ table: "renewal_email_drafts", id: d.id, ref: `${d.renewal_email_rules?.rule_key} / ${d.status}` });
        created.push({ table: "tasks", id: d.task_id, ref: d.tasks?.reference_no ?? d.tasks?.title });
      }
      t.note(`Awaiting Payment renewal drafts: ${d2.map((d) => `${d.renewal_email_rules?.rule_key}:${d.status}`).join(", ") || "none"}`);
    }
  });

  await step(t, "/tasks shows task with Open draft; modal controls", async () => {
    await page.goto("/tasks");
    await settle(page, 3000);
    const taskRow = page.locator("div").filter({ has: page.getByText("Review renewal email — Client notice receipt") }).filter({ hasText: CLIENT_NAME });
    const title = page.getByText(`Review renewal email — Client notice receipt`).filter({ hasText: CLIENT_NAME });
    const count = await title.count();
    if (!count) throw new Error("task 'Review renewal email — Client notice receipt — QA OCT2 Renewals' not on /tasks");
    t.pass(`/tasks lists ${count} 'Review renewal email — Client notice receipt — ${CLIENT_NAME}' task(s)`);
    await t.shot("5.3-tasks");
    // the Open draft button sits in the sibling div right after the task button
    const openDraft = title.first().locator("xpath=ancestor::button[1]/following-sibling::div//button[normalize-space()='Open draft']");
    if (!(await openDraft.count())) throw new Error("Open draft button missing under the task");
    await openDraft.click();
    await page.waitForTimeout(1500);
    await settle(page);
    const heading = page.getByRole("heading", { name: "Renewal email draft" });
    if (!(await heading.count())) throw new Error("Renewal email draft modal missing");
    await t.shot("5.3-draft-modal");
    const to = page.getByLabel("To email");
    const subject = page.getByLabel("Subject");
    const body = page.getByLabel("Body");
    const toVal = await to.inputValue();
    const subjVal = await subject.inputValue();
    const bodyVal = await body.inputValue();
    t.note(`Draft To="${toVal}" Subject="${subjVal}" Body starts "${bodyVal.slice(0, 60).replace(/\n/g, " ")}…"`);
    if (!toVal || !subjVal || !bodyVal) fail(t, "Draft fields not prefilled");
    else t.pass("Draft prefilled: To / Subject / Body editable inputs");
    if (/\{\{[a-z_]+\}\}/.test(subjVal + bodyVal)) bug(t, "Unmerged template tokens in draft", `Draft subject/body still contains merge tokens: ${(subjVal + " " + bodyVal).match(/\{\{[a-z_]+\}\}/g).join(", ")}`, "qa-oct2/videos/5.3-email-schedule/5.3-draft-modal.png");
    const save = page.getByRole("button", { name: "Save draft" });
    const dismiss = page.getByRole("button", { name: "Dismiss draft" });
    const review = page.getByRole("button", { name: "Review email" });
    const logBtn = page.getByRole("button", { name: /^Log/ });
    // Sending controls resolve after a permission check round-trip.
    const permT0 = Date.now();
    await page.getByText("Checking sending permission…").waitFor({ state: "hidden", timeout: 90_000 }).catch(() => {});
    const sendBlockedMsg = await page.locator("p", { hasText: /sending|Gmail|mailbox|permission/i }).filter({ hasNot: page.locator("b") }).allInnerTexts().catch(() => []);
    t.note(`Controls: Save draft=${await save.count()} Dismiss draft=${await dismiss.count()} Review email (send)=${await review.count()} Log*=${await logBtn.count()} (send controls settled in ${Date.now() - permT0} ms; notes: ${sendBlockedMsg.slice(0, 3).join(" / ").slice(0, 300)})`);
    if ((await save.count()) && (await dismiss.count())) t.pass("Edit (Save draft) and Dismiss draft controls present");
    else throw new Error("Save/Dismiss controls missing");
    if (!(await logBtn.count())) bug(t, "No 'log' control on the draft modal", "Checklist 5.3 says Open draft lets staff 'edit, log or dismiss'. The modal offers Save draft, Dismiss draft and Review email → Send email (Gmail) — there is no separate 'Log' action (logging was replaced by Gmail sending in migration 0059). Wording mismatch between checklist and UI; low severity.", "qa-oct2/videos/5.3-email-schedule/5.3-draft-modal.png");
    // editing: modify subject and check Save draft enables (no send)
    await subject.fill(subjVal + " (QA edit)");
    await page.waitForTimeout(300);
    if (!(await save.isDisabled())) t.pass("Editing the subject enables Save draft");
    else fail(t, "Save draft stays disabled after editing subject");
    const t0 = Date.now();
    await save.click();
    const toastSeen = await waitText(page, "Draft saved");
    if (toastSeen) t.pass(`Toast: Draft saved (after ${Date.now() - t0} ms)`);
    else t.note("No 'Draft saved' toast observed within 90 s");
    const w = await waitDb(() => db.from("renewal_email_drafts").select("edited_subject,status").eq("renewal_id", renewal1.id).eq("rule_id", ruleByKey.notice_received.id).single().then((r) => r.data), (d) => d?.edited_subject === subjVal + " (QA edit)");
    const dAfter = w.value;
    if (dAfter?.edited_subject === subjVal + " (QA edit)" && dAfter.status === "Draft") t.pass(`DB edited_subject saved, status still Draft (after ${w.ms} ms)`);
    else fail(t, `DB after save: ${JSON.stringify(dAfter)}`);
    await page.getByRole("button", { name: "Saving…" }).waitFor({ state: "hidden", timeout: 90_000 }).catch(() => {});
    await t.shot("5.3-draft-edited");
    await page.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(500);
  });

  await step(t, "Dashboard My tasks shows the draft task", async () => {
    // Dashboard rows show title only (no client), so compare against the DB count of open
    // notice-receipt tasks due within the dashboard window (overdue/today/this week).
    const { data: openTasks } = await db.from("tasks").select("id,client_id,due_date,status").eq("title", "Review renewal email — Client notice receipt").in("status", ["Open", "In Progress"]).lte("due_date", isoPlus(7, today));
    const mine = (openTasks ?? []).filter((x) => x.client_id === client.id).length;
    await page.goto("/dashboard");
    await settle(page, 3000);
    const title = page.getByText("Review renewal email — Client notice receipt", { exact: false });
    const n = await title.count();
    await t.shot("5.3-dashboard");
    if (!n) throw new Error("task not shown in dashboard My tasks");
    const openDraft = page.getByRole("button", { name: /Open draft|View draft/ });
    const nBtn = await openDraft.count();
    if (n >= (openTasks?.length ?? 0) && mine >= 1) t.pass(`Dashboard My tasks lists ${n} 'Review renewal email — Client notice receipt' task(s) (DB: ${openTasks.length} open in window, ${mine} for the QA client); Open/View draft buttons=${nBtn}`);
    else throw new Error(`dashboard shows ${n} notice-receipt tasks, DB has ${openTasks?.length} (QA client: ${mine})`);
    if (!nBtn) fail(t, "No Open draft button in dashboard My tasks");
  });

  const fails = await t.finish();
  videos.push("qa-oct2/videos/5.3-email-schedule/5.3-email-schedule.webm");
  results.push({ section: "5.3 Configurable email schedule", result: verdict(fails, bugsBefore3), evidence: "4 rules w/ defaults; offset edit+restore; staff RO / agent no tab; task+draft via receipt; one draft per rule; wording mismatches (bugs)" });
}

/* ======================================================================= */
/* Summary                                                                 */
/* ======================================================================= */
const summaryLines = [];
summaryLines.push("# Section 5 — Renewals (TESTING-OCT2.md 5.1–5.3)", "", `Run: ${new Date().toISOString()}`, "");
summaryLines.push("| Sub-section | Result | Evidence |", "| :-- | :-- | :-- |");
for (const r of results) summaryLines.push(`| ${r.section} | ${r.result} | ${r.evidence} |`);
summaryLines.push("", "## Bugs & errors", "");
if (!bugs.length) summaryLines.push("None observed.");
bugs.forEach((b, i) => summaryLines.push(`${i + 1}. **${b.title}** — ${b.detail}${b.shot ? ` (screenshot: ${b.shot})` : ""}`));
summaryLines.push("", "## Created records", "", "| table | id | reference / label |", "| :-- | :-- | :-- |");
const seen = new Set();
for (const c of created) { const k = `${c.table}:${c.id}`; if (seen.has(k)) continue; seen.add(k); summaryLines.push(`| ${c.table} | ${c.id} | ${c.ref ?? ""} |`); }
summaryLines.push("", "## Settings restored", "");
if (!settingsChanges.length) summaryLines.push("none");
for (const s of settingsChanges) summaryLines.push(`- ${s.what}: before=${s.before} → changed to ${s.changedTo} → restored to ${s.restoredTo ?? "NOT RESTORED"}`);
summaryLines.push("", "## Videos", "", ...videos.map((v) => `- ${v}`), "", "Per-feature reports: qa-oct2/reports/5.1-renewals-from-policies.md, 5.2-notice-received.md, 5.3-email-schedule.md");
const summaryPath = join(REPORT_ROOT, "05-renewals-SUMMARY.md");
appendFileSync(summaryPath, "", { flag: "w" });
appendFileSync(summaryPath, summaryLines.join("\n") + "\n");
console.log(`\nSummary written to ${summaryPath}`);
console.log(summaryLines.join("\n"));
