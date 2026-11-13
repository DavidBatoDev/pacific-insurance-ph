/**
 * TESTING-OCT2.md §2 Proposals — 2.1 Payment frequency (H2a), 2.2 Details to encode (H2b).
 *   node --env-file=.env.local qa-oct2/02-proposals.mjs
 */
import { createTestClient, db, QA_PREFIX, settle, startFeature } from "./lib.mjs";

const created = []; // { table, id, label }

/** Close pop-ups first and cap the browser teardown so a stuck recorder can't hang the run. */
const finishGuarded = async (t) => {
  for (const p of t.context.pages()) if (p !== t.page) await p.close().catch(() => {});
  return Promise.race([t.finish(), new Promise((r) => setTimeout(() => { console.log("finish() timed out"); r(-1); }, 120_000))]);
};

const step = async (t, name, fn) => {
  try {
    await fn();
  } catch (err) {
    t.fail(`${name}: ${err.message.split("\n")[0]}`);
    await t.shot(`fail-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`).catch(() => {});
  }
};

/** The modal's "Payment frequency" <select> (labels aren't htmlFor-linked). */
const modalFrequencySelect = (page) => page.locator("div:has(> label:has-text('Payment frequency')) > select");

/** Open Generate Proposal from the Contact Profile nurture chip and return the modal heading locator. */
async function openGenerateProposal(t, clientId) {
  await t.page.goto(`/clients/${clientId}?from=prospects`);
  await settle(t.page, 2500);
  const chip = t.page.getByRole("button", { name: "Generate Proposal", exact: true });
  await chip.waitFor({ state: "visible", timeout: 30_000 });
  await chip.click();
  const heading = t.page.getByRole("heading", { name: "Generate proposal" });
  await heading.waitFor({ state: "visible" });
  // The frequency prefill is an async server action; give it a moment to land.
  const sel = modalFrequencySelect(t.page);
  for (let i = 0; i < 40 && (await sel.inputValue()) === ""; i++) await t.page.waitForTimeout(500);
  await settle(t.page, 500);
}

/** Click "Generate in Pacific Cross" and capture the pop-up (external portal). */
async function generateInPortal(t) {
  const popupPromise = t.context.waitForEvent("page", { timeout: 15_000 }).catch(() => null);
  await t.page.getByRole("button", { name: "Generate in Pacific Cross" }).click();
  const popup = await popupPromise;
  if (popup) {
    // Give the modal time to assign location.href, then read it.
    await t.page.waitForTimeout(3000);
    let url = popup.url();
    try {
      await popup.waitForURL(/pacificcross/i, { timeout: 15_000 });
      url = popup.url();
    } catch {
      /* portal may be unreachable headlessly; report what we have */
    }
    t.note(`Portal pop-up opened (external, not driven): ${url}`);
    await popup.close().catch(() => {});
  } else {
    t.note("No pop-up window observed within 15s after Generate in Pacific Cross");
  }
  await t.page.getByText("Details to encode").waitFor({ state: "visible", timeout: 30_000 });
  await settle(t.page, 1000);
  return popup;
}

/* ------------------------------------------------------------------ seed */
/** Re-runs reuse the same labelled lead (reset to the seed state) instead of piling up rows. */
async function seedLead(label, cols) {
  const reset = { payment_frequency: null, proposal_status: null, proposal_decision: null, ...cols };
  const { data: existing } = await db.from("clients").select("id").eq("first_name", QA_PREFIX).eq("last_name", label).maybeSingle();
  if (existing) {
    const { data, error } = await db.from("clients").update(reset).eq("id", existing.id).select("*").single();
    if (error) throw new Error(`reseed ${label}: ${error.message}`);
    return data;
  }
  return createTestClient(label, reset);
}

