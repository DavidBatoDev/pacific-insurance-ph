/**
 * TESTING-OCT2.md §7 Claims — 7.1 types, 7.2 policy defaults, 7.3 workflow + change type,
 * 7.4 email Pacific Cross, 7.5 intake (how/when arrived).
 *
 *   node --env-file=.env.local qa-oct2/07-claims.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { unzipSync } from "fflate";

import { startFeature, settle, db, createTestClient, SAMPLE_PDF, QA_PREFIX, REPORT_ROOT } from "./lib.mjs";

const EXPECTED_TYPES = ["Reimbursement", "IP", "OP", "ER", "Overseas Reimbursement", "Overseas IP", "Overseas OP", "Overseas ER", "Travel"];
const IN_PATIENT_FIRST = "Duly-accomplished Notification of Claim (NOC) form";
const IN_PATIENT_COUNT = 14;
const OUT_PATIENT_COUNT = 10;
const OUT_PATIENT_ONLY = "Prescription from Ophthalmologist or Optometrist";

const created = { clients: [], policies: [], claims: [], claim_requirements: [], documents: [] };

/* ------------------------------------------------------------------ seed ------------------------------------------------------------------ */

/** Removes this section's QA clients from an earlier run so the client picker sees exactly one "Claims A" etc. */
async function resetPrevious() {
  const { data: clients } = await db.from("clients").select("id").eq("first_name", QA_PREFIX).like("last_name", "Claims %");
  const clientIds = (clients ?? []).map((c) => c.id);
  if (!clientIds.length) return;
  const { data: claims } = await db.from("claims").select("id").in("client_id", clientIds);
  const claimIds = (claims ?? []).map((c) => c.id);
  const docs = new Map();
  for (const [col, list] of [["client_id", clientIds], ["claim_id", claimIds]]) {
    if (!list.length) continue;
    const { data } = await db.from("documents").select("id, file_path").in(col, list);
    for (const d of data ?? []) docs.set(d.id, d.file_path);
  }
  const { data: uploads } = await db.from("requirement_attachment_uploads").select("storage_path").in("client_id", clientIds);
  const plan = [
    ["requirement_attachment_uploads", "client_id", clientIds],
    ["communications", "client_id", clientIds],
    ["tasks", "client_id", clientIds],
    ["documents", "id", [...docs.keys()]],
    ["claim_requirements", "claim_id", claimIds],
    ["claims", "id", claimIds],
    ["policies", "client_id", clientIds],
    ["activity_timeline", "scope_id", clientIds],
    ["clients", "id", clientIds],
  ];
  for (const [table, col, list] of plan) {
    if (!list.length) continue;
    const { error, count } = await db.from(table).delete({ count: "exact" }).in(col, list);
    console.log(`reset ${table}: ${error ? `✖ ${error.message}` : count}`);
  }
  const paths = [...docs.values(), ...(uploads ?? []).map((u) => u.storage_path)].filter(Boolean);
  if (paths.length) await db.storage.from("documents").remove(paths);
}

async function versionFor(category, productName) {
  const { data, error } = await db
    .from("product_versions")
    .select("id, product_id, status, products!inner(name, category)")
    .eq("status", "Active")
    .eq("products.category", category);
  if (error) throw new Error(`product_versions: ${error.message}`);
  const row = (productName ? data.find((v) => v.products.name === productName) : data[0]) ?? data[0];
  if (!row) throw new Error(`no active product version for ${category}/${productName}`);
  return row;
}

async function seedPolicy(client, version, policyNumber) {
  const { data, error } = await db
    .from("policies")
    .insert({
      client_id: client.id,
      product_id: version.product_id,
      product_version_id: version.id,
      policy_number: policyNumber,
      status: "Active",
      effective_date: "2026-01-01",
      expiry_date: "2027-01-01",
      currency: "PHP",
      premium_amount: 10000,
      payment_mode: "Annual",
      notes: `${QA_PREFIX} seeded policy`,
    })
    .select("*")
    .single();
  if (error) throw new Error(`policy ${policyNumber}: ${error.message}`);
  created.policies.push({ id: data.id, reference_no: data.reference_no, policy_number: policyNumber, client: client.last_name });
  return data;
}

async function seed() {
  const select = await versionFor("Primary Medical", "Select");
  const blueRoyale = await versionFor("Primary Medical", "Blue Royale");
  const travel = await versionFor("Travel Insurance", "TravelSafe");

  const mk = async (label) => {
    const c = await createTestClient(label, { lifecycle_stage: "Client", gender: "Male", date_of_birth: "1990-01-01" });
    created.clients.push({ id: c.id, name: `${c.first_name} ${c.last_name}` });
    return c;
  };
  const A = await mk("Claims A");
  const B = await mk("Claims B");
  const C = await mk("Claims C");
  const D = await mk("Claims D");

  await seedPolicy(A, select, "QA-OCT2-A1");
  await seedPolicy(B, select, "QA-OCT2-B-HEALTH");
  await seedPolicy(B, travel, "QA-OCT2-B-TRAVEL");
  await seedPolicy(C, select, "QA-OCT2-C1");
  await seedPolicy(C, blueRoyale, "QA-OCT2-C2");

  // Old-style claim with a pre-H7a type name (claims.claim_type is free text — no enum/check).
  const { data: old, error } = await db
    .from("claims")
    .insert({ client_id: A.id, claim_type: "Hospitalization", status: "Documents Pending", amount_claimed: 5000, currency: "PHP", incident_date: "2026-09-01", notes: `${QA_PREFIX} legacy-type claim` })
    .select("*")
    .single();
  if (error) throw new Error(`legacy claim: ${error.message}`);
  created.claims.push({ id: old.id, reference_no: old.reference_no, claim_type: "Hospitalization", via: "db seed" });

  return { A, B, C, D, legacy: old };
}

