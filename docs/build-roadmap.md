# Build Roadmap — Current Implementation State

> Engineering companion, last reconciled **2026-10-02**. The canonical product specification is
> in [`../../docs/`](../../docs/INDEX.md). See
> [Development Alignment](development-alignment.md) for mappings and known differences.

## Current platform

| Area | Current state |
| :--- | :--- |
| Application | Next.js App Router application with dedicated routes for the operational modules |
| Data | Supabase repositories and server actions; migrations through `0040` exist in source. The remote ledger was last verified through `0037` on 2026-08-27; verify `0038`–`0040` before release. |
| Authentication | Supabase Auth with protected routes and application roles |
| Storage | Private Supabase buckets for client documents and the carrier library |
| Communications | Composers create communication records only; no email provider delivers them yet |
| Testing | Unit/component checks plus pre-authenticated Playwright MCP for staff flows |

The old state-based SPA, clients-only repository, no-schema, and no-auth descriptions are
historical. They no longer describe this repository.

## Delivered vertical slices

- Unified people records, lead lifecycle, contact profile, group accounts, clients, and policies.
- Application creation and draft resume, including persisted application requirements and
  verified-only completeness reporting on the Applications register.
- Payments and Commissions, with a standalone `/commissions` route and the Payments sub-tab as a
  second entry point to the same component.
- Pacific Cross officer contacts with repository-backed list/create/edit administration and
  recipient selection.
- Carrier Document Library administration: upload, metadata, approval state, archive, and exact
  communication-to-document-version links.
- Source-dated Products catalog with 513 published carrier rates, quote-only BC Flexi, provenance,
  control totals, and audited Admin editing.
- Carrier Library seeded from an explicit allowlist. Follow-up migrations add authorization/reference
  document types and Excel enrollment-template support; the Proposal Information Sheet remains
  excluded pending a client decision.
- Proposal and Travel portal handoffs with upload-back flows for the resulting proposal or policy PDF.
- Six live Reports families with role scoping, drill-down, separate-currency metrics, and audited
  XLSX/ODS/CSV export.
- Tasks, documents, renewals, claims, travel, relationship management, email templates, and
  settings screens at varying levels of live-data completeness.

## Important limits

- **No outbound provider exists.** A composer action logs an intended communication with
  `delivery_status = logged`; it does not prove that an email or attachment was delivered.
- A logged email is not evidence of delivery. Proposal status `Sent` still requires the explicit
  staff action; lead lifecycle status follows the current engagement rules documented in
  [Development Alignment](development-alignment.md).
- Do not ingest excluded or client-identifiable carrier samples. The 2026-09 library load and its
  file-specific exclusions are documented in [Development Alignment](development-alignment.md).
- Several screens retain prototype data or partial workflows. A rendered screen is not evidence
  that the underlying process is production complete.

## Data and architecture rails

1. Author schema changes as ordered SQL migrations in `supabase/migrations/`.
2. After applying a migration to Supabase, regenerate `lib/supabase/types.ts`.
3. Put entity access behind `lib/repositories/`; use server actions for mutations.
4. Keep service-role credentials server-only and preserve audit/timeline writes.
5. Treat the next migration number as **`0041`** unless a newer migration has landed.
6. Verify remote migration state before claiming a feature is deployed. Source files alone do not
   prove a migration was applied.

## Near-term execution order

1. Profile and clean the received client workbook, produce a mapping/exceptions report, and obtain
   recency, deduplication, privacy, and import approval before loading production rows.
2. Resolve the remaining carrier decisions, including the Proposal Information Sheet, pre-approval
   record model, and any missing form or signer details; keep excluded assets out of the library.
3. Validate renewal medical triggers and the commission lifecycle with the client.
4. Keep the source-dated Product catalog reconciled as Pacific Cross issues new editions; do not
   derive unpublished instalments or combine currencies.
5. Keep calculated in-app proposal generation deferred for V1; use the configured carrier portals
   and keep portal credentials outside the app.

## Verification gate

For each completed slice:

1. Apply pending migrations and regenerate types.
2. Run lint/type/tests appropriate to the change.
3. Exercise the primary flow with the pre-authenticated Playwright session.
4. Verify RBAC and Agent record scoping.
5. Verify audit/timeline records and distinguish `logged` from provider-delivered communication.
6. Update [Development Alignment](development-alignment.md) when a spec mapping or gap changes.
