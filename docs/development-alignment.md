# Development Alignment Register

Last reconciled: **2026-08-14**.

This register connects the canonical specification in [`../../docs/`](../../docs/INDEX.md) to the
current application. It prevents implementation adapters from being mistaken for changed client
requirements and keeps known gaps explicit.

## Authority

1. `../../docs/` defines current business intent, UI behavior, and workflows.
2. `app/docs/` explains implementation and contains a dated June 2026 historical baseline.
3. Code and migrations show what exists today. A mismatch is a tracked gap, not an implicit spec
   change.

`TO-BE-UPDATE-PLAN.md` is a local working checklist and is intentionally not part of shared Git
history. Shared decisions must be reflected here or in the canonical documentation.

## Canonical-to-implementation mapping

| Canonical concept | Current implementation | Classification / note |
| :--- | :--- | :--- |
| One contact record per person | Physical table `public.clients`; child records use `client_id` | Intentional naming adapter. Do not add a parallel `contacts` table. |
| Contact identity | UUID `clients.id` internally; human `clients.reference_no` in the UI | Intentional adapter from the earlier numeric `record_id` description. |
| Email deduplication | Email is nullable and not uniquely constrained at the database layer | Code gap: add business duplicate detection and decide how shared household emails are handled before enforcing uniqueness. |
| Admin / Staff / Agent | Database roles Owner / Admin / Assistant / Viewer are mapped by `lib/auth/permissions.ts` | Intentional adapter; UI language remains Admin / Staff / Agent. |
| Lead stage and status | Stored on the unified client/lead record and written through repositories/actions | Aligned; `../../docs/lead-stage-status*.md` remains lifecycle truth. |
| Lead Lifecycle filters | One shared client-side filter popover applies multi-select Status, Product Interest, and overdue follow-up criteria across Board, List, and Forecast; page-level KPIs and supporting widgets remain global | Intentional extension: canonical `web/pages.md` specifies persistent Stage / Status / Owner / Product filters, while the overdue-only criterion was added by the 2026-08-14 Lead board filter request. |
| Commissions | Standalone `/commissions` route plus Payments sub-tab, both using the shared commissions component/repository | Canonical navigation updated to match the delivered slice. |
| Pacific Cross officers | `external_contacts` repository and Settings interface | Aligned; production recipients still require human verification. |
| Application requirements | Persisted checklist records plus verified-only completeness on the Applications register | Aligned; filters/sorting distinguish Complete, In review, Missing, Draft, and Not initialized. |
| Carrier assets | `document_library` plus communication-version links from migration `0023` | Aligned; library starts empty until assets are redacted and approved. |
| Email and attachment delivery | `communications.delivery_status = logged`; selected document versions are recorded | Deliberate safety boundary: nothing is actually delivered without a provider. |
| Proposal `Sent` | `Mark Sent` button (Contact Profile proposal panel + Leads board proposal-tracking panel; `setProposalStatusAction`, `app/(app)/prospects/actions.ts`) lets staff manually confirm delivery | Aligned as of 2026-08-13 for the manual half (`Mark externally sent`, reworded to `Mark Sent` — see note below). The automatic half (advancing on real provider-confirmed delivery) remains a gap: no email provider is wired up yet. |
| Lead status `New → Attempted` on send | `sendEmailAction` (`app/(app)/clients/engage-actions.ts`) sets `lead_status = Attempted` on any successful email/brochure log, regardless of delivery | **Doc conflict, resolved 2026-08-13 in favor of code as written.** `../../docs/web/lead-workflow.md:65` and this file's own "Proposal `Sent`" row above say logging alone must not advance status without provider confirmation or an explicit `Mark externally sent` action. But the parent workspace's `CLAUDE.md` explicitly directs *"Lead-lifecycle behavior must follow `docs/lead-stage-status.md` (+ `-example.md`)"*, and that file states plainly: *"New → Attempted \| Send Email / Send Brochure (first touch) \| Eman's send sets this; no Lead reply required yet."* Kept matching `lead-stage-status.md` per that explicit instruction. `docs/INDEX.md` ranks `web/lead-workflow.md` as canonical and `lead-stage-status.md` as a secondary "plain-language explainer" — the two root docs disagree and this has not been reconciled between them. Note the asymmetry this leaves: `lead_status` now auto-advances on mere logging, while `proposal_status = Sent` (row above) still requires the explicit `Mark Sent` click — whoever owns doc reconciliation should resolve which rule (auto-advance-on-log, or require-explicit-confirmation) should actually govern both, since they currently behave differently for what the docs describe as the same underlying rule. |
| `Mark externally sent` wording | Implemented as **`Mark Sent`**, not the docs' literal phrase | The docs (`lead-workflow.md`, `contact-profile.md`, `data-model.md`, `build-roadmap.md`) only ever use `Mark externally sent` as a mechanism name in backticks, never as prescribed UI copy. Renamed for the shipped button because "externally" collides with this app's distinct "External Contacts" concept (the Pacific Cross officer directory) and reads as ambiguous to Eman. `Mark Sent` mirrors the existing sibling button `Mark Received` in the same panel. |
| `Send Brochure` / `Send Intake / Application Form` as Lead Lifecycle **board** quick actions | Removed from the `/prospects` board header (`components/hub/screens/prospects-live.tsx`); both templates remain reachable from the Contact Profile composer's single template dropdown (`EmailForm`, `components/hub/overlays/send-email.tsx`) and its nurture chips (`contact-profile.tsx`) | **Doc conflict, resolved 2026-08-14 in favor of code as changed.** `../../docs/web/lead-workflow.md:45` lists these as "Available from the Contact Profile **and as Lead Lifecycle quick actions**" — i.e. the board too. `TO-BE-UPDATE-PLAN.md`'s Phase D UX audit flagged the board copies as redundant: both opened `EngageDrawer` with no contact in scope, forcing a lead search before landing on the exact same `EmailForm` the per-lead composer already exposes with a full template picker (including these two templates) once a lead is open. Since the composer covers the identical flow with no loss of capability, the board buttons were removed as duplicate surface area rather than kept to match the doc literally. `Request Proposal`, `Generate Proposal`, and `Log Call` were not template-driven `Email` composer actions (Log Call is a structured form; Request/Generate Proposal are their own modals), so they were out of scope for this collapse — **since removed on 2026-08-15, see the row below.** The corresponding `ENGAGE_ACTIONS` map entries (`components/hub/overlays/engage.tsx`) were removed alongside the buttons since nothing else called `openEngage` with those action names. |
| `Unresponsive` inference | `lib/queries/lead-status-inference.ts`, applied on read in the Prospects board and Contact Profile loaders | Aligned as of 2026-08-14. `../../docs/lead-stage-status.md:41,47` specs this as "System: N follow-ups with no reply — no button, an automatic count"; N=3 outbound `communications` rows with no inbound reply or Reached call breaking the streak, applied only to `Attempted`/`Nurturing` (the only two spec-listed source statuses). Deliberately **computed live on every read and never written to `clients.lead_status`** — this app has no cron/scheduled-job infrastructure, and leaving the stored value untouched means the existing win-back checks in `engage-actions.ts` (literal `=== "Attempted"` etc.) keep firing unmodified once a reply lands, instead of needing to also match `"Unresponsive"`. |
| Convert-to-Application carry-over of Discovery `familySize` / `coverageTier` | Not implemented; only `dob` (`Client.dateOfBirth`) is threaded through `WizardPrefill` into the wizard's Step 2 date-of-birth field (`components/hub/overlays/wizard/new-application.tsx`, `components/hub/screens/contact-profile.tsx`) | Code gap, left visible deliberately (2026-08-15). `WizardForm` (`components/hub/overlays/wizard/wizard-data.ts`) has no `familySize` field and no `coverageTier` field. It does have a `coverage` field, but that is a health-category "Individual"/"Family" household-type selector, semantically unrelated to a Discovery plan tier (e.g. Bronze/Silver/Gold) or a headcount — mapping either lead field into `coverage` would be a silent, guessed behavior change. Adding dedicated `WizardForm` fields for these is a schema/UX decision out of scope for the date-of-birth carry-over fix; not carried forward pending that decision. |
| `Request Proposal` / `Generate Proposal` / `Log Call` as Lead Lifecycle **board** quick actions | Removed from the `/prospects` board header (`components/hub/screens/prospects-live.tsx`); all three remain reachable pre-scoped to the lead from the Contact Profile nurture chip row (`contact-profile.tsx:231-242`) | **Doc conflict, resolved 2026-08-15 in favor of code as changed.** `../../docs/web/lead-workflow.md:45` and `../../docs/web/pages.md:74` both still list these as board-level quick actions (`pages.md:74` is already partly stale — it also still lists the Send Intake Form/Send Brochure buttons removed the same day, and a "Convert to Application" board button that has never existed in code). Same redundancy as the `Send Brochure`/`Send Intake Form` row above: with no lead in scope, all three detoured through a `ClientPicker` search before landing on the exact same modal/form the Contact Profile already opens pre-scoped, with a required date field (Log Call's discovery capture) or a proposal-status precondition (Request/Generate Proposal) that a search-first flow adds no value to. The board header now only has `New Lead` plus the view toggles and filter. `ENGAGE_ACTIONS` (`engage.tsx`) had no entries for these three, so no map cleanup was needed. The Proposal Tracking panel's own per-lead `Generate Proposal` button (`prospects-live.tsx`, a different, already-lead-scoped call site) is untouched. |

| Dashboard export row scoping for the `agent` role | `app/api/dashboard/export/route.ts` gates on `can(role, "dashboard", "export")` but returns the same full dataset to every role — no per-row filtering | Known gap, deferred deliberately (2026-08-17). `MATRIX.dashboard.agent = "own"` (`lib/auth/permissions.ts:42`) implies an agent should see only their own records, and the export widens what one request returns from the ~12 rows the cards render to up to 500 per queue. It ships unscoped because `app/(app)/dashboard/page.tsx` itself has no row scoping either — scoping only the export would make the file disagree with the screen it is named after, which is the more confusing failure. All six users currently in `users` are Owner/Admin (→ `admin`); no staff or agent account exists, so nothing is over-exposed today and the branch could not be exercised if written. Revisit together with dashboard-page scoping when the first real agent account is created. |
| Dashboard export visual styling | Column widths, number formats (`"₱"#,##0.00`, `yyyy"-"mm"-"dd`), merged title rows and autofilters — but no bold/coloured header cells and no frozen header row | SheetJS community edition cannot style cells (bold/fill/borders are a paid-tier feature) and has no `!freeze` handling at all — verified, the string appears nowhere in the shipped library, so setting it would be a silent no-op. Readability is therefore carried entirely by layout. Note the format strings are quoted deliberately: the obvious spellings (`₱#,##0.00`, `yyyy-mm-dd`) silently degrade in the **ODS** writer to `1,250,000.00` and `20260803`, since SheetJS's ODF writer drops unquoted literal characters. Both formats were verified by writing each file type and reading the rendered output back through LibreOffice. |

## Known differences to keep visible

### Intentional adapters

- Canonical “contact” is implemented by `clients`; this is one unified person record, not a
  separate prospect/client conversion pair.
- UUIDs are the relational keys. `reference_no` supplies the readable identifier.
- Database roles are normalized into the three product personas by the permissions layer.

### Code gaps

- Email duplicate prevention is not database-enforced.
- Agent Settings/external-contact visibility and Staff external-contact edit access are broader in
  the current permission matrix than the canonical settings rules. Sensitive settings and
  carrier-library administration must remain denied.
- Logging a proposal email is not sufficient evidence for `proposal_status = Sent`.
- Some dashboards, reports, and long-tail operational flows still use prototype or partial data.

### Superseded baseline assumptions

- The June blueprint's separate Prospect record and conversion-created Client record.
- A single-route, localStorage-backed SPA with no database or authentication.
- A committed Resend/Evolution delivery schedule. Provider selection and delivery automation are
  not implemented.
- Client Hub portal delivery as part of the current staff application.

## Migration and deployment state

- Migration files exist through `0024_application_requirements.sql`; the next source migration is
  `0025_*`.
- Presence in source does not prove remote deployment. Check the target Supabase migration list
  before release.
- Regenerate `lib/supabase/types.ts` after applying migrations and review the diff.
- Carrier-library and application-requirements UI must not be considered deploy-ready until their
  migrations exist remotely.

## Carrier-document rules

- Source material remains in `../../docs/attachments/`; do not duplicate it into this repository.
- Do not ingest illustrative proposals, CAC, TAL, renewal, or travel documents until redacted and
  approved.
- Store approved library files in the private `documents` bucket under `library/`.
- A communication records the exact selected library versions, but that record is not proof of
  delivery.
- **Required attachments on `Send brochure` / `Send application form` are an implementation rule
  with no canonical source (recorded 2026-08-13).** `../../docs/web/pages.md:321` and `:361` grant
  composers the *capability* to select "active, approved Carrier Library assets" and constrain
  *which* versions qualify — neither the canonical repository nor this one states that an
  attachment is *mandatory*. The code nonetheless refuses those two templates without one
  (`attachmentRequirement`, `app/(app)/clients/engage-actions.ts`). As of 2026-08-13 that rule is
  enforced uniformly on every composer, the New Client Application wizard's Step 5 included
  (`app/(app)/applications/wizard-actions.ts`) — previously the wizard was the sole ungated path.
  Keeping one surface exempt was the larger divergence, since `pages.md:321` names "the application
  wizard" among the composers that select library assets. If the client intends these templates to
  be sendable without an attachment, the requirement — not the wizard — is what should be relaxed.
- `document_library` ships empty by design, not by oversight: `../../app/TO-BE-UPDATE-PLAN.md:46`
  calls it "the intentional pre-clearance state" and `:191` "the library ships empty pending
  distribution clearance" (R4, `:89-92`). Confirmed still empty on the shared dev project
  2026-08-13. Consequence for the rule above: both gated templates are currently unusable on
  **every** composer, and each one explains why in place rather than failing silently.
  Source assets live in `../../docs/attachments/` and are mostly already received — the Select and
  Blue Royale brochures and both application-form age bands are ticked in that folder's
  `checklist.md`. What blocks ingestion is the unchecked distribution clearance
  (`checklist.md:70-71`), not missing files; only the FlexiShield and Travel brochures are
  genuinely outstanding (`checklist.md:112`, `:115`).

## Reconciliation checklist

When behavior changes, update all three layers deliberately:

1. Confirm the business rule in `../../docs/web/` and lifecycle source files.
2. Update code/migrations and tests.
3. Update this mapping and the build roadmap.
4. Search both repositories for superseded wording and broken links.
5. Commit changes inside each independent repository, never at the parent workspace.
