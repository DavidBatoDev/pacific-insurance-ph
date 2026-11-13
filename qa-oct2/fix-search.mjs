/**
 * M9 fix check — multi-word client search (existing-client picker + ⌘K palette).
 *
 *   node --env-file=.env.local qa-oct2/fix-search.mjs
 */
import { startFeature, settle, createTestClient } from "./lib.mjs";

const t = await startFeature("fix-search");
const { page } = t;
page.on("dialog", (d) => d.accept());
page.setDefaultNavigationTimeout(150_000);
const goto = (path) => page.goto(path, { waitUntil: "domcontentloaded" });
const check = (ok, text) => (ok ? t.pass(text) : t.fail(text));

const client = await createTestClient("Search Target");
const clientName = `${client.first_name} ${client.last_name}`;
t.note(`Seeded client ${clientName} id=${client.id} email=${client.email} ref=${client.reference_no ?? "(none)"}`);

const wiz = () => page.locator("div.fixed.inset-0").filter({ hasText: "New Client Application" });

try {
  /* ---------- Existing-client picker in New Application ---------- */
  await goto("/applications");
  await settle(page, 2500);
  const btns = page.getByRole("button", { name: "New application" });
  await btns.nth((await btns.count()) - 1).click();
  await wiz().waitFor({ state: "visible", timeout: 60_000 });
  await settle(page, 800);
  await wiz().getByRole("button", { name: "Existing client", exact: true }).click();
  const search = wiz().getByPlaceholder("Search a client…");

  const resultRows = () => wiz().locator("button.mt-1\\.5 div.font-\\[600\\]");
  const searchFor = async (term) => {
    await search.fill("");
    await resultRows().first().waitFor({ state: "detached", timeout: 10_000 }); // empty query → no rows
    // The picker keeps showing the previous query's rows until the new server action answers,
    // so wait for that response (client array or `1:[]`) rather than for a matching row.
    const resp = page.waitForResponse(
      async (r) => {
        if (r.request().method() !== "POST") return false;
        const b = await r.text().catch(() => "");
        return b.includes('"clientType"') || /\n1:\[\]\s*$/.test(b);
      },
      { timeout: 150_000 },
    );
    await search.fill(term);
    await resp;
    await page.waitForTimeout(600);
    return resultRows().allTextContents();
  };
  // Warm the server action (first compile on the shared dev server can exceed the per-term wait).
  await searchFor("QA");

  const pickerTerms = [
    ["full name", clientName],
    ["first+last fragment", "OCT2 Target"],
    ["last-name word", "Search"],
    ["email", client.email],
  ];
  if (client.reference_no) pickerTerms.push(["reference_no", client.reference_no]);
  for (const [label, term] of pickerTerms) {
    const hits = await searchFor(term);
    const ok = hits.includes(clientName);
    await t.shot(`picker-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`);
    check(ok, `Picker search by ${label} "${term}" → ${hits.length ? hits.join(", ") : "nothing"}`);
  }
  await page.keyboard.press("Escape");
  await settle(page, 500);

  /* ---------- ⌘K palette ---------- */
  await page.getByTitle("Command palette (⌘K)").click();
  const palette = page.getByPlaceholder("Search clients, leads, policies, applications, claims…");
  await palette.waitFor({ state: "visible", timeout: 20_000 });
  await palette.fill(clientName);
  const hit = page.locator("div.fixed.inset-0").filter({ has: palette }).getByText(clientName, { exact: false }).first();
  const found = await hit.waitFor({ state: "visible", timeout: 90_000 }).then(() => true, () => false);
  await t.shot("palette-full-name");
  check(found, `⌘K palette search "${clientName}" lists the client`);
} catch (err) {
  t.fail(err.message.split("\n")[0]);
  await t.shot("fail").catch(() => {});
}

process.exitCode = (await t.finish()) ? 1 : 0;