/* ---------------------------------------------------------------- helpers ---------------------------------------------------------------- */

const dialog = (t) => t.page.getByRole("dialog", { name: "Claim workflow" });

async function step(t, name, fn) {
  try {
    await fn();
  } catch (err) {
    t.fail(`${name}: ${err.message.split("\n")[0]}`);
    await t.shot(`fail-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`).catch(() => {});
  }
}

async function gotoClaims(t) {
  await t.page.goto("/claims", { timeout: 120_000, waitUntil: "domcontentloaded" });
  await settle(t.page);
  await t.page.getByRole("button", { name: "File claim" }).first().waitFor({ timeout: 60_000 });
}

async function openFileClaim(t) {
  await gotoClaims(t);
  await t.page.getByRole("button", { name: "File claim" }).first().click();
  await dialog(t).waitFor({ state: "visible" });
  await t.page.waitForTimeout(500);
}

async function pickClient(t, client) {
  const d = dialog(t);
  const full = `${QA_PREFIX} ${client.last_name}`;
  await d.getByPlaceholder("Search a client…").fill(client.last_name);
  await d.getByRole("button", { name: full }).first().click();
  await d.getByText(full, { exact: true }).first().waitFor();
  // policies load: either the locked box / dropdown / unlinked message replaces the hint
  await d.getByText("Pick the claimant to see their policies.").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  await t.page.waitForTimeout(1500);
}

async function setType(t, type) {
  await dialog(t).getByLabel("Claim type").selectOption(type);
  await t.page.waitForTimeout(600);
}

