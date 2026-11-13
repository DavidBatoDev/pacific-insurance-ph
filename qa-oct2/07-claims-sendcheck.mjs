/** Follow-up probe for 7.4: what the send controls show on the completed QA claim (nothing is sent). */
import { startFeature, settle, db, QA_PREFIX } from "./lib.mjs";

const t = await startFeature("7.4b-send-controls");
const { data: client } = await db.from("clients").select("id").eq("first_name", QA_PREFIX).eq("last_name", "Claims A").single();
const { data: claims } = await db.from("claims").select("id, reference_no").eq("client_id", client.id).eq("claim_type", "IP").order("created_at", { ascending: false });
const { data: docs } = await db.from("documents").select("claim_id").in("claim_id", claims.map((c) => c.id));
const claim = claims.find((c) => docs.some((d) => d.claim_id === c.id));
t.note(`Probing ${claim.reference_no}`);
try {
  await t.page.goto("/claims", { timeout: 120_000, waitUntil: "domcontentloaded" });
  await settle(t.page);
  await t.page.getByPlaceholder("Search claims…").fill(claim.reference_no);
  await t.page.locator("tr", { hasText: claim.reference_no }).first().getByRole("button", { name: "Requirements" }).click();
  const d = t.page.getByRole("dialog", { name: "Claim workflow" });
  await d.getByLabel("Subject").waitFor({ timeout: 180_000 });
  t.note(`Opened on: ${(await d.getByText(/Step \d of 3/).textContent())?.trim()}`);
  await t.page.waitForTimeout(8000);
  const checking = await d.getByText("Checking sending permission…").count();
  const review = d.getByRole("button", { name: /Review submission/ });
  const n = await review.count();
  const blocked = await d.getByText(/Upload the file for:/).count();
  const from = await d.getByText(/^From: /).count();
  const senderErr = await d.getByText(/are sent by active Admin and Staff accounts only/).count();
  t.note(`after 8s: checking=${checking} review-button=${n} disabled=${n ? await review.first().isDisabled() : "n/a"} title='${n ? await review.first().getAttribute("title") : ""}' blockedText=${blocked} from=${from} senderError=${senderErr}`);
  if (senderErr) t.note(`Sender error text: ${await d.getByText(/are sent by active Admin and Staff accounts only/).textContent()}`);
  if (n && (await review.first().isDisabled()) && blocked) t.pass("Review submission button present but disabled while required items lack files; nothing sent");
  else if (senderErr) t.note("Send controls unavailable for this account (sender check error) — see text above");
  else t.fail(`Send controls state unclear: review=${n} blocked=${blocked} checking=${checking}`);
  await d.getByText("Attachments").scrollIntoViewIfNeeded();
  await t.shot("7.4b-send-controls");
} catch (e) {
  t.fail(e.message.split("\n")[0]);
  await t.shot("7.4b-fail");
}
await t.finish();
