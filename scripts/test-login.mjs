/**
 * Playwright smoke test for the staff login flow.
 *
 *   BASE_URL=http://localhost:3010 node scripts/test-login.mjs
 *
 * Drives a real headless Chromium: confirms the auth redirect, signs in with the
 * admin account, and verifies the dashboard + Clients screen render.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3010";
const EMAIL = process.env.TEST_EMAIL ?? "admin@pacificinsuranceph.com";
const PASSWORD = process.env.TEST_PASSWORD ?? "Admin123$";

const results = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  // 1. Unauthenticated root should redirect to /login (proxy guard).
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/login/, { timeout: 20000 });
  results.push(`PASS  unauthenticated / → ${new URL(page.url()).pathname}`);

  // 2. Sign in.
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 25000 }),
    page.click('button[type="submit"]'),
  ]);
  results.push(`PASS  signed in → ${new URL(page.url()).pathname}`);

  // 3. Dashboard shell rendered.
  await page.waitForSelector("text=Clients", { timeout: 15000 });
  const h1 = (await page.textContent("h1").catch(() => null))?.trim() ?? "n/a";
  results.push(`PASS  dashboard rendered (h1: "${h1}")`);

  // 4. Real Clients screen.
  await page.goto(`${BASE}/clients`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Add client", { timeout: 15000 });
  results.push("PASS  /clients shows the wired Clients screen");

  await page.screenshot({ path: "scripts/login-test.png", fullPage: true });
  results.push("PASS  screenshot → scripts/login-test.png");
} catch (e) {
  results.push(`FAIL  ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
  await page.screenshot({ path: "scripts/login-test-fail.png", fullPage: true }).catch(() => {});
  console.log(results.join("\n"));
  await browser.close();
  process.exit(1);
}

console.log(results.join("\n"));
await browser.close();
