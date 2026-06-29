/**
 * Generate a saved Playwright auth session so the Playwright MCP browser starts
 * already signed in as the test staff user.
 *
 * Prerequisite: the dev server is running at PLAYWRIGHT_BASE_URL.
 *
 *   npm run auth:playwright
 *   # equivalent: node --env-file=.env.local scripts/playwright-auth.mjs
 *
 * Writes .auth/staff.json (gitignored — holds a live session token). The
 * Playwright MCP loads it via: --isolated --storage-state <abs>/.auth/staff.json
 */
import { mkdirSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import WebSocket from "ws";

// supabase-js needs a WebSocket constructor at init; Node < 22 has none.
if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = WebSocket;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.PLAYWRIGHT_TEST_EMAIL;
const password = process.env.PLAYWRIGHT_TEST_PASSWORD;
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3010";
const STATE_PATH = ".auth/staff.json";

if (!url || !serviceKey || !email || !password) {
  console.error(
    "Missing env: need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, " +
      "PLAYWRIGHT_TEST_EMAIL, PLAYWRIGHT_TEST_PASSWORD.",
  );
  process.exit(1);
}

// 1. Ensure the test user exists (idempotent) + its public.users row.
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId;
const { data: created, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Admin" },
});
if (error) {
  if (/already|registered|exists/i.test(error.message)) {
    const { data: list } = await supabase.auth.admin.listUsers();
    userId = list.users.find((u) => u.email === email)?.id;
    if (userId) {
      await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
    }
  } else {
    console.error("ensure-user failed:", error.message);
    process.exit(1);
  }
} else {
  userId = created.user.id;
}
if (userId) {
  await supabase
    .from("users")
    .upsert({ id: userId, full_name: "Admin", email, role: "Owner" }, { onConflict: "id" });
}
console.log(`✓ user ensured: ${email}`);

// 2. Log in through the real UI and capture the authenticated browser state.
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 25000 }),
    page.click('button[type="submit"]'),
  ]);

  mkdirSync(".auth", { recursive: true });
  await page.context().storageState({ path: STATE_PATH });
  console.log(`✓ saved auth state → ${STATE_PATH}`);
} catch (e) {
  console.error(
    `login failed (is the dev server running at ${baseUrl}?):`,
    e instanceof Error ? e.message.split("\n")[0] : e,
  );
  await browser.close();
  process.exit(1);
}
await browser.close();
console.log("Done. Restart Claude Code so the Playwright MCP reloads the saved session.");
