/**
 * Phase H0 — clear every client and lead record before real client staging begins.
 *
 * Scope (DH1, decided 2026-10-06): ALL `clients` rows — Lead / Applicant / Client / Lost, demo
 * seeds and website-created alike — plus everything that hangs off them. Reference counters for
 * those entities are reset too (DH2), so the first real client is CLI-<year>-00001.
 *
 * Kept: users (and the USR counter), the product/plan catalog, templates, document_library and
 * its `library/` storage objects, external_contacts, integration settings, payment_channels,
 * requirement templates, and audit/activity rows that are not about client data.
 *
 *   node scripts/clear-client-data.mjs                       # dry run (default): counts only
 *   node scripts/clear-client-data.mjs --backup              # dry run + write the backup
 *   node scripts/clear-client-data.mjs --apply --confirm=CLEAR-CLIENT-DATA
 *
 * --apply always writes the backup first (rows as JSON + the storage files) and refuses to
 * delete anything if the backup fails. Default backup dir is outside the repo, because it holds
 * client PII: ~/pacific-insurance-backups/clear-client-data-<timestamp>/ (override --backup-dir=).
 *
 * PostgREST cannot wrap several deletes in one transaction, so instead the deletes run in FK-safe
 * order and every step is a whole-table (or fixed-filter) delete. A failure part-way leaves a
 * strictly smaller dataset; re-running --apply finishes the job.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import WebSocket from "ws";

if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = WebSocket;

const BUCKET = "documents";
const LIBRARY_PREFIX = "library";
const CONFIRM_PHRASE = "CLEAR-CLIENT-DATA";
const PAGE = 1000;

/* ---------- args ---------- */
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : null;
};
const APPLY = flag("apply");
const BACKUP = APPLY || flag("backup");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const BACKUP_DIR =
  opt("backup-dir") ?? join(homedir(), "pacific-insurance-backups", `clear-client-data-${stamp}`);

if (APPLY && opt("confirm") !== CONFIRM_PHRASE) {
  console.error(`--apply needs --confirm=${CONFIRM_PHRASE}`);
  process.exit(1);
}

/* ---------- env ---------- */
function loadEnv() {
  const out = {};
  const path = new URL("../.env.local", import.meta.url);
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim().replace(/^export\s+/, "");
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const i = trimmed.indexOf("=");
      out[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* fall through to process.env */
  }
  return (k) => process.env[k] ?? out[k];
}
const env = loadEnv();
const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ---------- scope ---------- */
/** Audit rows about these tables describe client data and go with it. */
const CLIENT_AUDIT_TABLES = [
  "clients", "dependents", "applications", "application_requirements", "application_dependents",
  "application_carrier_forms", "policies", "renewals", "claims", "claim_requirements",
  "travel_requests", "travel_request_requirements", "travelers", "payments", "commissions",
  "documents", "communications", "tasks", "referrals", "relationship_activities",
  "external_coverage", "group_accounts", "group_members", "workflow_instances",
];
const CLIENT_TIMELINE_SCOPES = ["client", "group_account"];
/** Every counter except USR: users are kept, so their numbering must keep going. */
const KEEP_COUNTERS = ["USR"];

/**
 * Deletes in FK-safe order. `key` is any NOT NULL column, because PostgREST refuses an
 * unfiltered delete. Tables marked `cascade` should already be empty when their step runs;
 * they are deleted explicitly so nothing survives if an FK rule ever changes.
 */
const STEPS = [
  // RESTRICT on dependents, so before clients (which cascades dependents).
  { table: "application_carrier_forms", key: "id" },
  { table: "application_dependents", key: "application_id" },
  // Cascades application_requirements and workflow_instances.
  { table: "applications", key: "id" },
  // SET NULL to clients/policies, so they would survive as orphans.
  { table: "commissions", key: "id" },
  { table: "payments", key: "id" },
  // RESTRICT on clients. Claims cascade claim_requirements; travel cascades travelers + reqs.
  { table: "claims", key: "id" },
  { table: "travel_requests", key: "id" },
  { table: "renewals", key: "id" },
  { table: "policies", key: "id" },
  // SET NULL to clients.
  { table: "referrals", key: "id" },
  { table: "group_members", key: "id" },
  { table: "group_accounts", key: "id" },
  // Cascades dependents, documents, communications (+ library links), tasks,
  // relationship_activities, external_coverage, workflow_instances.
  { table: "clients", key: "id" },
  { table: "dependents", key: "id", cascade: true },
  { table: "communication_library_documents", key: "communication_id", cascade: true },
  { table: "communications", key: "id", cascade: true },
  { table: "documents", key: "id", cascade: true },
  { table: "tasks", key: "id", cascade: true },
  { table: "relationship_activities", key: "id", cascade: true },
  { table: "external_coverage", key: "id", cascade: true },
  { table: "workflow_instances", key: "id", cascade: true },
  { table: "application_requirements", key: "id", cascade: true },
  { table: "claim_requirements", key: "id", cascade: true },
  { table: "travel_request_requirements", key: "id", cascade: true },
  { table: "travelers", key: "id", cascade: true },
  // No FK covers these: filtered to client-data scopes only.
  { table: "activity_timeline", key: "id", filter: (q) => q.in("scope_type", CLIENT_TIMELINE_SCOPES) },
  { table: "audit_logs", key: "id", filter: (q) => q.in("table_name", CLIENT_AUDIT_TABLES) },
  { table: "reference_counters", key: "entity", filter: (q) => q.not("entity", "in", `(${KEEP_COUNTERS.join(",")})`) },
];