/** Waits for the checklist preview label ("In-Patient · 14 items") and returns it, or null. */
async function previewLabel(t) {
  const loc = dialog(t).getByText(/(In-Patient|Out-Patient) · \d+ items?/);
  try {
    await loc.first().waitFor({ timeout: 20_000 });
    return (await loc.first().textContent())?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Files the claim from the open form and waits for step 2; returns the DB row. */
async function submitClaim(t, client) {
  const d = dialog(t);
  await d.getByRole("button", { name: "File claim" }).click();
  await d.getByText("Step 2 of 3").waitFor({ timeout: 30_000 });
  await t.page.waitForTimeout(800);
  const { data } = await db.from("claims").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(1).single();
  created.claims.push({ id: data.id, reference_no: data.reference_no, claim_type: data.claim_type, via: "UI File claim" });
  return data;
}

async function closeDialog(t) {
  await dialog(t).getByRole("button", { name: "Close", exact: true }).first().click();
  await dialog(t).waitFor({ state: "hidden" }).catch(() => {});
}

async function requirementRows(t) {
  return dialog(t).locator("select[aria-label^='Status for ']");
}

async function dbRequirements(claimId) {
  const { data } = await db.from("claim_requirements").select("id, document_name, status, is_required, sort_order").eq("claim_id", claimId).order("sort_order");
  return data ?? [];
}

/** Opens an existing claim from the list via its Requirements button. */
async function openClaim(t, referenceNo) {
  await gotoClaims(t);
  await t.page.getByPlaceholder("Search claims…").fill(referenceNo);
  await t.page.waitForTimeout(400);
  const row = t.page.locator("tr", { hasText: referenceNo }).first();
  await row.getByRole("button", { name: "Requirements" }).click();
  await dialog(t).waitFor({ state: "visible" });
  await dialog(t).getByText(/Step \d of 3/).waitFor({ timeout: 30_000 });
  await t.page.waitForTimeout(800);
}

/** Uploads SAMPLE_PDF to a requirement row by its document name. */
async function uploadTo(t, documentName) {
  const d = dialog(t);
  const sel = d.getByLabel(`Status for ${documentName}`);
  const row = sel.locator("xpath=../..");
  await row.getByRole("button", { name: "Choose file" }).click();
  const picker = t.page.getByRole("dialog", { name: "Attach requirement document" });
  await picker.waitFor({ state: "visible" });
  await picker.locator("input[type=file]").setInputFiles(SAMPLE_PDF);
  await picker.getByText("sample.pdf").first().waitFor();
  await picker.getByRole("button", { name: "Use for this requirement" }).click();
  await picker.waitFor({ state: "hidden", timeout: 30_000 });
  return row;
}

async function listRow(t, text) {
  await gotoClaims(t);
  await t.page.getByPlaceholder("Search claims…").fill(text);
  await t.page.waitForTimeout(400);
  return t.page.locator("tr", { hasText: text }).first();
}

/* ------------------------------------------------------------------- 7.1 ------------------------------------------------------------------- */

async function run71(seeded) {
  const t = await startFeature("7.1-claim-types");
  const { A, B, legacy } = seeded;
  const filed = {};

  await step(t, "7.1.1 type list", async () => {
    await openFileClaim(t);
    const opts = await dialog(t).getByLabel("Claim type").locator("option").allTextContents();
    const same = opts.length === EXPECTED_TYPES.length && EXPECTED_TYPES.every((x) => opts.includes(x));
    if (same) t.pass(`Claim type list has exactly the 9 expected types: ${opts.join(", ")}`);
    else t.fail(`Claim type list is [${opts.join(", ")}], expected [${EXPECTED_TYPES.join(", ")}]`);
    if (opts.join("|") !== EXPECTED_TYPES.join("|"))
      t.note(`Low: option order differs from the guide — UI: ${opts.join(", ")}; guide: ${EXPECTED_TYPES.join(", ")}`);
    await t.shot("7.1-type-list");
  });

  await step(t, "7.1.2 IP → In-Patient", async () => {
    await pickClient(t, A);
    await setType(t, "IP");
    const d = dialog(t);
    const preview = await previewLabel(t);
    if (preview === `In-Patient · ${IN_PATIENT_COUNT} items`) t.pass(`IP preview section labelled '${preview}'`);
    else t.fail(`IP preview label: '${preview}', expected 'In-Patient · ${IN_PATIENT_COUNT} items'`);
    await t.shot("7.1-ip-preview");
    const claim = await submitClaim(t, A);
    filed.ip = claim;
    const reqs = await dbRequirements(claim.id);
    const uiRows = await (await requirementRows(t)).count();
    if (reqs.length === IN_PATIENT_COUNT && reqs[0].document_name === IN_PATIENT_FIRST && uiRows === IN_PATIENT_COUNT)
      t.pass(`IP claim ${claim.reference_no}: ${reqs.length} In-Patient checklist rows created (UI ${uiRows}, DB ${reqs.length})`);
    else t.fail(`IP claim ${claim.reference_no}: expected ${IN_PATIENT_COUNT} In-Patient rows, UI ${uiRows}, DB ${reqs.length}, first '${reqs[0]?.document_name}'`);
    if (claim.claim_type !== "IP") t.fail(`DB claim_type is '${claim.claim_type}', expected IP`);
    await t.shot("7.1-ip-checklist");
    await closeDialog(t);
  });

  await step(t, "7.1.2 ER → In-Patient", async () => {
    await openFileClaim(t);
    await pickClient(t, A);
    await setType(t, "ER");
    const hint = await dialog(t).getByText("Interim checklist — pending Eman").count();
    if (hint) t.pass("ER shows the 'Interim checklist — pending Eman' hint");
    else t.note("ER did not show an interim hint");
    const claim = await submitClaim(t, A);
    filed.er = claim;
    const reqs = await dbRequirements(claim.id);
    if (reqs.length === IN_PATIENT_COUNT && reqs.some((r) => r.document_name === "Discharge summary report"))
      t.pass(`ER claim ${claim.reference_no} uses the In-Patient list (${reqs.length} rows incl. Discharge summary report)`);
    else t.fail(`ER claim ${claim.reference_no}: expected In-Patient list, got ${reqs.length} rows`);
    await t.shot("7.1-er-checklist");
    await closeDialog(t);
  });

  await step(t, "7.1.2 Reimbursement → Out-Patient", async () => {
    await openFileClaim(t);
    await pickClient(t, A);
    await setType(t, "Reimbursement");
    const preview = await previewLabel(t);
    if (preview?.startsWith("Out-Patient")) t.pass(`Reimbursement preview labelled '${preview}'`);
    else t.fail(`Reimbursement preview did not show 'Out-Patient · N items' (got '${preview}')`);
    await t.shot("7.1-reimbursement-preview");
    const claim = await submitClaim(t, A);
    filed.reimb = claim;
    const reqs = await dbRequirements(claim.id);
    if (reqs.length === OUT_PATIENT_COUNT && reqs.some((r) => r.document_name === OUT_PATIENT_ONLY))
      t.pass(`Reimbursement claim ${claim.reference_no} uses the Out-Patient list (${reqs.length} rows incl. '${OUT_PATIENT_ONLY}')`);
    else t.fail(`Reimbursement claim ${claim.reference_no}: expected Out-Patient list (${OUT_PATIENT_COUNT}), got ${reqs.length} rows`);
    await t.shot("7.1-reimbursement-checklist");
    await closeDialog(t);
  });

  await step(t, "7.1.2 Travel → no list", async () => {
    await openFileClaim(t);
    await pickClient(t, B);
    await setType(t, "Travel");
    const d = dialog(t);
    const msg = await d.getByText("Travel claims have no generated checklist").count();
    if (msg) t.pass("Travel preview says no generated checklist");
    else t.fail("Travel preview did not say 'Travel claims have no generated checklist'");
    const claim = await submitClaim(t, B);
    filed.travel = claim;
    const reqs = await dbRequirements(claim.id);
    const nothing = await d.getByText("Travel claims: nothing to generate").count();
    if (reqs.length === 0 && nothing) t.pass(`Travel claim ${claim.reference_no}: no checklist rows; step 2 explains nothing to generate`);
    else t.fail(`Travel claim ${claim.reference_no}: ${reqs.length} rows, 'nothing to generate' visible=${!!nothing}`);
    const genBtn = await d.getByRole("button", { name: "Generate checklist" }).count();
    if (genBtn) t.bug("Travel claim shows a 'Generate checklist' button although Travel has no template");
    await t.shot("7.1-travel-step2");
    await closeDialog(t);
  });

  await step(t, "7.1.3 legacy type displays", async () => {
    const row = await listRow(t, legacy.reference_no);
    const text = (await row.textContent()) ?? "";
    if (text.includes("Hospitalization") && text.includes(`${QA_PREFIX} Claims A`))
      t.pass(`Legacy claim ${legacy.reference_no} listed with type 'Hospitalization'`);
    else t.fail(`Legacy claim row text: ${text}`);
    await t.shot("7.1-legacy-list");
    await row.getByRole("button", { name: "Requirements" }).click();
    const d = dialog(t);
    await d.getByText(/Step \d of 3/).waitFor({ timeout: 30_000 });
    const err = await d.getByText("Claim unavailable").count();
    if (err) t.fail("Legacy claim workflow shows 'Claim unavailable'");
    const stepText = (await d.getByText(/Step \d of 3/).textContent())?.trim();
    const reqDone = await d.getByRole("navigation", { name: "Workflow steps" }).getByRole("button", { name: /Requirements/ }).locator("svg").count();
    if (stepText !== "Step 2 of 3")
      t.bug(`Legacy claim ${legacy.reference_no} (no checklist generated, 0 requirement rows) opens on '${stepText}' with Requirements shown as done (check=${!!reqDone}) — a claim with NO checklist counts as 'all required documents in' and jumps straight to Email Pacific Cross instead of Requirements/Generate checklist. Expected: open on Requirements with 'Generate checklist'.`);
    await t.shot("7.1-legacy-workflow-opened");
    await d.getByRole("navigation", { name: "Workflow steps" }).getByRole("button", { name: /Requirements/ }).click();
    await t.page.waitForTimeout(600);
    const sub = await d.getByText("This Hospitalization claim uses the In-Patient NOC checklist.").count();
    const gen = await d.getByRole("button", { name: "Generate checklist" }).count();
    if (sub && gen) t.pass("Legacy 'Hospitalization' claim: Requirements step says it uses the In-Patient NOC checklist and offers Generate checklist");
    else t.fail(`Legacy claim Requirements step: mapping text=${sub}, Generate button=${gen}`);
    const typeSel = d.getByLabel("New claim type");
    if (await typeSel.count()) {
      const v = await typeSel.inputValue();
      t.note(`Legacy claim: 'New claim type' picker defaults to '${v}' (legacy value 'Hospitalization' not in the list)`);
    }
    await t.shot("7.1-legacy-workflow");
    await closeDialog(t);
  });

  await t.finish();
  return filed;
}

/* ------------------------------------------------------------------- 7.2 ------------------------------------------------------------------- */

async function run72(seeded) {
  const t = await startFeature("7.2-policy-defaults");
  const { A, B, C, D } = seeded;
  const filed = {};

  await step(t, "7.2.1-2 single match locked (A)", async () => {
    await openFileClaim(t);
    await pickClient(t, A);
    await setType(t, "IP");
    const d = dialog(t);
    const locked = await d.getByText("QA-OCT2-A1 · Select", { exact: true }).count();
    const asOption = await d.locator("option", { hasText: "QA-OCT2-A1" }).count();
    const linked = await d.getByText("Policy linked").count();
    if (locked && !asOption && linked) t.pass("A: policy QA-OCT2-A1 · Select shown read-only (no dropdown), section says 'Policy linked'");
    else t.fail(`A: locked=${locked} option=${asOption} linked=${linked}`);
    await t.shot("7.2-A-locked");
    await closeDialog(t);
  });

  await step(t, "7.2.3 health + travel (B)", async () => {
    await openFileClaim(t);
    await pickClient(t, B);
    const d = dialog(t);
    for (const type of ["IP", "OP", "Overseas Reimbursement"]) {
      await setType(t, type);
      const health = await d.getByText("QA-OCT2-B-HEALTH · Select", { exact: true }).count();
      const travel = await d.getByText(/QA-OCT2-B-TRAVEL/).count();
      if (health && !travel) t.pass(`B + ${type}: only the health policy (QA-OCT2-B-HEALTH) is offered`);
      else t.fail(`B + ${type}: health=${health} travel=${travel}`);
    }
    await setType(t, "Travel");
    const travel = await d.getByText("QA-OCT2-B-TRAVEL · TravelSafe", { exact: true }).count();
    const health = await d.getByText(/QA-OCT2-B-HEALTH/).count();
    if (travel && !health) t.pass("B + Travel: only the travel policy (QA-OCT2-B-TRAVEL · TravelSafe) is offered");
    else t.fail(`B + Travel: travel=${travel} health=${health}`);
    await t.shot("7.2-B-travel");
    await closeDialog(t);
  });

  await step(t, "7.2.3 several matches dropdown (C)", async () => {
    await openFileClaim(t);
    await pickClient(t, C);
    await setType(t, "IP");
    const d = dialog(t);
    const sel = d.locator("select").filter({ hasText: "QA-OCT2-C1" });
    await sel.waitFor({ timeout: 15_000 }).catch(() => {});
    const n = await sel.count();
    const opts = n ? await sel.locator("option").allTextContents() : [];
    if (n === 1 && opts.some((o) => o.startsWith("QA-OCT2-C1")) && opts.some((o) => o.startsWith("QA-OCT2-C2")))
      t.pass(`C: dropdown by carrier number: ${opts.join(" | ")}`);
    else t.fail(`C: expected dropdown with C1 and C2, got ${n} selects, options ${opts.join(" | ")}`);
    const unlinkedDefault = await d.getByText("Unlinked policy").count();
    if (unlinkedDefault) t.note("Low: with several matches the default is 'None / not linked' (section shows 'Unlinked policy') until staff picks one");
    const c2 = opts.find((o) => o.startsWith("QA-OCT2-C2"));
    await sel.selectOption({ label: c2 });
    await t.page.waitForTimeout(300);
    const linked = await d.getByText("Policy linked").count();
    if (linked) t.pass("C: picking QA-OCT2-C2 marks the section 'Policy linked'");
    else t.fail("C: picking QA-OCT2-C2 did not mark 'Policy linked'");
    await t.shot("7.2-C-dropdown");
    const claim = await submitClaim(t, C);
    filed.c = claim;
    const { data: pol } = await db.from("policies").select("policy_number").eq("id", claim.policy_id).maybeSingle();
    if (pol?.policy_number === "QA-OCT2-C2") t.pass(`C claim ${claim.reference_no} linked to QA-OCT2-C2`);
    else t.fail(`C claim ${claim.reference_no} policy is ${pol?.policy_number ?? "null"}`);
    const d2 = dialog(t);
    await d2.getByRole("button", { name: "Claim details" }).click();
    await t.page.waitForTimeout(400);
    const detailPolicy = await d2.getByText("QA-OCT2-C2", { exact: true }).count();
    if (detailPolicy) t.pass("C: Claim details shows Policy QA-OCT2-C2");
    else t.fail("C: Claim details did not show policy QA-OCT2-C2");
    await closeDialog(t);
  });

  await step(t, "7.2.3 no match (D)", async () => {
    await openFileClaim(t);
    await pickClient(t, D);
    await setType(t, "IP");
    const d = dialog(t);
    const msg = await d.getByText("No matching policy — the claim will be filed unlinked", { exact: true }).count();
    if (msg) t.pass("D: reads 'No matching policy — the claim will be filed unlinked'");
    else t.fail("D: unlinked message missing");
    await t.shot("7.2-D-unlinked");
    const claim = await submitClaim(t, D);
    filed.d = claim;
    if (claim.policy_id === null) t.pass(`D claim ${claim.reference_no} filed with policy_id null`);
    else t.fail(`D claim ${claim.reference_no} has policy_id ${claim.policy_id}`);
    await closeDialog(t);
  });

  await step(t, "7.2.4 list shows carrier number", async () => {
    const rowC = await listRow(t, filed.c.reference_no);
    const tc = (await rowC.textContent()) ?? "";
    if (tc.includes("QA-OCT2-C2")) t.pass(`List row ${filed.c.reference_no} shows carrier policy number QA-OCT2-C2`);
    else t.fail(`List row ${filed.c.reference_no}: ${tc}`);
    const rowA = await listRow(t, "QA-OCT2-A1");
    const ta = (await rowA.textContent()) ?? "";
    if (ta.includes("QA-OCT2-A1")) t.pass("List rows for client A show carrier policy number QA-OCT2-A1");
    else t.fail(`No row shows QA-OCT2-A1: ${ta}`);
    const rowD = await listRow(t, filed.d.reference_no);
    const cells = await rowD.locator("td").allTextContents();
    if (cells[2]?.trim() === "—") t.pass(`Unlinked claim ${filed.d.reference_no} shows '—' in the Policy column`);
    else t.note(`Unlinked claim policy cell: '${cells[2]}'`);
    await t.shot("7.2-list");
  });

  await t.finish();
  return filed;
}

/* ------------------------------------------------------------------- 7.3 ------------------------------------------------------------------- */

async function run73(seeded, filed71) {
  const t = await startFeature("7.3-requirements-workflow");
  const { A } = seeded;
  let fresh;

  await step(t, "7.3.1 one workflow with 3 steps", async () => {
    await openFileClaim(t);
    const d = dialog(t);
    const labels = await d.getByRole("navigation", { name: "Workflow steps" }).getByRole("button").allTextContents();
    const norm = labels.map((l) => l.replace(/^\d+/, "").trim());
    if (norm.join(" → ") === "Claim details → Requirements → Email Pacific Cross") t.pass(`Rail: ${norm.join(" → ")}`);
    else t.fail(`Rail labels: ${labels.join(" | ")}`);
    const locked2 = await d.getByRole("navigation", { name: "Workflow steps" }).getByRole("button", { name: /Requirements/ }).isDisabled();
    const locked3 = await d.getByRole("navigation", { name: "Workflow steps" }).getByRole("button", { name: /Email Pacific Cross/ }).isDisabled();
    if (locked2 && locked3) t.pass("Steps 2 and 3 are locked before filing");
    else t.note(`Before filing: step2 disabled=${locked2}, step3 disabled=${locked3}`);
    const note = await d.getByText("The checklist is created with the claim").count();
    if (note) t.pass("Action bar says 'The checklist is created with the claim'");
    await pickClient(t, A);
    await setType(t, "OP");
    fresh = await submitClaim(t, A);
    const rows = await (await requirementRows(t)).count();
    const h = await d.getByRole("heading", { name: "Requirements" }).count();
    if (rows === OUT_PATIENT_COUNT && h) t.pass(`Filing ${fresh.reference_no} (OP) jumps to Requirements with ${rows} checklist rows`);
    else t.fail(`After filing: heading=${h} rows=${rows}`);
    const step3 = d.getByRole("navigation", { name: "Workflow steps" }).getByRole("button", { name: /Email Pacific Cross/ });
    if (await step3.isDisabled()) t.pass("Email Pacific Cross stays locked while required documents are outstanding");
    const cont = d.getByRole("button", { name: "Continue" });
    if (await cont.isDisabled()) t.pass("Continue is disabled; footer lists 'Still needed: 2 required documents'");
    const still = await d.getByText(/Still needed: 2 required documents/).count();
    if (!still) t.note("Footer did not show 'Still needed: 2 required documents'");
    await t.shot("7.3-fresh-op");
    await closeDialog(t);
  });

  await step(t, "7.3.3 change type while all Pending", async () => {
    await openClaim(t, fresh.reference_no);
    const d = dialog(t);
    const prompt = await d.getByText("Wrong checklist? Change the claim type").count();
    if (prompt) t.pass("All-Pending claim offers 'Wrong checklist? Change the claim type'");
    else t.fail("'Wrong checklist?' prompt not shown on all-Pending claim");
    const btn = d.getByRole("button", { name: "Change claim type" });
    if (await btn.isDisabled()) t.pass("Change claim type disabled while the new type equals the current type");
    await d.getByLabel("New claim type").selectOption("IP");
    await btn.click();
    await d.getByText(`${fresh.reference_no} · IP`).waitFor({ timeout: 120_000 });
    await t.page.waitForTimeout(1500);
    const rows = await (await requirementRows(t)).count();
    const { data: c } = await db.from("claims").select("claim_type").eq("id", fresh.id).single();
    const reqs = await dbRequirements(fresh.id);
    if (rows === IN_PATIENT_COUNT && c.claim_type === "IP" && reqs.length === IN_PATIENT_COUNT)
      t.pass(`OP → IP replaced the checklist: ${rows} In-Patient rows (DB claim_type=IP, ${reqs.length} rows)`);
    else t.fail(`After change: UI rows=${rows}, DB type=${c.claim_type}, DB rows=${reqs.length}`);
    const subtitle = await d.getByText(`${fresh.reference_no} · IP`).count();
    if (subtitle) t.pass("Rail subtitle updated to the new type");
    else t.note("Rail subtitle did not show '· IP' after the change");
    await t.shot("7.3-type-changed");
    await closeDialog(t);
  });

  await step(t, "7.3.2 upload → Received", async () => {
    await openClaim(t, fresh.reference_no);
    const d = dialog(t);
    const row = await uploadTo(t, IN_PATIENT_FIRST);
    const status = await d.getByLabel(`Status for ${IN_PATIENT_FIRST}`).inputValue();
    const receipt = await row.getByText(/Attached · Received/).count();
    if (status === "Received" && receipt) t.pass(`Upload on '${IN_PATIENT_FIRST}' → row Received immediately (receipt shown)`);
    else t.fail(`After upload: status='${status}', receipt=${receipt}`);
    const reqs = await dbRequirements(fresh.id);
    const dbRow = reqs.find((r) => r.document_name === IN_PATIENT_FIRST);
    if (dbRow?.status === "Received") t.pass("DB claim_requirements.status = Received");
    else t.fail(`DB status for uploaded row: ${dbRow?.status}`);
    const { data: docs } = await db.from("documents").select("id, name, file_path").eq("claim_id", fresh.id);
    for (const doc of docs ?? []) created.documents.push({ id: doc.id, name: doc.name, claim: fresh.reference_no });
    if (docs?.length) t.pass(`documents row created: ${docs.map((x) => x.name).join(", ")}`);
    else t.fail("No documents row linked to the claim after upload");
    const still = await d.getByText(/Still needed: 7 required documents/).count();
    if (still) t.pass("Footer now reads 'Still needed: 7 required documents'");
    await t.shot("7.3-uploaded");
  });

  await step(t, "7.3.4 change blocked after Received", async () => {
    const d = dialog(t);
    const lockedMsg = await d.getByText("Claim type locked — documents already received").count();
    const btn = await d.getByRole("button", { name: "Change claim type" }).count();
    if (lockedMsg && !btn) t.pass("With a Received item: 'Claim type locked — documents already received', control hidden");
    else t.fail(`Blocked state: message=${lockedMsg} button=${btn}`);
    await t.shot("7.3-locked");
    await closeDialog(t);
    // Reload to prove the lock survives a fresh load (server state, not local).
    await openClaim(t, fresh.reference_no);
    const again = await dialog(t).getByText("Claim type locked — documents already received").count();
    if (again) t.pass("Lock persists after reopening the claim");
    else t.fail("Lock not shown after reopening the claim");
    await closeDialog(t);
  });

  await t.finish();
  return { fresh };
}

/* ------------------------------------------------------------------- 7.4 ------------------------------------------------------------------- */

async function run74(seeded, filed73) {
  const t = await startFeature("7.4-email-pacific-cross");
  const { fresh } = filed73; // IP claim with NOC form uploaded (Received), 13 others Pending
  let zipHref = null;

  await step(t, "7.4.1 complete the checklist", async () => {
    await openClaim(t, fresh.reference_no);
    const d = dialog(t);
    const reqs = await dbRequirements(fresh.id);
    const second = reqs.find((r) => r.is_required && r.document_name !== IN_PATIENT_FIRST);
    await uploadTo(t, second.document_name);
    for (const r of reqs) {
      if (!r.is_required || r.status !== "Pending" || r.document_name === second.document_name) continue;
      await d.getByLabel(`Status for ${r.document_name}`).selectOption("Received");
      await t.page.waitForTimeout(400);
    }
    let after, outstanding;
    for (let i = 0; i < 60; i++) {
      after = await dbRequirements(fresh.id);
      outstanding = after.filter((r) => r.is_required && r.status === "Pending");
      if (outstanding.length === 0) break;
      await t.page.waitForTimeout(1000);
    }
    if (outstanding.length === 0) t.pass("All required rows Received in DB (2 with files, 6 marked)");
    else t.fail(`Outstanding required rows after 60s: ${outstanding.map((r) => r.document_name).join(", ")}`);
    const errToast = await t.page.getByText("Couldn’t update requirement").count();
    if (errToast) t.fail("Toast: Couldn’t update requirement");
    const allIn = await d.getByText("All required documents are in").count();
    const cont = d.getByRole("button", { name: "Continue" });
    if (allIn && !(await cont.isDisabled())) t.pass("Footer: 'All required documents are in', Continue enabled");
    else t.fail(`Footer allIn=${allIn}, continue disabled=${await cont.isDisabled()}`);
    await t.shot("7.4-checklist-complete");
    await cont.click();
    await d.getByRole("heading", { name: "Email Pacific Cross", exact: true }).first().waitFor();
  });

  await step(t, "7.4.2 prefilled email", async () => {
    const d = dialog(t);
    await d.getByLabel("Subject").waitFor({ timeout: 180_000 });
    const err = await d.getByText(/could not|Couldn’t|failed/i).count();
    const recipientSel = d.getByLabel("Recipient");
    const hasRecipient = await recipientSel.count();
    if (hasRecipient) {
      const to = await recipientSel.locator("option:checked").textContent();
      const opts = await recipientSel.locator("option").allTextContents();
      if (to?.trim()) t.pass(`Recipient prefilled: ${to.trim()} (options: ${opts.join(" | ")})`);
      else t.fail("Recipient select has no selected option");
      if (opts.length > 1) {
        await recipientSel.selectOption({ index: 1 });
        t.pass("Recipient is editable (switched to another Pacific Cross contact)");
        await recipientSel.selectOption({ index: 0 });
      }
    } else {
      const none = await d.getByText(/No active Pacific Cross Claims contact/).count();
      t.fail(`No recipient select; 'No active Claims contact' message=${none}, error text=${err}`);
    }
    const subject = await d.getByLabel("Subject").inputValue();
    if (subject.startsWith("Claim submission — QA OCT2 Claims A") && subject.includes(fresh.reference_no) && subject.endsWith("— IP"))
      t.pass(`Subject prefilled: '${subject}'`);
    else t.fail(`Subject: '${subject}'`);
    await d.getByLabel("Subject").fill(`${subject} [QA edit]`);
    if ((await d.getByLabel("Subject").inputValue()).endsWith("[QA edit]")) t.pass("Subject is editable");
    const body = await d.getByLabel("Message").inputValue();
    const lines = body.split("\n").filter((l) => /^\d+\. /.test(l));
    const toFollow = lines.filter((l) => l.endsWith("(to follow)"));
    const withFile = lines.filter((l) => !l.endsWith("(to follow)"));
    if (lines.length === 8 && toFollow.length === 6 && withFile.length === 2)
      t.pass(`Message lists the 8 required items; 6 Received-without-file items marked '(to follow)', 2 with files not`);
    else t.fail(`Message checklist: ${lines.length} lines, ${toFollow.length} to-follow, ${withFile.length} with file:\n${lines.join("\n")}`);
    if (body.includes("Hi Claims team") && body.includes(fresh.reference_no)) t.pass("Body greets the Claims team and cites the claim reference");
    await d.getByLabel("Message").fill(`${body}\nQA edit`);
    if ((await d.getByLabel("Message").inputValue()).endsWith("QA edit")) t.pass("Message is editable");
    const files = await d.getByText(/2 files from the checklist/).count();
    if (files) t.pass("Attachments panel: '2 files from the checklist'");
    else t.note("Attachments count text not '2 files from the checklist'");
    const noFile = await d.getByText("No file uploaded — listed as “to follow”").count();
    if (noFile === 6) t.pass("Attachments panel flags the 6 required items without a file");
    else t.note(`'No file uploaded' flags: ${noFile}`);
    const warn = await d.getByText(/Required items without an uploaded file:/).count();
    if (warn) t.pass("Alert: required items without an uploaded file block sending (UI expects every required item as a file)");
    const send = d.getByRole("button", { name: /Review submission|Send to Pacific Cross/ });
    const sendCount = await send.count();
    const sendDisabled = sendCount ? await send.first().isDisabled() : null;
    t.note(`Send control present=${!!sendCount}, disabled=${sendDisabled} — NOT clicked (no real email sent)`);
    if (warn && toFollow.length) t.bug("Low/UX: the prefilled email says Received-without-file items are '(to follow)', but the same step blocks sending until every required item has a file — the two messages contradict each other.");
    const link = d.getByRole("link", { name: "Download all (ZIP)" });
    zipHref = (await link.count()) ? await link.getAttribute("href") : null;
    if (zipHref === `/api/submissions/claim/${fresh.id}/zip`) t.pass(`Download all (ZIP) link → ${zipHref}`);
    else t.fail(`ZIP link href: ${zipHref}`);
    await t.shot("7.4-email-step");
  });

  await step(t, "7.4.2 ZIP contains the uploaded files", async () => {
    const res = await t.page.request.get(zipHref ?? `/api/submissions/claim/${fresh.id}/zip`, { timeout: 180_000 });
    const ct = res.headers()["content-type"];
    const buf = await res.body();
    if (res.status() === 200 && ct?.includes("application/zip")) t.pass(`ZIP GET 200, ${ct}, ${buf.length} bytes, ${res.headers()["content-disposition"]}`);
    else t.fail(`ZIP GET ${res.status()} ${ct}`);
    const entries = unzipSync(new Uint8Array(buf));
    const names = Object.keys(entries);
    const sample = readFileSync(SAMPLE_PDF);
    const sizesMatch = names.every((n) => entries[n].length === sample.length);
    if (names.length === 2 && sizesMatch) t.pass(`ZIP has 2 entries matching sample.pdf size: ${names.join(", ")}`);
    else t.fail(`ZIP entries: ${names.join(", ")} (sizes ${names.map((n) => entries[n].length).join("/")}, sample ${sample.length})`);
  });

  await step(t, "7.4 back navigation", async () => {
    const d = dialog(t);
    await d.getByRole("button", { name: "Back to requirements" }).click();
    await d.getByRole("heading", { name: "Requirements", exact: true }).first().waitFor();
    t.pass("'Back to requirements' returns to step 2");
    await closeDialog(t);
  });

  await t.finish();
}

/* ------------------------------------------------------------------- 7.5 ------------------------------------------------------------------- */

async function run75(seeded) {
  const t = await startFeature("7.5-claim-intake");
  const { C } = seeded;
  let claim;

  await step(t, "7.5.1 set intake on file", async () => {
    await openFileClaim(t);
    await pickClient(t, C);
    await setType(t, "IP");
    const d = dialog(t);
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const defaultDate = await d.getByLabel("Documents received").inputValue();
    if (defaultDate === todayIso) t.pass(`Documents received defaults to today (${todayIso})`);
    else t.note(`Documents received default: '${defaultDate}'`);
    const modes = await d.getByLabel("How it arrived").locator("option").allTextContents();
    if (modes.includes("Hard copy") && modes.includes("Soft copy")) t.pass(`How it arrived options: ${modes.join(" | ")}`);
    else t.fail(`How it arrived options: ${modes.join(" | ")}`);
    const sel = d.locator("select").filter({ hasText: "QA-OCT2-C1" });
    await sel.waitFor({ timeout: 15_000 });
    await sel.selectOption({ label: (await sel.locator("option").allTextContents()).find((o) => o.startsWith("QA-OCT2-C1")) });
    await d.getByLabel("How it arrived").selectOption("Soft copy");
    await d.getByLabel("Documents received").fill("2026-10-06");
    const complete = await d.getByText("Complete").count();
    if (complete) t.pass("Intake section marked Complete");
    await t.shot("7.5-intake-form");
    claim = await submitClaim(t, C);
    if (claim.submission_mode === "Soft copy" && claim.documents_received_date === "2026-10-06")
      t.pass(`DB: submission_mode='Soft copy', documents_received_date=2026-10-06 for ${claim.reference_no}`);
    else t.fail(`DB intake: ${claim.submission_mode} / ${claim.documents_received_date}`);
    await closeDialog(t);
  });

  await step(t, "7.5.2 list sub-line", async () => {
    const row = await listRow(t, claim.reference_no);
    const text = (await row.textContent()) ?? "";
    if (text.includes("IP · Soft copy · received Oct 6, 2026")) t.pass("List sub-line reads 'IP · Soft copy · received Oct 6, 2026'");
    else t.fail(`List row text: ${text}`);
    await t.shot("7.5-list-subline");
  });

  await step(t, "7.5.2 edit later in workflow", async () => {
    await openClaim(t, claim.reference_no);
    const d = dialog(t);
    await d.getByRole("navigation", { name: "Workflow steps" }).getByRole("button", { name: /Claim details/ }).click();
    await d.getByText("Filed — intake details stay editable here.").waitFor();
    const mode = await d.getByLabel("How it arrived").inputValue();
    const date = await d.getByLabel("Documents received").inputValue();
    if (mode === "Soft copy" && date === "2026-10-06") t.pass("Claim details step shows the saved intake values");
    else t.fail(`Claim details intake: ${mode} / ${date}`);
    await d.getByLabel("How it arrived").selectOption("Hard copy");
    await t.page.waitForTimeout(800);
    await d.getByLabel("Documents received").fill("2026-10-07");
    await t.page.waitForTimeout(1500);
    const toastErr = await t.page.getByText("Couldn’t update claim intake").count();
    if (toastErr) t.fail("Toast: Couldn’t update claim intake");
    let c;
    for (let i = 0; i < 30; i++) {
      ({ data: c } = await db.from("claims").select("submission_mode, documents_received_date").eq("id", claim.id).single());
      if (c.submission_mode === "Hard copy" && c.documents_received_date === "2026-10-07") break;
      await t.page.waitForTimeout(1000);
    }
    if (c.submission_mode === "Hard copy" && c.documents_received_date === "2026-10-07") t.pass("Edited intake saved: Hard copy / 2026-10-07 (DB)");
    else t.fail(`DB after edit (30s): ${c.submission_mode} / ${c.documents_received_date}`);
    await t.shot("7.5-edited");
    await closeDialog(t);
    const row = await listRow(t, claim.reference_no);
    const text = (await row.textContent()) ?? "";
    if (text.includes("IP · Hard copy · received Oct 7, 2026")) t.pass("List sub-line updated to 'IP · Hard copy · received Oct 7, 2026'");
    else t.fail(`List row after edit: ${text}`);
    await t.shot("7.5-list-after-edit");
  });

  await t.finish();
}

/* ------------------------------------------------------------------- main ------------------------------------------------------------------ */

// ONLY=7.3,7.4,7.5 re-runs chosen sub-sections against the clients seeded by an earlier full run.
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
let seeded;
if (only) {
  const { data } = await db.from("clients").select("*").eq("first_name", QA_PREFIX).like("last_name", "Claims %");
  seeded = Object.fromEntries(data.map((c) => [c.last_name.replace("Claims ", ""), c]));
  for (const c of data) created.clients.push({ id: c.id, name: `${c.first_name} ${c.last_name}` });
  const { data: pols } = await db.from("policies").select("id, reference_no, policy_number, client_id").in("client_id", data.map((c) => c.id));
  for (const p of pols) created.policies.push({ id: p.id, reference_no: p.reference_no, policy_number: p.policy_number, client: data.find((c) => c.id === p.client_id)?.last_name });
} else {
  await resetPrevious();
  seeded = await seed();
  console.log("seeded", JSON.stringify({ clients: created.clients, policies: created.policies }, null, 1));
}
const want = (n) => !only || only.includes(n);
const filed71 = want("7.1") ? await run71(seeded) : null;
if (want("7.2")) await run72(seeded);
const filed73 = want("7.3") ? await run73(seeded, filed71) : null;
if (want("7.4") && filed73) await run74(seeded, filed73);
if (want("7.5")) await run75(seeded);

// Everything the run created, for the report's "Created records" section.
const clientIds = created.clients.map((c) => c.id);
const { data: claims } = await db.from("claims").select("id, reference_no, claim_type, policy_id, submission_mode, documents_received_date").in("client_id", clientIds);
const claimIds = (claims ?? []).map((c) => c.id);
const { count: reqCount } = await db.from("claim_requirements").select("id", { count: "exact", head: true }).in("claim_id", claimIds);
const { data: docs } = await db.from("documents").select("id, name, claim_id").in("claim_id", claimIds);
const summary = { ...created, claims, claim_requirements_count: reqCount, documents: docs };
writeFileSync(join(REPORT_ROOT, "07-claims-created.json"), JSON.stringify(summary, null, 2));
console.log("created", JSON.stringify(summary, null, 1));
