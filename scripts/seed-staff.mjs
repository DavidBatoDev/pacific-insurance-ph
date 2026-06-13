/**
 * One-off: create the staff auth users (Matt, Eman) and their public.users rows.
 *
 * Run from the project root with the service-role credentials loaded:
 *
 *   SEED_PASSWORD='your-strong-password' node --env-file=.env.local scripts/seed-staff.mjs
 *
 * Idempotent: re-running updates the public.users row and leaves existing auth
 * users in place. Change SEED_PASSWORD or reset passwords from the Supabase
 * dashboard afterwards.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_PASSWORD;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!password) {
  console.error("Missing SEED_PASSWORD env var (used for both staff accounts).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const staff = [
  { email: "matt@pacificinsurance.ph", fullName: "Matt", role: "Owner" },
  { email: "eman@pacificinsurance.ph", fullName: "Eman", role: "Admin" },
];

for (const s of staff) {
  let userId;

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: s.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: s.fullName },
  });

  if (createErr) {
    if (/already|registered|exists/i.test(createErr.message)) {
      const { data: list } = await supabase.auth.admin.listUsers();
      userId = list.users.find((u) => u.email === s.email)?.id;
    } else {
      console.error(`Failed to create ${s.email}:`, createErr.message);
      process.exit(1);
    }
  } else {
    userId = created.user.id;
  }

  const { error: upsertErr } = await supabase
    .from("users")
    .upsert(
      { id: userId, full_name: s.fullName, email: s.email, role: s.role },
      { onConflict: "id" },
    );

  if (upsertErr) {
    console.error(`Failed to upsert users row for ${s.email}:`, upsertErr.message);
    process.exit(1);
  }

  console.log(`Seeded ${s.email} (${s.role}) -> ${userId}`);
}

console.log("Done.");
