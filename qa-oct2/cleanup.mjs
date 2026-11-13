/**
 * Remove every record created by the TESTING-OCT2 Playwright runs: clients whose first_name
 * starts with "QA OCT2" and everything hanging off them (applications, policies, renewals,
 * claims, trips, payments, commissions, documents + storage objects, tasks, communications,
 * drafts, timeline rows). Reference counters are NOT reset (real records exist below them).
 *
 *   node --env-file=.env.local qa-oct2/cleanup.mjs           # dry run
 *   node --env-file=.env.local qa-oct2/cleanup.mjs --apply
 */
import { QA_PREFIX, db } from "./lib.mjs";

const APPLY = process.argv.includes("--apply");
const BUCKET = "documents";

const { data: clients, error } = await db
  .from("clients")
  .select("id, first_name, last_name, reference_no")
  .ilike("first_name", `${QA_PREFIX}%`);
if (error) throw new Error(error.message);
const clientIds = clients.map((c) => c.id);
console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${clients.length} QA clients:`);
for (const c of clients) console.log(`  ${c.reference_no}  ${c.first_name} ${c.last_name}`);

if (!clientIds.length) {
  console.log("Nothing to clean.");
  process.exit(0);
}

const ids = async (table, col = "client_id") => {
  const { data, error } = await db.from(table).select("id").in(col, clientIds);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.map((r) => r.id);
};

const applicationIds = await ids("applications");
const policyIds = await ids("policies");
const claimIds = await ids("claims");
const travelIds = await ids("travel_requests");
const renewalIds = await ids("renewals");
const paymentIds = await ids("payments");
const commissionIds = await ids("commissions");

// documents (+ storage objects) tied to any of the above
const docFilters = [
  ["client_id", clientIds],
  ["application_id", applicationIds],
  ["policy_id", policyIds],
  ["claim_id", claimIds],
  ["travel_request_id", travelIds],
  ["renewal_id", renewalIds],
  ["commission_id", commissionIds],
];
const docs = new Map();
for (const [col, list] of docFilters) {
  if (!list.length) continue;
  const { data, error } = await db.from("documents").select("id, file_path").in(col, list);
  if (error) throw new Error(`documents.${col}: ${error.message}`);
  for (const d of data) docs.set(d.id, d.file_path);
}
const uploadPaths = [];
if (clientIds.length) {
  const { data } = await db
    .from("requirement_attachment_uploads")
    .select("id, storage_path")
    .in("client_id", clientIds);
  for (const u of data ?? []) uploadPaths.push(u.storage_path);
}

const plan = [
  ["renewal_email_drafts", "renewal_id", renewalIds],
  ["travel_pack_reference_attachments", "travel_request_id", travelIds],
  ["requirement_attachment_usages", "upload_path", uploadPaths],
  ["requirement_attachment_uploads", "client_id", clientIds],
  ["communications", "client_id", clientIds],
  ["tasks", "client_id", clientIds],
  ["documents", "id", [...docs.keys()]],
  ["commissions", "id", commissionIds],
  ["payments", "id", paymentIds],
  ["claims", "id", claimIds],
  ["travel_requests", "id", travelIds],
  ["renewals", "id", renewalIds],
  ["application_carrier_forms", "application_id", applicationIds],
  ["applications", "id", applicationIds],
  ["policies", "id", policyIds],
  ["workflow_instances", "client_id", clientIds],
  ["relationship_activities", "client_id", clientIds],
  ["external_coverage", "client_id", clientIds],
  ["dependents", "primary_client_id", clientIds],
  ["gmail_inbox_messages", "client_id", clientIds],
  ["activity_timeline", "scope_id", clientIds],
  ["clients", "id", clientIds],
];

for (const [table, col, list] of plan) {
  if (!list.length) continue;
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).in(col, list);
  console.log(`  ${table.padEnd(36)} ${String(error ? `? ${error.message}` : count).padStart(4)}`);
}
const storagePaths = [...docs.values(), ...uploadPaths].filter(Boolean);
console.log(`  ${"storage objects".padEnd(36)} ${String(storagePaths.length).padStart(4)}`);

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to delete.");
  process.exit(0);
}

console.log("\nDeleting…");
const blocked = [];
for (const [table, col, list] of plan) {
  if (!list.length) continue;
  const { error, count } = await db.from(table).delete({ count: "exact" }).in(col, list);
  if (!error) {
    console.log(`  ${table.padEnd(36)} ${String(count ?? 0).padStart(4)}`);
    continue;
  }
  // Statement-level failure: retry row by row so guarded rows don't shield the rest.
  const { data: rows } = await db.from(table).select(`id, ${col}`).in(col, list);
  let ok = 0;
  for (const r of rows ?? []) {
    const { error: e } = await db.from(table).delete().eq("id", r.id);
    if (e) blocked.push({ table, id: r.id, reason: e.message });
    else ok++;
  }
  console.log(`  ${table.padEnd(36)} ${String(ok).padStart(4)}  (${(rows?.length ?? 0) - ok} blocked)`);
}
if (blocked.length) {
  console.log("\nBlocked by DB guards (need SQL with triggers disabled):");
  for (const b of blocked) console.log(`  ${b.table} ${b.id}: ${b.reason}`);
}
if (storagePaths.length) {
  const { error } = await db.storage.from(BUCKET).remove(storagePaths);
  console.log(`  storage objects ${error ? `✖ ${error.message}` : storagePaths.length}`);
}
const { count: left } = await db
  .from("clients")
  .select("*", { count: "exact", head: true })
  .ilike("first_name", `${QA_PREFIX}%`);
console.log(left ? `\n✖ ${left} QA clients remain` : "\n✔ QA data removed.");