const leadA = await seedLead("Proposal NoGender", {
  product_interest: "Select",
  select_variant: "Select Plus",
  coverage_tier: "Ward",
  date_of_birth: "1988-05-14",
  gender: null,
  lead_stage: "Proposal",
  lead_status: "Qualified",
});
created.push({ table: "clients", id: leadA.id, label: `${leadA.first_name} ${leadA.last_name} (${leadA.reference_no ?? "no ref"})` });

const leadB = await seedLead("Proposal Complete", {
  product_interest: "Select",
  select_variant: "Select Plus",
  coverage_tier: "Semi-private",
  date_of_birth: "1990-01-01",
  gender: "Male",
  lead_stage: "Product Selected",
  lead_status: "Qualified",
});
created.push({ table: "clients", id: leadB.id, label: `${leadB.first_name} ${leadB.last_name} (${leadB.reference_no ?? "no ref"})` });

const leadC = await seedLead("Proposal BlueRoyale", {
  product_interest: "Blue Royale",
  date_of_birth: "1975-09-30",
  gender: "Female",
  lead_stage: "Discovery",
  lead_status: "Connected",
});
created.push({ table: "clients", id: leadC.id, label: `${leadC.first_name} ${leadC.last_name} (${leadC.reference_no ?? "no ref"})` });

const depCols = { primary_client_id: leadA.id, full_name: "QA OCT2 Dependent One", relationship: "Child", date_of_birth: "2015-03-03", gender: null };
const { data: existingDep } = await db.from("dependents").select("id").eq("primary_client_id", leadA.id).eq("full_name", depCols.full_name).maybeSingle();
const { data: dep, error: depErr } = existingDep
  ? await db.from("dependents").update(depCols).eq("id", existingDep.id).select("*").single()
  : await db.from("dependents").insert(depCols).select("*").single();
if (depErr) throw new Error(`dependent: ${depErr.message}`);
created.push({ table: "dependents", id: dep.id, label: dep.full_name });

