/**
 * Verifies the K4 claims fixes (M7, L12, L13, L14). Run from the app folder:
 *   node --env-file=.env.local qa-oct2/fix-claims.mjs
 *   CLAIM_ID=<uuid> node --env-file=.env.local qa-oct2/fix-claims.mjs   # L14 only, on an already-filed QA claim
 * Seeds one client ("QA OCT2 Fix Claims") with two Active health policies and a legacy
 * Hospitalization claim with no checklist rows. Never clicks Send.
 */
import { QA_PREFIX, createTestClient, db, settle, startFeature } from "./lib.mjs";

const created = { clients: [], policies: [], claims: [] };

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

async function seedPolicy(client, version, policyNumber, effective) {
  const { data, error } = await db
    .from("policies")
    .insert({
      client_id: client.id, product_id: version.product_id, product_version_id: version.id, policy_number: policyNumber,
      status: "Active", effective_date: effective, expiry_date: "2027-12-31", currency: "PHP", premium_amount: 10000,
      payment_mode: "Annual", notes: `${QA_PREFIX} seeded policy (fix-claims)`,
    })
    .select("*")
    .single();
  if (error) throw new Error(`policy ${policyNumber}: ${error.message}`);
  created.policies.push({ id: data.id, reference_no: data.reference_no, policy_number: policyNumber });
  return data;
}

async function seed() {
  const select = await versionFor("Primary Medical", "Select");
  const blueRoyale = await versionFor("Primary Medical", "Blue Royale");
  const client = await createTestClient("Fix Claims", { lifecycle_stage: "Client", gender: "Male", date_of_birth: "1990-01-01" });
  created.clients.push({ id: client.id, name: `${client.first_name} ${client.last_name}` });
  // Newer-effective inserted first so "created_at desc" order would put the OLD one last; the fix must pick by effective date.
  const newer = await seedPolicy(client, blueRoyale, "QA-OCT2-FX-NEW", "2026-03-01");
  const older = await seedPolicy(client, select, "QA-OCT2-FX-OLD", "2025-01-01");
  const { data: legacy, error } = await db
    .from("claims")
    .insert({ client_id: client.id, claim_type: "Hospitalization", status: "Documents Pending", amount_claimed: 5000, currency: "PHP", incident_date: "2026-09-01", notes: `${QA_PREFIX} legacy-type claim (fix-claims)` })
    .select("*")
    .single();
  if (error) throw new Error(`legacy claim: ${error.message}`);
  created.claims.push({ id: legacy.id, reference_no: legacy.reference_no, claim_type: "Hospitalization", via: "db seed" });
  return { client, newer, older, legacy };
}

const dialog = (t) => t.page.getByRole("dialog", { name: "Claim workflow" });
const rail = (t) => dialog(t).getByRole("navigation", { name: "Workflow steps" });

async function gotoClaims(t) {
  await t.page.goto("/claims", { timeout: 120_000, waitUntil: "domcontentloaded" });
  await settle(t.page);
  await t.page.getByRole("button", { name: "File claim" }).first().waitFor({ timeout: 90_000 });
}

async function openClaim(t, referenceNo) {
  await gotoClaims(t);
  await t.page.getByPlaceholder("Search claims…").fill(referenceNo);
  await t.page.waitForTimeout(400);
  const row = t.page.locator("tr", { hasText: referenceNo }).first();
  await row.getByRole("button", { name: "Requirements" }).click();
  await dialog(t).waitFor({ state: "visible" });
  await dialog(t).getByText(/Step \d of 3/).waitFor({ timeout: 90_000 });
  await t.page.waitForTimeout(800);
}

async function closeDialog(t) {
  await dialog(t).getByRole("button", { name: "Close", exact: true }).first().click();
  await dialog(t).waitFor({ state: "hidden" }).catch(() => {});
}

async function step(t, name, fn) {
  try { await fn(); } catch (e) { t.fail(`${name}: ${e.message.split("\n")[0]}`); await t.shot(`error-${name.replace(/[^a-z0-9]+/gi, "-")}`); }
}

const resumeId = process.env.CLAIM_ID ?? null;
const seeded = resumeId ? null : await seed();
const t = await startFeature("fix-claims");
let filed = null;

