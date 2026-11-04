# Build Roadmap — Current Implementation State

> Engineering companion, baseline reconciled **2026-10-02**, renewal automation updated **2026-10-10**. The canonical product specification is
> in [`../../docs/`](../../docs/INDEX.md). See
> [Development Alignment](development-alignment.md) for mappings and known differences.

## Current platform

| Area | Current state |
| :--- | :--- |
| Application | Next.js App Router application with dedicated routes for the operational modules |
| Data | Supabase repositories and server actions; migrations through `0058` applied to the hosted project and genuine hosted types regenerated. `0041` remains reserved for import. |
| Authentication | Supabase Auth with protected routes and application roles |
| Storage | Private Supabase buckets for client documents and the carrier library |
| Communications | Gmail reading/push synchronization and the shared checklist picker plus non-disruptive Inbox freshness are released. Deployment `dpl_5N4uyzXopqKPdGTNics94c3D1KTi` is READY on the canonical production hostname, with authenticated HTTP/Storage acceptance. Outgoing composers still log rather than deliver email. |
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
- Renewal readiness (H5a/H5b, verified 2026-10-09–10): atomic policy-driven creation/date refresh,
  one open cycle per policy, preserved closed-cycle history, explicit Admin-only policy backfill,
  and separate carrier-notice receipt date/action/modal/list column. Receipt logging preserves
  later statuses and is idempotent. No renewal email scheduler or payment automation was added.
  Blue Royale fresh/switch/draft/persisted health requirements were also verified (H3b);
  the alleged HMO package was not reproduced.
- Renewal email automation (H5c–e, verified 2026-10-10): four configurable Admin rules and editable
  templates; receipt immediate, client reminder -30 days, missing-notice request -60 days and
  premium-breakdown request -60 days. SQL atomically queues one task/draft per rule/cycle.
  Staff review/save/log/dismiss from Tasks or dashboard; logging is transactional with completion,
  never email delivery or renewal-status advancement. Staff settings are read-only; Agent has
  no rule/draft access. Paid/inactive/do-not-contact work is suppressed, early payers skip reminders,
  and receipt cancels stale missing-notice work. Cron is configured for 08:00 Manila daily.
- Incoming Gmail: private forward-only ingestion, authenticated Pub/Sub, daily/manual recovery,
  role-scoped `/inbox`, staff-confirmed matching/filing and linked Received timeline evidence.
  Shared proposal receipt guards cover inbox and portal upload-back. Hosted `0052`–`0056` and
  generated types are applied; local UI, role boundaries and synthetic real-Storage filing passed.
  Production deployment, read consent, enablement and real watch/reconciliation are complete.
  The push parser correction is deployed: four real notifications returned 204 and background sync completed.
- Shared requirement attachment picker (2026-11-03): device/email sources across Application,
  Claim and Travel checklists and creation wizards, including already-filed originals.
  Hosted `0057` adds immutable sources, destination usages, guarded upload intents and atomic
  Received receipts preserving Verified. Explicit cross-record reuse does not move the email
  or original filing. Keyed wizard targets cover equal-name people and retained draft rows.
  Orca verification passed 250 tests, production build/TypeScript, 18 SQL/Storage and
  17 authenticated HTTP scenarios. No browser visual verification, per owner instruction.
- Non-disruptive Inbox freshness (2026-11-03): private complete-authorized-ID revision (`0058`),
  lightweight authenticated endpoint and visible/online polling with explicit refresh.
  Released together with the picker; 264 tests, lint (0 errors / 8 existing warnings),
  optimized build/TypeScript and canonical production HTTP/Storage acceptance passed.
  No browser visual/keyboard verification; see the release record in Development Alignment.
- Tasks, documents, renewals, claims, travel, relationship management, email templates, and
  settings screens at varying levels of live-data completeness.

## Important limits

- **No outbound delivery is enabled.** Gmail connection management is implemented separately;
  a composer still records `delivery_status = logged`, not actual email/attachment delivery.
- **Incoming mail does not interrupt an open Inbox.** Visible/online tabs check an authorized
  membership revision every 30 seconds and show **Inbox updates available**. Only explicit
  **Refresh inbox** reloads page 1, retaining the selected message ID. Hidden/offline tabs pause
  and check on return; transient failures preserve the view and session failures stop polling.
  The private `0058` RPC and endpoint never invoke Gmail Sync or advance business statuses.
- **Picker receipts are not verification or business approval.** New trips do not inherit older
  received files. Draft selections are not saved as attachments. Preview is limited to safe
  PDF/JPEG/PNG; other original formats remain downloadable. No new OAuth scopes or environment
  variables are needed.
- A logged email is not evidence of delivery. Proposal status `Sent` still requires the explicit
  staff action; lead lifecycle status follows the current engagement rules documented in
  [Development Alignment](development-alignment.md).
- Do not ingest excluded or client-identifiable carrier samples. The 2026-09 library load and its
  file-specific exclusions are documented in [Development Alignment](development-alignment.md).
- Several screens retain prototype data or partial workflows. A rendered screen is not evidence
  that the underlying process is production complete.
- **Production renewal cron is not activated here.** Set server-only `CRON_SECRET` in Vercel's
  Production environment, then deploy the committed `vercel.json` schedule/endpoint. Missing
  configuration returns 503; missing/wrong authorization returns 401. Local authorized/repeat runs
  passed. No push or production web deployment is claimed.

## Data and architecture rails

1. Author schema changes as ordered SQL migrations in `supabase/migrations/`.
2. After applying a migration to Supabase, regenerate `lib/supabase/types.ts`.
3. Put entity access behind `lib/repositories/`; use server actions for mutations.
4. Keep service-role credentials server-only and preserve audit/timeline writes.
5. The next local migration number is **`0059`**; verify the hosted ledger before use. **`0041`** remains reserved for the import schema.
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