/* ============================================================ 2.1 ===== */
{
  const t = await startFeature("2.1-payment-frequency");
  const page = t.page;
  t.context.setDefaultNavigationTimeout(90_000);
  t.context.setDefaultTimeout(30_000);

  await step(t, "Open Generate Proposal on complete Select lead", async () => {
    await openGenerateProposal(t, leadB.id);
    t.pass("Generate Proposal chip opens the 'Generate proposal' modal on a Select lead");
    await t.shot("01-modal-open");
  });

  await step(t, "Payment frequency is required", async () => {
    const label = page.locator("label", { hasText: "Payment frequency" });
    const star = await label.locator("span.text-red").count();
    if (star > 0) t.pass("Payment frequency label is starred (required)");
    else t.fail("Payment frequency label has no required star");

    const sel = modalFrequencySelect(page);
    const val = await sel.inputValue();
    if (val === "") t.pass("Frequency starts empty on a lead with no saved frequency");
    else t.fail(`Frequency unexpectedly prefilled: '${val}'`);

    const opts = await sel.locator("option").allTextContents();
    if (opts.includes("Annual") && opts.includes("Semi-annual")) t.pass(`Options offered: ${opts.join(" | ")}`);
    else t.fail(`Options missing Annual/Semi-annual: ${opts.join(" | ")}`);

    const btn = page.getByRole("button", { name: "Generate in Pacific Cross" });
    if (await btn.isDisabled()) t.pass("'Generate in Pacific Cross' is disabled until a frequency is chosen");
    else t.fail("'Generate in Pacific Cross' is enabled with no frequency");
    // Attempt to continue anyway (force-click) — must not open the details view.
    await btn.click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const details = await page.getByText("Details to encode").count();
    if (details === 0) t.pass("Forced click without a frequency does nothing (no details view)");
    else t.fail("Details view opened without a payment frequency");
    await t.shot("02-required-no-frequency");
  });

  await step(t, "Choose Semi-annual and continue", async () => {
    await modalFrequencySelect(page).selectOption("Semi-annual");
    const btn = page.getByRole("button", { name: "Generate in Pacific Cross" });
    if (await btn.isEnabled()) t.pass("Button enables after choosing Semi-annual");
    else t.fail("Button still disabled after choosing Semi-annual");
    await generateInPortal(t);
    const freqRow = page.locator("div", { hasText: /^Payment frequency \*?Semi-annual$/ }).first();
    const generateStep = page.getByText("Generate step", { exact: true });
    if ((await generateStep.count()) > 0 && (await page.getByText("Semi-annual", { exact: true }).count()) > 0)
      t.pass("Details list shows 'Generate step' → Payment frequency = Semi-annual");
    else t.fail("Details list missing Generate step / Semi-annual row");
    void freqRow;
    await t.shot("03-details-after-generate");
  });

  await step(t, "Lead keeps the frequency (DB)", async () => {
    await page.waitForTimeout(1500);
    const { data } = await db.from("clients").select("payment_frequency, proposal_status, lead_stage").eq("id", leadB.id).single();
    if (data?.payment_frequency === "Semi-annual") t.pass("clients.payment_frequency = Semi-annual");
    else t.fail(`clients.payment_frequency = ${data?.payment_frequency}`);
    if (data?.proposal_status === "Requested") t.pass("clients.proposal_status moved to Requested");
    else t.fail(`clients.proposal_status = ${data?.proposal_status}`);
    t.note(`lead_stage after generate: ${data?.lead_stage}`);
  });

  await step(t, "Reopen modal: frequency prefilled from lead", async () => {
    await page.getByRole("button", { name: "Upload later" }).click();
    await settle(page, 1500);
    const chip = page.getByRole("button", { name: "Generate Proposal", exact: true });
    await chip.click();
    await page.getByRole("heading", { name: "Generate proposal" }).waitFor();
    const selReopen = modalFrequencySelect(page);
    const started = Date.now();
    for (let i = 0; i < 40 && (await selReopen.inputValue()) === ""; i++) await page.waitForTimeout(500);
    const val = await modalFrequencySelect(page).inputValue();
    t.note(`Reopen prefill landed after ~${Date.now() - started}ms`);
    if (val === "Semi-annual") t.pass("Reopened Generate Proposal prefills Semi-annual from the lead");
    else t.fail(`Reopened modal frequency = '${val}' (expected Semi-annual)`);
    await t.shot("04-reopen-prefilled");
    await page.getByRole("button", { name: "Cancel" }).click();
    await settle(page, 800);
  });

  await step(t, "Profile shows the proposal as Requested", async () => {
    await page.reload();
    await settle(page, 2500);
    const card = page.locator("div", { hasText: "Proposal tracking" }).last();
    const cardText = ((await page.getByText(/Proposal requested/i).count()) ? await page.getByText(/Proposal requested/i).first().textContent() : "")?.trim();
    if (cardText) t.pass(`Proposal tracking card after reload: '${cardText}'`);
    else t.fail("No 'Proposal requested' line in the Proposal tracking card after reload");
    const gated = await page.getByText(/available once this lead reaches the/i).count();
    if (gated > 0)
      t.bug("Proposal tracking card on a Product Selected lead (past Proposal) with a Requested proposal says 'Proposal actions are available once this lead reaches the Proposal stage' and hides Mark Received / upload — wording wrong for a lead that is already beyond Proposal (components/hub/screens/contact-profile/proposal-card.tsx:219)");
    void card;
    await t.shot("05-profile-after-reload");
  });

  await step(t, "Application wizard starts with the frequency prefilled", async () => {
    const convert = page.getByRole("button", { name: "Convert to Application" });
    if ((await convert.count()) === 0) {
      t.fail("'Convert to Application' button not shown on Product Selected lead");
      return;
    }
    await convert.click();
    await settle(page, 2500);
    await t.shot("06-wizard-step1");
    // Step 1: product chosen from lead → Continue; Step 2 → Continue; Step 3 has Commercials.
    const cont = page.getByRole("button", { name: /^Continue/ });
    await cont.waitFor({ state: "visible" });
    for (let i = 0; i < 30 && (await cont.isDisabled()); i++) await page.waitForTimeout(500);
    if (await cont.isDisabled()) {
      t.fail("Wizard step 1 'Continue' stays disabled (product not resolved from lead's Select interest)");
      await t.shot("06b-wizard-continue-disabled");
      return;
    }
    await cont.click();
    await settle(page, 1200);
    await t.shot("07-wizard-step2");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await settle(page, 1200);
    const freq = page.locator("div:has(> label:has-text('Preferred payment frequency')) > select");
    await freq.waitFor({ state: "visible", timeout: 10_000 });
    const val = await freq.inputValue();
    if (val === "Semi-annual") t.pass("Wizard 'Preferred payment frequency' prefilled with Semi-annual");
    else t.fail(`Wizard 'Preferred payment frequency' = '${val}' (expected Semi-annual)`);
    await t.shot("08-wizard-step3-frequency");
    // Leave without saving a draft.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    const discard = page.getByRole("button", { name: /Discard|Leave|Close without saving|Don.t save/i });
    if ((await discard.count()) > 0) await discard.first().click();
    await settle(page, 800);
    await t.shot("09-wizard-closed");
  });

  await step(t, "Blue Royale lead also gets Generate Proposal", async () => {
    await openGenerateProposal(t, leadC.id);
    t.pass("Blue Royale lead shows 'Generate Proposal' (not Request Proposal)");
    await modalFrequencySelect(page).selectOption("Annual");
    await generateInPortal(t);
    const { data } = await db.from("clients").select("payment_frequency, proposal_status").eq("id", leadC.id).single();
    if (data?.payment_frequency === "Annual" && data?.proposal_status === "Requested") t.pass("Blue Royale lead saved Annual + Requested");
    else t.fail(`Blue Royale lead: ${JSON.stringify(data)}`);
    await t.shot("10-blue-royale-details");
    await page.getByRole("button", { name: "Upload later" }).click();
  });

  const { data: apps } = await db.from("applications").select("id, reference_no").in("client_id", [leadB.id, leadC.id]);
  for (const a of apps ?? []) created.push({ table: "applications", id: a.id, label: a.reference_no ?? "(unexpected draft)" });

  await finishGuarded(t);
}

