/**
 * Shared harness for the TESTING-OCT2.md Playwright runs.
 *
 *   node --env-file=.env.local qa-oct2/<section>.mjs
 *
 * Every run: pre-authenticated context from .auth/staff.json (Owner → admin role), video
 * recorded to qa-oct2/videos/<feature>/, findings appended to qa-oct2/reports/<feature>.md.
 * Test data MUST be labelled with the QA_PREFIX so qa-oct2/cleanup.mjs can remove it.
 */
import { appendFileSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import WebSocket from "ws";

if (typeof globalThis.WebSocket === "undefined") globalThis.WebSocket = WebSocket;

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3010";
export const QA_PREFIX = "QA OCT2";
export const ROOT = new URL("./", import.meta.url).pathname;
export const VIDEO_ROOT = join(ROOT, "videos");
export const REPORT_ROOT = join(ROOT, "reports");
export const SAMPLE_PDF = join(ROOT, "fixtures", "sample.pdf");

export const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Open a recorded, pre-authed page for one feature (e.g. "2.1-payment-frequency"). */
export async function startFeature(feature, { viewport = { width: 1440, height: 900 } } = {}) {
  const videoDir = join(VIDEO_ROOT, feature);
  mkdirSync(videoDir, { recursive: true });
  mkdirSync(REPORT_ROOT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: join(ROOT, "..", ".auth", "staff.json"),
    viewport,
    recordVideo: { dir: videoDir, size: viewport },
    baseURL: BASE_URL,
  });
  context.setDefaultTimeout(20_000);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  const findings = [];
  const reportPath = join(REPORT_ROOT, `${feature}.md`);
  writeFileSync(reportPath, `# ${feature}\n\nRun: ${new Date().toISOString()}\n\n`);

  const log = (status, text) => {
    const line = `- [${status}] ${text}`;
    findings.push(line);
    console.log(line);
    appendFileSync(reportPath, `${line}\n`);
  };

  return {
    browser,
    context,
    page,
    consoleErrors,
    pass: (t) => log("PASS", t),
    fail: (t) => log("FAIL", t),
    bug: (t) => log("BUG", t),
    note: (t) => log("NOTE", t),
    /** Screenshot into the feature's video dir. */
    shot: async (name) => {
      const p = join(videoDir, `${name}.png`);
      await page.screenshot({ path: p, fullPage: true });
      return p;
    },
    /** Close everything and rename the video to <feature>.webm. */
    finish: async (videoName = feature) => {
      const video = page.video();
      await context.close();
      await browser.close();
      if (video) {
        const src = await video.path();
        const dest = join(videoDir, `${videoName}.webm`);
        try {
          renameSync(src, dest);
        } catch {
          /* keep original name */
        }
      }
      if (consoleErrors.length) {
        appendFileSync(
          reportPath,
          `\n## Console errors\n\n${[...new Set(consoleErrors)].map((e) => `- ${e}`).join("\n")}\n`,
        );
      }
      const fails = findings.filter((f) => f.startsWith("- [FAIL]") || f.startsWith("- [BUG]"));
      console.log(`\n${feature}: ${findings.length} checks, ${fails.length} fail/bug`);
      return fails.length;
    },
  };
}

/** Wait for a page to settle (network idle, bounded). */
export async function settle(page, ms = 1500) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/* ---------- test data helpers ---------- */

const PRODUCT_CODE_HINTS = {
  select: ["select"],
  blueRoyale: ["blue", "royale"],
  flexiShield: ["flexi", "shield"],
  bcFlexi: ["bc"],
  travelSafe: ["travel"],
};

/** Returns { select, blueRoyale, flexiShield, bcFlexi, travelSafe } product rows. */
export async function loadProducts() {
  const { data, error } = await db.from("products").select("*");
  if (error) throw new Error(`products: ${error.message}`);
  const out = {};
  for (const [key, hints] of Object.entries(PRODUCT_CODE_HINTS)) {
    out[key] = data.find((p) => {
      const hay = `${p.name ?? ""} ${p.code ?? ""}`.toLowerCase();
      return hints.every((h) => hay.includes(h));
    });
  }
  out.all = data;
  return out;
}

/** Insert a labelled test client; extra columns override defaults. */
export async function createTestClient(label, extra = {}) {
  const row = {
    first_name: QA_PREFIX,
    last_name: label,
    email: `qa-oct2-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@example.invalid`,
    mobile_number: "09170000000",
    lifecycle_stage: "Lead",
    status: "Active",
    ...extra,
  };
  const { data, error } = await db.from("clients").insert(row).select("*").single();
  if (error) throw new Error(`createTestClient(${label}): ${error.message}`);
  return data;
}

/** Any client created by QA (by first_name prefix). */
export async function listTestClients() {
  const { data, error } = await db.from("clients").select("*").ilike("first_name", `${QA_PREFIX}%`);
  if (error) throw new Error(error.message);
  return data;
}