if (!resumeId) {
  await step(t, "M7 legacy claim opens on Requirements", async () => {
    await openClaim(t, seeded.legacy.reference_no);
    const d = dialog(t);
    const stepText = (await d.getByText(/Step \d of 3/).textContent())?.trim();
    const gen = await d.getByRole("button", { name: "Generate checklist" }).count();
    const reqDone = await rail(t).getByRole("button", { name: /Requirements/ }).locator("svg").count();
    const step3Locked = await rail(t).getByRole("button", { name: /Email Pacific Cross/ }).isDisabled();
    if (stepText === "Step 2 of 3" && gen) t.pass(`M7: legacy ${seeded.legacy.reference_no} (0 rows) opens on '${stepText}' with Generate checklist (Requirements check=${!!reqDone}, step 3 locked=${step3Locked})`);
    else t.fail(`M7: opened on '${stepText}', Generate button=${gen}`);
    await t.shot("m7-legacy-opens-step-2");
  });

  await step(t, "L13 change-type picker starts empty", async () => {
    const d = dialog(t);
    const sel = d.getByLabel("New claim type");
    await sel.waitFor();
    const value = await sel.inputValue();
    const btn = d.getByRole("button", { name: "Change claim type" });
    const disabledBefore = await btn.isDisabled();
    await sel.selectOption("OP");
    await t.page.waitForTimeout(300);
    const disabledAfter = await btn.isDisabled();
    if (value === "" && disabledBefore && !disabledAfter) t.pass("L13: picker starts on the placeholder, Change claim type disabled until a type is chosen, enabled after picking OP");
    else t.fail(`L13: initial value='${value}', disabled before=${disabledBefore}, after=${disabledAfter}`);
    await t.shot("l13-change-type");
    await closeDialog(t);
  });

  await step(t, "L12 policy preselected", async () => {
    await gotoClaims(t);
    await t.page.getByRole("button", { name: "File claim" }).first().click();
    const d = dialog(t);
    await d.waitFor({ state: "visible" });
    await d.getByPlaceholder("Search a client…").fill("Fix Claims");
    await d.getByRole("button", { name: `${QA_PREFIX} Fix Claims` }).first().click();
    const policy = d.getByLabel("Policy");
    await policy.waitFor({ timeout: 20_000 });
    await t.page.waitForTimeout(500);
    const value = await policy.inputValue();
    const label = (await policy.locator("option:checked").textContent())?.trim();
    const header = await d.getByText("Policy linked").count();
    if (value === seeded.newer.id && header) t.pass(`L12: two Active health policies → '${label}' (newest effective date) preselected, section reads 'Policy linked'`);
    else t.fail(`L12: selected '${label}' (${value}), expected ${seeded.newer.policy_number} (${seeded.newer.id}); 'Policy linked'=${header}`);
    await t.shot("l12-policy-preselected");
    await policy.selectOption("");
    await t.page.waitForTimeout(200);
    const unlinked = await d.getByText("Unlinked policy").count();
    if ((await policy.inputValue()) === "" && unlinked) t.pass("L12: staff can still pick 'None / not linked'");
    else t.fail("L12: could not switch back to None");
    await policy.selectOption(seeded.newer.id);

    await d.getByLabel("Claim type").selectOption("IP");
    await d.getByRole("button", { name: "File claim" }).click();
    await d.getByText("Step 2 of 3").waitFor({ timeout: 90_000 });
    await t.page.waitForTimeout(800);
    const { data } = await db.from("claims").select("*").eq("client_id", seeded.client.id).order("created_at", { ascending: false }).limit(1).single();
    filed = data;
    created.claims.push({ id: data.id, reference_no: data.reference_no, claim_type: data.claim_type, via: "UI File claim" });
    if (data.policy_id === seeded.newer.id) t.pass(`L12: filed ${data.reference_no} linked to ${seeded.newer.policy_number}`);
    else t.fail(`L12: filed claim policy_id=${data.policy_id}`);
  });
} else {
  const { data } = await db.from("claims").select("*").eq("id", resumeId).single();
  filed = data;
  await openClaim(t, data.reference_no);
}

await step(t, "L14 received-without-file items go to follow and sending is allowed", async () => {
  const d = dialog(t);
  const { data: reqs } = await db.from("claim_requirements").select("id, document_name, status, is_required").eq("claim_id", filed.id);
  for (const r of reqs) {
    if (!r.is_required || r.status !== "Pending") continue;
    await d.getByLabel(`Status for ${r.document_name}`).selectOption("Received");
    await t.page.waitForTimeout(350);
  }
  // The dev server compiles the status action lazily; the optimistic UI runs ahead of the DB.
  let outstanding = [];
  for (let i = 0; i < 240; i++) {
    const { data: after } = await db.from("claim_requirements").select("status, is_required").eq("claim_id", filed.id);
    outstanding = after.filter((r) => r.is_required && r.status === "Pending");
    if (!outstanding.length) break;
    await t.page.waitForTimeout(1000);
  }
  if (outstanding.length) throw new Error(`${outstanding.length} rows still Pending`);
  if (!(await d.getByText("Step 3 of 3").count())) await d.getByRole("button", { name: "Continue" }).click();
  await d.getByLabel("Subject").waitFor({ timeout: 180_000 });
  await t.page.waitForTimeout(500);
  const body = await d.getByLabel("Message").inputValue();
  const lines = body.split("\n").filter((l) => /^\d+\. /.test(l));
  const toFollow = lines.filter((l) => l.endsWith("(to follow)"));
  const note = await d.getByText(/Listed as “to follow”/).count();
  const redAlert = await d.getByText(/Upload each file on the checklist before sending/).count();
  const review = d.getByRole("button", { name: "Review submission" });
  await review.waitFor();
  const reviewDisabled = await review.isDisabled();
  const title = await review.getAttribute("title");
  if (lines.length && toFollow.length === lines.length && note && !redAlert && !reviewDisabled)
    t.pass(`L14: ${toFollow.length}/${lines.length} required items '(to follow)', informational note shown, no red upload alert, Review submission enabled (not clicked)`);
  else t.fail(`L14: lines=${lines.length} toFollow=${toFollow.length} note=${note} redAlert=${redAlert} reviewDisabled=${reviewDisabled} title=${title}`);
  await t.shot("l14-email-step-to-follow");
  await closeDialog(t);
});

const fails = await t.finish(resumeId ? "fix-claims-l14" : "fix-claims");
console.log("created", JSON.stringify(created, null, 1));
process.exit(fails ? 1 : 0);
