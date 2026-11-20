/**
 * TESTING-OCT2.md §3.1 — New Application opens the full requirement set (H3a).
 *
 *   node --env-file=.env.local qa-oct2/03-applications.mjs
 */
import { startFeature, settle, db, createTestClient } from "./lib.mjs";

const t = await startFeature("3.1-new-application-requirements");
const { page } = t;
page.on("dialog", (d) => d.accept());
// Sibling QA runs share the dev server; first compiles of a route can take a while.
page.setDefaultNavigationTimeout(150_000);
const goto = (path) => page.goto(path, { waitUntil: "domcontentloaded" });

const step = async (name, fn) => {
  try {
    await fn();
  } catch (err) {
    t.fail(`${name}: ${err.message.split("\n")[0]}`);
    await t.shot(`fail-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`).catch(() => {});
  }
};
const check = (ok, text) => (ok ? t.pass(text) : t.fail(text));

/* ---------- locators ---------- */
const wiz = () => page.locator("div.fixed.inset-0").filter({ hasText: "New Client Application" });
const body = () => wiz().locator("div.min-h-0.overflow-y-auto");
const heading = () => body().locator("h2").first();
const fieldSelect = (label) =>
  wiz().locator(`xpath=.//label[normalize-space(.)="${label} *" or normalize-space(.)="${label}"]/following-sibling::select[1]`);
const yesNo = (label, value) =>
  wiz().locator(`xpath=.//label[normalize-space(.)="${label} *" or normalize-space(.)="${label}"]/following-sibling::div//button[normalize-space(.)="${value}"]`);