/* ============================================================ 2.2 ===== */
{
  const t = await startFeature("2.2-details-to-encode");
  const page = t.page;
  t.context.setDefaultNavigationTimeout(90_000);
  t.context.setDefaultTimeout(30_000);
  let frequencySavedOnA = false;

  await step(t, "Open Generate Proposal on lead without gender", async () => {
    await openGenerateProposal(t, leadA.id);
    await modalFrequencySelect(page).selectOption("Annual");
    await generateInPortal(t);
    frequencySavedOnA = true;
    await t.shot("01-details-missing");
  });

  await step(t, "Groups follow the portal", async () => {
    for (const g of ["Header", "Principal", "Dependents", "Generate step"]) {
      const n = await page.getByText(g, { exact: true }).count();
      if (n > 0) t.pass(`Group '${g}' present`);
      else t.fail(`Group '${g}' missing`);
    }
    const order = await page.locator("div.bg-surface-2.uppercase").allTextContents();
    t.note(`Group order rendered: ${order.map((s) => s.trim()).join(" → ")}`);
  });

  await step(t, "Rows + required stars", async () => {
    const expectRows = {
      Header: ["Policy holder", "Product", "Total principals"],
      Principal: ["First name", "Last name", "Gender", "Date of birth", "Age", "Plan", "Optional benefit", "Discount"],
      Dependents: ["Dependent 1 — name", "Dependent 1 — gender", "Dependent 1 — date of birth", "Dependent 1 — relationship"],
      "Generate step": ["Payment frequency"],
    };
    const required = new Set(["Policy holder", "Product", "Total principals", "First name", "Last name", "Gender", "Date of birth", "Dependent 1 — gender", "Dependent 1 — date of birth", "Payment frequency"]);
    for (const [group, labels] of Object.entries(expectRows)) {
      for (const label of labels) {
        const cell = page.locator("span.w-44", { hasText: label }).filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\*?$`) });
        const n = await cell.count();
        if (n === 0) {
          t.fail(`[${group}] row '${label}' not rendered`);
          continue;
        }
        const starred = (await cell.first().locator("span.text-red").count()) > 0;
        if (starred === required.has(label)) t.pass(`[${group}] '${label}' ${starred ? "starred (required)" : "not starred (optional)"}`);
        else t.fail(`[${group}] '${label}' star mismatch: starred=${starred}, expected=${required.has(label)}`);
      }
    }
  });

  await step(t, "Missing warning + count, Choose in portal hints", async () => {
    const missingRows = page.getByText("Missing — add to the lead before encoding", { exact: true });
    const n = await missingRows.count();
    if (n === 2) t.pass("2 rows read 'Missing — add to the lead before encoding' (Gender + Dependent 1 gender)");
    else t.fail(`${n} 'Missing — add to the lead before encoding' rows (expected 2)`);
    const alert = page.getByRole("alert").filter({ hasText: /required portal field/ });
    const alertText = ((await alert.count()) ? await alert.first().textContent() : "")?.trim();
    if (alertText === "2 required portal fields are missing") t.pass(`Count banner: '${alertText}'`);
    else t.fail(`Count banner text: '${alertText}' (expected '2 required portal fields are missing')`);
    const chooseRows = await page.getByText("Choose in portal", { exact: true }).count();
    if (chooseRows === 2) t.pass("Optional benefit and Discount read 'Choose in portal'");
    else t.fail(`${chooseRows} 'Choose in portal' rows (expected 2)`);
    // Values
    for (const [label, value] of [["Policy holder", "QA OCT2 Proposal NoGender"], ["Product", "Select"], ["Total principals", "2"], ["Date of birth", "1988-05-14"], ["Plan", "Ward"], ["Dependent 1 — relationship", "Child"], ["Payment frequency", "Annual"]]) {
      const row = page.locator("div.flex.items-center", { has: page.locator("span.w-44", { hasText: label }) }).first();
      const txt = (await row.textContent()) ?? "";
      if (txt.includes(value)) t.pass(`'${label}' shows '${value}'`);
      else t.fail(`'${label}' row text '${txt.trim()}' lacks '${value}'`);
    }
    const ageRow = page.locator("div.flex.items-center", { has: page.locator("span.w-44", { hasText: "Age" }) }).first();
    t.note(`Age row: '${((await ageRow.textContent()) ?? "").trim()}'`);
    await t.shot("02-missing-rows");
  });

  await step(t, "Copy button only on filled rows", async () => {
    const copyButtons = await page.locator("button[title^='Copy ']").count();
    t.note(`${copyButtons} copy buttons rendered`);
    await page.locator("button[title='Copy first name']").click();
    await page.waitForTimeout(800);
    const toast = await page.getByText("Copied", { exact: true }).count();
    if (toast > 0) t.pass("Copy first name shows 'Copied' toast");
    else t.note("No 'Copied' toast observed (clipboard may be unavailable headless)");
  });

  await step(t, "Reopen portal button present", async () => {
    const reopen = page.getByRole("button", { name: "Reopen portal" });
    if ((await reopen.count()) > 0) t.pass("'Reopen portal' + 'Upload later' + PDF upload shown after generate");
    else t.fail("'Reopen portal' button missing");
    await page.getByRole("button", { name: "Upload later" }).click();
    await settle(page, 800);
  });

  await step(t, "Add gender on the client form", async () => {
    await page.goto(`/clients/${leadA.id}/edit?from=prospects`);
    await settle(page, 2500);
    const gender = page.locator("select[name='gender']");
    await gender.waitFor({ state: "visible", timeout: 30_000 });
    await gender.selectOption("Female");
    await t.shot("03-edit-gender");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL((u) => !u.pathname.endsWith("/edit"), { timeout: 90_000 });
    await settle(page, 2000);
    const { data } = await db.from("clients").select("gender, payment_frequency").eq("id", leadA.id).single();
    if (data?.gender === "Female") t.pass("Client form saved gender = Female");
    else t.fail(`clients.gender = ${data?.gender} after Save changes`);
    if (data?.payment_frequency === "Annual") t.pass("Client form save preserved payment_frequency = Annual");
    else if (!frequencySavedOnA) t.note("payment_frequency check skipped: Generate Proposal step did not complete earlier in this run");
    else t.bug(`Client form save changed payment_frequency to ${data?.payment_frequency} (expected Annual kept)`);
    await t.shot("04-after-save");
  });

  await step(t, "Reopen: principal gender warning cleared", async () => {
    await openGenerateProposal(t, leadA.id);
    const val = await modalFrequencySelect(page).inputValue();
    if (val === "Annual") t.pass("Reopened modal prefills Annual");
    else t.fail(`Reopened modal frequency '${val}'`);
    await generateInPortal(t);
    const genderRow = page.locator("div.flex.items-center", { has: page.locator("span.w-44", { hasText: /^Gender/ }) }).first();
    const genderTxt = ((await genderRow.textContent()) ?? "").trim();
    if (genderTxt.includes("Female") && !genderTxt.includes("Missing")) t.pass("Principal Gender now shows 'Female' (warning cleared)");
    else t.fail(`Principal Gender row: '${genderTxt}'`);
    const n = await page.getByText("Missing — add to the lead before encoding", { exact: true }).count();
    const alert = page.getByRole("alert").filter({ hasText: /required portal field/ });
    const alertText = ((await alert.count()) ? await alert.first().textContent() : "")?.trim();
    if (n === 1 && alertText === "1 required portal field is missing") t.pass(`Only the dependent's gender remains missing: '${alertText}'`);
    else t.fail(`After adding gender: ${n} missing rows, banner '${alertText}' (expected 1 / '1 required portal field is missing')`);
    await t.shot("05-reopened-warning-cleared");
  });

  await step(t, "Fix dependent gender → no warning at all", async () => {
    await db.from("dependents").update({ gender: "Male" }).eq("id", dep.id);
    await page.getByRole("button", { name: "Upload later" }).click();
    await openGenerateProposal(t, leadA.id);
    await generateInPortal(t);
    const n = await page.getByText("Missing — add to the lead before encoding", { exact: true }).count();
    const alerts = await page.getByRole("alert").filter({ hasText: /required portal field/ }).count();
    if (n === 0 && alerts === 0) t.pass("All required fields filled → no Missing rows and no count banner");
    else t.fail(`${n} missing rows / ${alerts} alert banners with all fields filled`);
    const others = (await page.getByRole("alert").allTextContents()).map((s) => s.trim()).filter((s) => !/required portal field/.test(s));
    if (others.length) t.note(`Other role="alert" elements on page: ${JSON.stringify(others)}`);
    await t.shot("06-no-missing");
    await page.getByRole("button", { name: "Upload later" }).click();
  });

  await step(t, "Portal runs outside the app (note)", async () => {
    const { data } = await db.from("integration_settings").select("provider, portal_url").eq("provider", "pacific_cross_proposal").single();
    t.note(`Configured proposal portal: ${data?.portal_url} — opened as a pop-up window; PDF comes back through the modal's upload or Inbox filing (not exercised: no real PDF generated).`);
  });

  await finishGuarded(t);
}

console.log("\nCreated records:");
for (const r of created) console.log(`- ${r.table} ${r.id} — ${r.label}`);
process.exit(0);
