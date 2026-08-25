# Build Roadmap — Current Implementation State

> Engineering companion, last reconciled **2026-08-26**. The canonical product specification is
> in [`../../docs/`](../../docs/INDEX.md). See
> [Development Alignment](development-alignment.md) for mappings and known differences.

## Current platform

| Area | Current state |
| :--- | :--- |
| Application | Next.js App Router application with dedicated routes for the operational modules |
| Data | Supabase repositories and server actions; migrations through `0037` exist in source and the remote ledger |
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
- Six live Reports families with role scoping, drill-down, separate-currency metrics, and audited
  XLSX/ODS/CSV export.
- Tasks, documents, renewals, claims, travel, relationship management, email templates, and
  settings screens at varying levels of live-data completeness.

## Important limits

- **No outbound provider exists.** A composer action logs an intended communication with
  `delivery_status = logged`; it does not prove that an email or attachment was delivered.
- Logging an email must not automatically change a lead from `New` to `Attempted` or set a
  proposal to `Sent`. Those transitions require confirmed provider delivery or an explicit
  `Mark externally sent` action.
- Carrier assets under `../../docs/attachments/` are research inputs only. Illustrative proposals,
  CAC, TAL, renewal, and travel samples must not be ingested until redacted and approved.
- Several screens retain prototype data or partial workflows. A rendered screen is not evidence
  that the underlying process is production complete.

## Data and architecture rails

1. Author schema changes as ordered SQL migrations in `supabase/migrations/`.
2. After applying a migration to Supabase, regenerate `lib/supabase/types.ts`.
3. Put entity access behind `lib/repositories/`; use server actions for mutations.
4. Keep service-role credentials server-only and preserve audit/timeline writes.
5. Treat the next migration number as **`0038`** unless a newer migration has landed.
6. Verify remote migration state before claiming a feature is deployed. Source files alone do not
   prove a migration was applied.

## Near-term execution order

1. Obtain Eman's remaining signer/PIS/CET/BMI/beneficiary/pre-approval answers and the missing
   Employer's Application attachment without ingesting unapproved samples.
2. Profile and clean the received client workbook, produce a mapping/exceptions report and obtain
   import approval; do not load production rows during this step.
3. Keep the deployed source-dated Product catalog reconciled when Pacific Cross issues new
   editions; never derive unpublished instalments or combine currencies.
4. Keep calculated in-app proposal generation deferred; use the separately configured proposal and
   Travel portal links for V1 and keep portal credentials outside the app.
5. Validate renewal medical triggers, pre-approvals and the commission lifecycle after Eman answers
   the remaining workflow questions.

## Verification gate

For each completed slice:

1. Apply pending migrations and regenerate types.
2. Run lint/type/tests appropriate to the change.
3. Exercise the primary flow with the pre-authenticated Playwright session.
4. Verify RBAC and Agent record scoping.
5. Verify audit/timeline records and distinguish `logged` from provider-delivered communication.
6. Update [Development Alignment](development-alignment.md) when a spec mapping or gap changes.
