# Pacific Insurance PH — Operations Platform

Internal operations platform for **Pacific Insurance PH**, a Philippine insurance agency that
resells Pacific Cross insurance. It replaces a spreadsheet-and-email workflow with a single system
that manages the full client lifecycle — **prospect → application → policy → renewal → claim** —
plus travel insurance.

> **Status:** early development. The foundation (Next.js + Supabase repository layer) and the full
> client specification are in place; feature modules are being built out.

## What we're building

A two-surface application:

- **Staff workspace** — dashboard, client records, and the eight operational workflows (new
  business, medical-review and senior applications, renewals, amendments, reinstatement, claims,
  and travel fulfillment), each with configurable steps, document checklists, and status tracking.
- **Client Hub** — a token-based view (no login) where a client can follow their own
  application / policy / claim status and receive documents.

It's designed to be **configurable**: products, workflow steps, document requirements, and email
templates are data, not hardcoded — because Pacific Cross changes its products and rules over time.

The authoritative specification of what to build lives in [`docs/`](docs/README.md).

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) + React + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Database / Auth / Storage | Supabase (PostgreSQL) |
| Data access | Repository pattern over supabase-js (service role) |
| Email | Resend |
| PDF generation | @react-pdf/renderer |
| Hosting | Vercel |

## Architecture — data access

All database access flows through a repository layer; application code never touches supabase-js
directly:

```
Application (Server Components / Server Actions / Route Handlers)
        → Repository interface         lib/repositories/<entity>/<entity>.repository.ts
        → Supabase implementation      …<entity>.repository.supabase.ts
        → supabase-js (service role)   lib/supabase/admin.ts  (server-only)
        → Supabase Postgres
```

The service-role client bypasses Row-Level Security and is marked `server-only`, so it can never
leak into a browser bundle. Copy the `Clients` repository (interface + implementation + factory)
as the template for new entities. **No Prisma** — schema types are generated with
`supabase gen types`.

## Project structure

```
app/            # Next.js App Router — (staff)/ and (hub)/ route groups
components/      # UI; components/ui = shadcn/ui
lib/
  supabase/     # service-role admin client + generated DB types
  repositories/ # repository layer (Clients example to copy)
  env.ts        # validated environment access
docs/           # client specification — see docs/README.md
```

## Getting started

Prerequisites: **Node 20+** and a **Supabase** project.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase credentials
npm run dev                  # http://localhost:3000
```

Required environment variables (see [.env.example](.env.example)):

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** — never exposed to the browser |

Regenerate database types after a schema change:

```bash
npx supabase gen types typescript --project-id <ref> --schema public > lib/supabase/types.ts
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint |

## Documentation

- [`docs/README.md`](docs/README.md) — index of the client specification (foundation, data model,
  frameworks, modules, workflows).
- [`AGENTS.md`](AGENTS.md) — guide for AI agents and contributors: plan before writing code, and
  where to find context.

## Scope (V1)

**In:** client / policy / claim management, the eight workflows, the Client Hub, document
management, and transactional email.

**Out (by design):** online payment gateways, Pacific Cross API integration, portal automation,
a mobile app, AI features, SMS/Viber/WhatsApp, and client-side document uploads — all deferred to
later phases.
