/**
 * Phase J2: move existing CRM logins onto the Google Workspace addresses (DJ8).
 * User ids are stable, so every audit row, assignment and timeline entry stays attached.
 *
 *   node --env-file=.env.local scripts/migrate-staff-emails.mjs           # dry run (default)
 *   node --env-file=.env.local scripts/migrate-staff-emails.mjs --apply   # write
 *
 * Order matters: the near-empty "Admin" user first releases admin@ so Matt's user can take it.
 * Each step is skipped when already done, so a rerun after a partial failure resumes safely.
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

// supabase-js needs a WebSocket constructor at init; Node < 22 has none.
if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = WebSocket;

const STEPS = [
  {
    label: "Retire the shared \"Admin\" user",
    id: "87d46a8f-b42c-4097-945d-45e469598ef6",
    from: "admin@pacificinsuranceph.com",
    to: "retired-admin@pacificinsuranceph.com",
    status: "Inactive",
  },
  {
    label: "Matt signs in as the agency mailbox",
    id: "73c3e291-6a33-4ef6-9107-2f33712bde19",
    from: "matt@pacificinsurance.ph",
    to: "admin@pacificinsuranceph.com",
  },
  {
    label: "Eman moves to her Workspace account",
    id: "22ee6db5-09dd-45e0-8bd1-9917976cdc29",
    from: "eman@pacificinsurance.ph",
    to: "eman@pacificinsuranceph.com",
  },
];

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing env: need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function fail(message) {
  console.error(`ABORT: ${message}`);
  process.exit(1);
}

/** Every auth user, paged; the project has a handful, but never assume one page. */
async function authUsers() {
  const all = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`listUsers: ${error.message}`);
    all.push(...data.users);
    if (data.users.length < 1000) return all;
  }
}

console.log(apply ? "APPLY: changes will be written.\n" : "DRY RUN: nothing is written. Rerun with --apply.\n");

for (const step of STEPS) {
  const [auth, { data: row, error: rowError }] = await Promise.all([
    authUsers(),
    supabase.from("users").select("id, email, full_name, status").eq("id", step.id).maybeSingle(),
  ]);
  if (rowError) fail(`${step.label}: ${rowError.message}`);
  const authUser = auth.find((user) => user.id === step.id);
  if (!row || !authUser) fail(`${step.label}: user ${step.id} not found.`);

  const authEmail = authUser.email?.toLowerCase();
  const status = step.status ?? row.status;
  const done = authEmail === step.to && row.email === step.to && row.status === status;
  if (done) {
    console.log(`= ${step.label}: already ${step.to}${step.status ? ` (${status})` : ""}. Skipped.`);
    continue;
  }
  if (![step.from, step.to].includes(authEmail) || ![step.from, step.to].includes(row.email)) {
    fail(`${step.label}: expected ${step.from}, found auth=${authEmail} users=${row.email}.`);
  }
  const holder = auth.find((user) => user.id !== step.id && user.email?.toLowerCase() === step.to);
  const { data: rowHolder } = await supabase.from("users").select("id").eq("email", step.to).neq("id", step.id).maybeSingle();
  // The holder of `to` may only be the user an earlier step moves away in this same run (dry run).
  const releasedEarlier = STEPS.some((other) => other.from === step.to && STEPS.indexOf(other) < STEPS.indexOf(step));
  if ((holder || rowHolder) && !(releasedEarlier && !apply)) fail(`${step.label}: ${step.to} is still held by another user.`);

  console.log(`> ${step.label} (${row.full_name}, ${step.id})`);
  console.log(`    email  ${authEmail} -> ${step.to}`);
  if (step.status && row.status !== step.status) console.log(`    status ${row.status} -> ${step.status}`);
  if (!apply) continue;

  if (authEmail !== step.to) {
    const { error } = await supabase.auth.admin.updateUserById(step.id, { email: step.to, email_confirm: true });
    if (error) fail(`${step.label}: auth update failed: ${error.message}`);
  }
  const { error: updateError } = await supabase.from("users").update({ email: step.to, status }).eq("id", step.id);
  if (updateError) fail(`${step.label}: users update failed after the auth email changed: ${updateError.message}. Rerun to finish.`);
  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: null,
    action: "staff_email_migrate",
    table_name: "users",
    record_id: step.id,
    previous_value: { email: row.email, status: row.status },
    new_value: { email: step.to, status, source: "scripts/migrate-staff-emails.mjs (Phase J2)" },
  });
  if (auditError) fail(`${step.label}: changed, but the audit row failed: ${auditError.message}`);
  console.log("    done");
}

console.log(apply ? "\nFinished. Ask Matt and Eman to sign in again with their new addresses." : "\nDry run complete.");