// Done steps show a check icon instead of the number, so the digit is optional.
const rail = (label) => wiz().locator("button").filter({ hasText: new RegExp(`^(\\d\\s*)?${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) });
const continueBtn = () => wiz().getByRole("button", { name: "Continue", exact: true });
const workflow = () => page.locator('[role="dialog"][aria-label="Application workflow"]');

/** Names + conditions of the Step 4 (health/hmo) requirement preview, keyed "[phase] section". */
async function previewItems() {
  return body().evaluate((el) => {
    const sections = {};
    let phase = "";
    let section = "";
    for (const node of el.querySelectorAll("h3, span.flex-1, span.uppercase")) {
      if (node.tagName === "H3") section = node.textContent.trim();
      else if (node.tagName === "SPAN" && node.classList.contains("uppercase")) phase = `[${node.textContent.trim()}] `;
      else {
        const name = node.childNodes[0]?.textContent?.trim() ?? "";
        const cond = node.querySelector("span")?.textContent?.trim() ?? "";
        (sections[`${phase}${section}`] ??= []).push({ name, cond, phase: phase.trim(), section });
      }
    }
    return sections;
  });
}
const flat = (sections) => Object.values(sections).flat();
const describe = (sections) =>
  Object.entries(sections)
    .map(([s, items]) => `${s || "(no section)"}: ${items.map((i) => i.name + (i.cond ? ` ${i.cond}` : "")).join(" | ")}`)
    .join(" || ");

/** Items of the Travel requirements block rendered on the travel Step 1. */
async function travelPreviewItems() {
  return wiz().locator("ul > li div.font-semibold").allTextContents();
}

/* ---------- seed ---------- */
const client = await createTestClient("Applicant", { product_interest: "Select", gender: "Male", date_of_birth: "1990-01-01" });
const clientName = `${client.first_name} ${client.last_name}`;
t.note(`Seeded client ${clientName} id=${client.id} (lifecycle ${client.lifecycle_stage})`);

/* ---------- 1a. header entry point: gate on product ---------- */
await step("open from header", async () => {
  await goto("/");
  await settle(page, 2500);
  const headerBtn = page.getByRole("button", { name: "New application" });
  check((await headerBtn.count()) >= 1, `Header shows a "New application" button (${await headerBtn.count()} found on dashboard)`);
  await headerBtn.first().click();
  await wiz().waitFor({ state: "visible" });
  await settle(page, 800);
  check((await heading().textContent()).trim() === "Client type & application setup", `Wizard opened on Step 1 heading "${(await heading().textContent()).trim()}"`);
  await t.shot("01-header-wizard-step1");

  check(await continueBtn().isDisabled(), "Continue is disabled before a product is chosen");
  const hint = wiz().getByText("Choose a product to continue — it decides the requirements");
  check((await hint.count()) === 1, 'Footer hint "Choose a product to continue — it decides the requirements" is shown');
  const railLabels = ["Client information", "Product details", "Requirements", "Communication", "Review & create"];
  for (const label of railLabels) {
    const b = rail(label);
    const disabled = (await b.count()) === 1 && (await b.isDisabled());
    check(disabled, `Rail step "${label}" is disabled before a product is chosen (title="${await b.getAttribute("title")}")`);
  }
  await rail("Requirements").click({ force: true, timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
  check((await heading().textContent()).trim() === "Client type & application setup", "Forcing a click on the disabled rail step keeps the wizard on Step 1");
  await wiz().getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForTimeout(600);
  check((await wiz().count()) === 0, "Cancel closes the wizard (nothing dirty, no confirm)");
});

/* ---------- 1b. /applications entry point ---------- */
await step("open from /applications", async () => {
  await goto("/applications");
  await settle(page, 2500);
  await t.shot("02-applications-list");
  const btns = page.getByRole("button", { name: "New application" });
  const n = await btns.count();
  check(n === 2, `/applications shows the page "New application" button plus the header one (${n} found)`);
  await btns.nth(n - 1).click();
  await wiz().waitFor({ state: "visible" });
  await settle(page, 800);
  check(await continueBtn().isDisabled(), "Continue disabled on Step 1 (opened from /applications) until a product is chosen");
  check(await rail("Product details").isDisabled(), "Rail step 3 disabled (opened from /applications)");
});

/* ---------- 2. workflow + client ---------- */
await step("fill workflow + existing client", async () => {
  await fieldSelect("Application type").selectOption({ label: "New Insurance Application" });
  await fieldSelect("Source").selectOption({ label: "Referral" });
  check(await continueBtn().isDisabled(), "Continue still disabled after type/source but no product");
  await wiz().getByRole("button", { name: "Existing client", exact: true }).click();
  const search = wiz().getByPlaceholder("Search a client…");
  // The dev server is shared with sibling runs and a server action can take a minute; wait for
  // the search action's response (a client array or `1:[]`) instead of a fixed delay.
  const searchFor = async (term) => {
    const resp = page.waitForResponse(
      async (r) => {
        if (r.request().method() !== "POST") return false;
        const b = await r.text().catch(() => "");
        return b.includes('"clientType"') || /\n1:\[\]\s*$/.test(b);
      },
      { timeout: 150_000 },
    );
    await search.fill("");
    await search.fill(term);
    const body = await (await resp).text();
    await page.waitForTimeout(500);
    return body.includes('"clientType"') ? (body.match(/"name":"([^"]*)"/g) ?? []).map((m) => m.slice(8, -1)) : [];
  };
  // Full-name search ("QA OCT2 Applicant") returns nothing: the repository matches the whole
  // string against first_name OR last_name separately. Record it, then search by email.
  const fullNameHits = await searchFor(clientName);
  if (fullNameHits.length === 0) {
    await t.shot("03-client-search-fullname-no-results");
    t.bug(`Existing-client picker: typing the full name "${clientName}" (first + last) returns no results — search only matches first_name OR last_name separately (lib/repositories/clients/clients.repository.supabase.ts search()). Searching by last name or email works.`);
  } else t.pass(`Full-name search "${clientName}" found ${fullNameHits.length} result(s): ${fullNameHits.join(", ")}`);
  const emailHits = await searchFor(client.email);
  check(emailHits.includes(clientName), `Email search returned ${emailHits.join(", ") || "nothing"}`);
  const result = wiz().locator("button").filter({ hasText: clientName }).first();
  await result.waitFor({ state: "visible", timeout: 15_000 });
  await result.click();
  await settle(page, 1000);
  check((await wiz().getByText(clientName).count()) >= 1, `Existing client "${clientName}" picked in Step 1`);
  check(await continueBtn().isDisabled(), "Continue still disabled with client picked but no product");
  await t.shot("03-step1-client-picked");
});

/* ---------- 3. product previews ---------- */
const previews = {};
const BC_FLEXI_MARKERS = ["Proposal Information Sheet", "Corporate Enrollment Template", "SEC/BSP", "Franchise Application Form"];

async function openStep4() {
  await rail("Requirements").click();
  await page.waitForTimeout(600);
  const h = (await heading().textContent()).trim();
  if (h !== "Requirements & documents") throw new Error(`Step 4 heading is "${h}"`);
}
async function backToStep1() {
  await rail("Client type & setup").click();
  await page.waitForTimeout(400);
}

for (const product of ["Select", "Blue Royale", "FlexiShield", "BC Flexi"]) {
  await step(`preview ${product}`, async () => {
    await fieldSelect("Product").selectOption({ label: product });
    await page.waitForTimeout(500);
    check(!(await continueBtn().isDisabled()), `${product}: Continue enabled once the product is chosen`);
    check(!(await rail("Requirements").isDisabled()), `${product}: rail step 4 enabled once the product is chosen`);
    await openStep4();
    // BC Flexi preview is loaded from a server action; wait for rows.
    await body().locator("span.flex-1").first().waitFor({ state: "visible", timeout: 150_000 });
    await page.waitForTimeout(800);
    const sections = await previewItems();
    const items = flat(sections);
    previews[product] = items;
    t.note(`${product}: ${items.length} preview items — ${describe(sections)}`);
    await t.shot(`04-preview-${product.toLowerCase().replace(/\s+/g, "-")}`);
    const names = items.map((i) => i.name);
    check((await body().getByText("Select a product in Step 1 to generate the checklist.").count()) === 0, `${product}: empty-state text is not shown`);
    if (product === "BC Flexi") {
      check(BC_FLEXI_MARKERS.filter((m) => names.some((n) => n.includes(m))).length >= 3, `${product}: preview shows the corporate/HMO list (${BC_FLEXI_MARKERS.filter((m) => names.some((n) => n.includes(m))).join(", ")})`);
      const phases = [...new Set(items.map((i) => i.phase).filter(Boolean))];
      check(phases.length === 2, `${product}: phases shown (${phases.join(", ")})`);
      const agreed = items.filter((i) => /once the group agrees/i.test(i.phase));
      check(agreed.length > 0 && agreed.every((i) => i.cond.length > 0), `${product}: "Once the group agrees" rows (${agreed.length}) all carry a condition / "not required yet" marker`);
    } else {
      check(names.some((n) => n.startsWith("Completed regular application form") && n.includes(clientName)), `${product}: application form requirement for ${clientName}`);
      check(names.some((n) => n.startsWith("Valid government-issued ID") && n.includes(clientName)), `${product}: government ID requirement`);
      check(names.some((n) => n.startsWith("Attestation letter with specimen signatures")), `${product}: attestation letter requirement (non-remote sale)`);
      check(!names.some((n) => BC_FLEXI_MARKERS.some((m) => n.includes(m))), `${product}: no BC Flexi/HMO corporate items in the preview`);
      check(Object.keys(sections).includes("Basic intake") && Object.keys(sections).includes("Application documents"), `${product}: sections ${Object.keys(sections).join(", ")}`);
      if (product === "FlexiShield") {
        check(names.some((n) => n.startsWith("Schedule of Benefits of the first-layer HMO")) && names.some((n) => n.startsWith("Certificate of Coverage of the first-layer HMO")), `${product}: first-layer HMO documents listed`);
        check(!names.some((n) => n.includes("Treatment Area Limitation")), `${product}: no TAL/CAC rows`);
      } else {
        check(names.some((n) => n.includes("Treatment Area Limitation (TAL)")) && names.some((n) => n.includes("Client Application for Coverage (CAC)")), `${product}: TAL + CAC conditional rows listed`);
        check(items.filter((i) => i.name.includes("(TAL)") || i.name.includes("(CAC)")).every((i) => i.cond.includes("not required yet")), `${product}: TAL/CAC marked "(not required yet)"`);
      }
    }
    if (product === "Blue Royale") {
      // Conditional medical items: flag pre-existing conditions + current smoker in Step 3.
      await rail("Product details").click();
      await page.waitForTimeout(500);
      await yesNo("Pre-existing conditions?", "Yes").click();
      await fieldSelect("Smoker").selectOption({ label: "Current" }).catch(async () => {
        const opts = await fieldSelect("Smoker").locator("option").allTextContents();
        throw new Error(`Smoker options: ${opts.join(", ")}`);
      });
      await openStep4();
      await page.waitForTimeout(500);
      const cond = await previewItems();
      const condNames = flat(cond).map((i) => i.name);
      t.note(`Blue Royale (pre-existing=Yes, smoker=Current): ${condNames.length} items — ${describe(cond)}`);
      await t.shot("04-preview-blue-royale-conditional");
      check(Object.keys(cond).includes("Medical requirements"), 'Blue Royale: "Medical requirements" section appears with conditional answers');
      check(condNames.some((n) => n.startsWith("Medical questionnaire or supporting records")), "Blue Royale: medical questionnaire row appears when pre-existing = Yes");
      check(condNames.some((n) => n.startsWith("Chest X-ray")), "Blue Royale: chest X-ray row appears for a current smoker");
      check(!condNames.some((n) => BC_FLEXI_MARKERS.some((m) => n.includes(m))), "Blue Royale: still no BC Flexi/HMO corporate list");
      // reset for the later products
      await rail("Product details").click();
      await page.waitForTimeout(400);
      await yesNo("Pre-existing conditions?", "No").click();
      await fieldSelect("Smoker").selectOption({ label: "Never" }).catch(() => fieldSelect("Smoker").selectOption({ index: 0 }));
    }
    await backToStep1();
  });
}

await step("preview TravelSafe", async () => {
  await fieldSelect("Product").selectOption({ label: "TravelSafe" });
  await page.waitForTimeout(800);
  const h = (await heading().textContent()).trim();
  check(h === "Client, trip & requirements", `TravelSafe switches to the 2-step travel wizard (heading "${h}")`);
  const reqSection = wiz().locator("h3").filter({ hasText: /^Requirements$/i });
  await reqSection.first().waitFor({ state: "visible", timeout: 10_000 });
  const items = await travelPreviewItems();
  previews.TravelSafe = items.map((name) => ({ name, cond: "" }));
  t.note(`TravelSafe: ${items.length} preview items — ${items.join(" | ")}`);
  await t.shot("04-preview-travelsafe");
  check(items.some((n) => n.startsWith("Completed Travel application form")), "TravelSafe: travel application form row");
  check(items.some((n) => n.startsWith("Payment proof")), "TravelSafe: payment proof row");
  check(items.some((n) => n.startsWith("Issued Travel policy")), "TravelSafe: issued policy row (after issuance)");
  check(!items.some((n) => BC_FLEXI_MARKERS.some((m) => n.includes(m))), "TravelSafe: no BC Flexi corporate list");
  check(!(await continueBtn().isDisabled()), "TravelSafe: Continue enabled");
});

/* ---------- 4. create a Select application ---------- */
let appId = null;
let referenceNo = null;
let finalPreview = null;
await step("create Select application", async () => {
  await fieldSelect("Product").selectOption({ label: "Select" });
  await page.waitForTimeout(600);
  check((await heading().textContent()).trim() === "Client type & application setup", "Back on the 6-step wizard after re-choosing Select");
  await continueBtn().click();
  await page.waitForTimeout(400);
  check((await heading().textContent()).trim() === "Client information", "Continue → Step 2 Client information");
  await continueBtn().click();
  await page.waitForTimeout(400);
  check((await heading().textContent()).trim() === "Product-specific details", "Continue → Step 3 Product-specific details");
  await fieldSelect("Select variant").selectOption({ label: "Select Plus" });
  await page.waitForTimeout(300);
  const planOpts = await fieldSelect("Plan option").locator("option").allTextContents();
  t.note(`Plan options for Select Plus: ${planOpts.join(" | ")}`);
  check(planOpts.length > 1, "Select Plus exposes at least one plan option");
  await fieldSelect("Plan option").selectOption({ index: 1 });
  await fieldSelect("Coverage type").selectOption({ label: "Individual" });
  await yesNo("Pre-existing conditions?", "No").click();
  await t.shot("05-step3-select-plan");
  await continueBtn().click();
  await page.waitForTimeout(500);
  check((await heading().textContent()).trim() === "Requirements & documents", "Continue → Step 4 Requirements & documents");
  const sections = await previewItems();
  finalPreview = flat(sections);
  t.note(`Final Select preview (${finalPreview.length}): ${describe(sections)}`);
  await t.shot("06-step4-final-preview");
  await continueBtn().click();
  await page.waitForTimeout(400);
  check((await heading().textContent()).trim() === "Communication & follow-up", "Continue → Step 5");
  await continueBtn().click();
  await page.waitForTimeout(500);
  check((await heading().textContent()).trim() === "Review & create application", "Continue → Step 6 Review & create");
  const still = wiz().getByText("stays greyed out until you add:");
  if (await still.count()) t.note(`Step 6 blockers: ${(await still.first().textContent()).trim()}`);
  const createBtn = wiz().getByRole("button", { name: "Create & request documents" });
  check(!(await createBtn.isDisabled()), "Create & request documents is enabled");
  await t.shot("07-step6-review");
  await createBtn.click();
  await workflow().waitFor({ state: "visible", timeout: 180_000 });
  const openedAt = Date.now();
  check(true, "Application workflow dialog opened straight after creating");
  await workflow().getByText("Loading the application…").waitFor({ state: "hidden", timeout: 120_000 }).catch(() => {});
  await workflow().locator('select[aria-label^="Status for "]').first().waitFor({ state: "visible", timeout: 120_000 });
  await settle(page, 1200);
  check((await wiz().count()) === 0, "Wizard closed after creating");
  await t.shot("08-workflow-opened");
  const text = await workflow().textContent();
  const ref = text.match(/APP-\d{4}-\d+/)?.[0] ?? null;
  referenceNo = ref;
  check(!!ref, `Workflow rail shows the application reference (${ref}) — opened within ${Date.now() - openedAt}ms of the dialog appearing`);
  check(text.includes(clientName), "Workflow rail shows the QA client name");
  check(/Step 1 of 6/.test(text), 'Workflow opens on "Step 1 of 6" (Requirements)');
  const rows = await workflow().evaluate((el) =>
    [...el.querySelectorAll('select[aria-label^="Status for "]')].map((sel) => {
      const info = sel.parentElement.querySelector(".min-w-0");
      const title = info.children[0];
      const name = title.childNodes[0]?.textContent?.trim() ?? "";
      const optional = !!title.querySelector("span");
      const second = info.children[1];
      const sub = second && second.tagName === "DIV" ? second.textContent.trim() : "";
      return { name, sub, optional, status: sel.value };
    }),
  );
  t.note(`Workflow checklist (${rows.length}): ${rows.map((r) => `${r.name}${r.sub ? ` — ${r.sub}` : ""}${r.optional ? " (optional)" : ""} [${r.status}]`).join(" | ")}`);
  const previewNames = finalPreview.map((i) => i.name).sort();
  const workflowNames = rows.map((r) => `${r.name}${r.sub ? ` — ${r.sub}` : ""}`).sort();
  const missing = previewNames.filter((n) => !workflowNames.includes(n));
  const extra = workflowNames.filter((n) => !previewNames.includes(n));
  check(missing.length === 0 && extra.length === 0 && rows.length === finalPreview.length, `Workflow checklist matches the Step 4 preview (${rows.length} vs ${finalPreview.length}); missing=[${missing.join("; ")}] extra=[${extra.join("; ")}]`);
  const optionalMatch = finalPreview.filter((i) => i.cond.includes("not required yet")).map((i) => i.name).sort().join("|") ===
    rows.filter((r) => r.optional).map((r) => `${r.name}${r.sub ? ` — ${r.sub}` : ""}`).sort().join("|");
  check(optionalMatch, "Optional (not required yet) rows match between preview and workflow");
});

/* ---------- 5. DB verification ---------- */
await step("db verification", async () => {
  const { data: apps, error } = await db.from("applications").select("id, reference_no, status, application_type, product_version_id, plan_option_id, coverage_type, client_id").eq("client_id", client.id);
  if (error) throw new Error(error.message);
  check(apps.length === 1, `Exactly one application row for the QA client (${apps.length})`);
  const app = apps[0];
  if (app) {
    appId = app.id;
    referenceNo = app.reference_no ?? referenceNo;
    t.note(`applications row: id=${app.id} reference_no=${app.reference_no} status=${app.status} type=${app.application_type} coverage=${app.coverage_type}`);
    check(app.status === "Applicant", `Application status is Applicant (${app.status})`);
    const { data: reqs } = await db.from("application_requirements").select("document_name, applies_to, is_required, status, section").eq("application_id", app.id).order("sort_order");
    t.note(`application_requirements rows (${reqs?.length}): ${(reqs ?? []).map((r) => `${r.document_name}${r.applies_to ? ` — ${r.applies_to}` : ""} [${r.status}${r.is_required ? "" : ", optional"}]`).join(" | ")}`);
    check((reqs?.length ?? 0) === finalPreview?.length, `DB has ${reqs?.length} requirement rows = ${finalPreview?.length} previewed`);
    const { data: cl } = await db.from("clients").select("lifecycle_stage, status").eq("id", client.id).single();
    t.note(`QA client after create: lifecycle_stage=${cl?.lifecycle_stage} status=${cl?.status}`);
  }
});

/* ---------- 6. list shows the new application ---------- */
await step("applications list", async () => {
  await workflow().getByRole("button", { name: "Close" }).click().catch(() => {});
  await goto("/applications");
  await settle(page, 2500);
  const row = page.getByText(referenceNo ?? "APP-", { exact: false }).first();
  check((await row.count()) >= 1, `/applications lists ${referenceNo}`);
  await t.shot("09-applications-list-after");
});

const fails = await t.finish();
console.log(`appId=${appId} reference=${referenceNo} client=${client.id}`);
process.exit(fails ? 1 : 0);
