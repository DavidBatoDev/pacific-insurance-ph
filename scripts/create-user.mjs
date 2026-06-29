/**
 * Create (or update) a single staff user via the Supabase admin API, and the
 * matching public.users row. Email/password provider; email auto-confirmed.
 *
 *   USER_EMAIL=a@b.com USER_PASSWORD='secret' USER_NAME='Admin' USER_ROLE=Owner \
 *     node --env-file=.env.local scripts/create-user.mjs
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

// supabase-js needs a WebSocket constructor at init; Node < 22 has none.
if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = WebSocket;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.USER_EMAIL;
const password = process.env.USER_PASSWORD;
const fullName = process.env.USER_NAME ?? email;
const role = process.env.USER_ROLE ?? "Owner";

if (!url || !serviceKey || !email || !password) {
  console.error(
    "Missing env: need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, USER_EMAIL, USER_PASSWORD.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId;
const { data: created, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});

if (error) {
  if (/already|registered|exists/i.test(error.message)) {
    const { data: list } = await supabase.auth.admin.listUsers();
    userId = list.users.find((u) => u.email === email)?.id;
    if (userId) {
      await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
    }
  } else {
    console.error("createUser failed:", error.message);
    process.exit(1);
  }
} else {
  userId = created.user.id;
}

if (!userId) {
  console.error("Could not resolve user id.");
  process.exit(1);
}

const { error: upErr } = await supabase
  .from("users")
  .upsert({ id: userId, full_name: fullName, email, role }, { onConflict: "id" });
if (upErr) {
  console.error("users upsert failed:", upErr.message);
  process.exit(1);
}

console.log(`OK: ${email} (${role}) -> ${userId}`);