/** Untouched tables whose counts must not move. */
const GUARD_TABLES = [
  "users", "products", "product_versions", "plan_options", "document_library",
  "email_templates", "message_templates", "external_contacts", "integration_settings",
  "payment_channels", "required_document_templates", "required_document_items",
  "workflow_templates", "workflow_steps",
];

/* ---------- helpers ---------- */
function fail(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}
const scoped = (step, q) => (step.filter ? step.filter(q) : q.not(step.key, "is", null));

async function count(table, step) {
  let q = db.from(table).select("*", { count: "exact", head: true });
  if (step) q = scoped(step, q);
  const { count: n, error } = await q;
  if (error) fail(`count ${table}: ${error.message}`);
  return n ?? 0;
}

async function fetchAll(step) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await scoped(step, db.from(step.table).select("*")).range(from, from + PAGE - 1);
    if (error) fail(`read ${step.table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

/** Every object in the bucket outside library/ — the client-scoped uploads. */
async function listClientObjects(prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: PAGE, offset });
    if (error) fail(`list storage "${prefix}": ${error.message}`);
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!prefix && entry.name === LIBRARY_PREFIX) continue;
      if (entry.id === null) out.push(...(await listClientObjects(path)));
      else out.push(path);
    }
    if (data.length < PAGE) return out;
  }
}

/* ---------- main ---------- */
console.log(APPLY ? "MODE: APPLY — this deletes data.\n" : "MODE: dry run (nothing is deleted).\n");

const plan = [];
for (const step of STEPS) plan.push({ ...step, rows: await count(step.table, step) });
const objects = await listClientObjects();
const guardBefore = Object.fromEntries(
  await Promise.all(GUARD_TABLES.map(async (t) => [t, await count(t)])),
);

console.log("Rows to delete:");
for (const s of plan) console.log(`  ${s.table.padEnd(32)} ${String(s.rows).padStart(5)}${s.cascade ? "  (normally removed by cascade)" : ""}`);
console.log(`  ${"storage objects (non-library)".padEnd(32)} ${String(objects.length).padStart(5)}`);
const { data: counters, error: counterErr } = await scoped(STEPS.at(-1), db.from("reference_counters").select("*"));
if (counterErr) fail(`read reference_counters: ${counterErr.message}`);
console.log(`\nCounters reset: ${counters.map((c) => `${c.entity}-${c.year}=${c.counter}`).join(", ") || "none"}`);
console.log(`Counters kept:  ${KEEP_COUNTERS.join(", ")}`);
console.log("\nUnchanged (guarded):");
for (const [t, n] of Object.entries(guardBefore)) console.log(`  ${t.padEnd(32)} ${String(n).padStart(5)}`);

if (BACKUP) {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const dump = { takenAt: new Date().toISOString(), supabaseUrl: SUPABASE_URL, tables: {} };
  for (const s of plan) dump.tables[s.table] = await fetchAll(s);
  writeFileSync(join(BACKUP_DIR, "rows.json"), JSON.stringify(dump, null, 2));
  for (const path of objects) {
    const { data, error } = await db.storage.from(BUCKET).download(path);
    if (error) fail(`backup download ${path}: ${error.message}`);
    const target = join(BACKUP_DIR, "storage", path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(await data.arrayBuffer()));
  }
  const saved = Object.values(dump.tables).reduce((n, r) => n + r.length, 0);
  console.log(`\nBackup written: ${BACKUP_DIR}  (${saved} rows, ${objects.length} files)`);
}

if (!APPLY) {
  console.log(`\nDry run complete. To delete: --apply --confirm=${CONFIRM_PHRASE}`);
  process.exit(0);
}

console.log("\nDeleting…");
for (const step of STEPS) {
  const { error, count: n } = await scoped(step, db.from(step.table).delete({ count: "exact" }));
  if (error) fail(`delete ${step.table}: ${error.message} — re-run --apply to finish.`);
  console.log(`  ${step.table.padEnd(32)} ${String(n ?? 0).padStart(5)}`);
}
if (objects.length) {
  const { error } = await db.storage.from(BUCKET).remove(objects);
  if (error) fail(`storage remove: ${error.message} — re-run --apply to finish.`);
}
console.log(`  ${"storage objects".padEnd(32)} ${String(objects.length).padStart(5)}`);

/* ---------- verify ---------- */
const problems = [];
for (const step of STEPS) {
  const n = await count(step.table, step);
  if (n !== 0) problems.push(`${step.table} still has ${n} rows`);
}
const left = await listClientObjects();
if (left.length) problems.push(`${left.length} storage objects remain outside library/`);
for (const t of GUARD_TABLES) {
  const n = await count(t);
  if (n !== guardBefore[t]) problems.push(`${t} changed: ${guardBefore[t]} → ${n}`);
}
if (problems.length) fail(`Verification failed:\n  ${problems.join("\n  ")}`);
console.log("\n✔ Verified: client data is empty, counters reset, guarded tables unchanged.");
