<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working in this repo

## Plan before writing code

Always plan before you write or change code:

1. Understand the request, then read the relevant context (see below) and the existing code.
2. Reuse existing patterns and utilities instead of inventing new ones.
3. Lay out the approach — and confirm it — before implementing.

Don't jump straight to edits. A short, grounded plan first prevents rework.

## Find the right source of truth

The two colocated repositories have different documentation roles:

1. The parent workspace [`../docs/`](../docs/INDEX.md) is authoritative for current business
   intent, UI behavior, workflows, and client decisions. Start at `../docs/INDEX.md`.
2. This repository's [`docs/`](docs/README.md) is the implementation companion: current build
   status, implementation mappings, and a dated June 2026 baseline converted from the client's
   earlier Word documents.
3. Code and Supabase migrations are the truth for what is implemented. If implementation differs
   from the canonical spec, record the difference in
   [`docs/development-alignment.md`](docs/development-alignment.md); do not silently rewrite the
   business requirement to match the code.

Read the relevant canonical spec and the alignment register before implementing a feature. The
legacy folders below remain useful background, but are not the latest product specification.

- `docs/foundation/` — vision, scope, terminology, system & module architecture
- `docs/data-model/` — database schema
- `docs/frameworks/` — cross-cutting rules (audit trail, automation, dashboards/KPIs, document storage, reference numbering, search)
- `docs/modules/` — per-module blueprints (Client Hub, Prospect Pipeline, Relationship Events, Travel)
- `docs/workflows/` — the 8 operational workflows

## Stack & data layer

Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres / Auth / Storage).
Data access goes through the repository layer in `lib/repositories/` over **supabase-js with the
service role** — no Prisma. Copy the `Clients` repository (interface + supabase implementation +
factory) as the pattern for new entities.

## Playwright MCP (E2E)

The Playwright MCP browser is configured to start **pre-authenticated** as a test staff account, so
sessions skip the login flow. Credentials live in `.env.local` (`PLAYWRIGHT_TEST_*`); the saved
browser session is `.auth/staff.json` (gitignored — it holds a live token), loaded by the MCP via
`--storage-state` in `.mcp.json`.

(Re)generate the session on first setup, or whenever the MCP browser starts getting redirected to
`/login` (the saved refresh token expired):

1. Start the dev server at `PLAYWRIGHT_BASE_URL` (default 3010): `npm run dev -- --port 3010`.
2. `npm run auth:playwright` — provisions the account and writes `.auth/staff.json`.
3. Restart Claude Code so the Playwright MCP reloads the saved session.

To test the **login flow itself** (not pre-authed), use the library script `scripts/test-login.mjs`.
