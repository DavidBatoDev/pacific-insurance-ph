# Development Alignment Register

Last reconciled: **2026-10-02**; renewal automation updated **2026-10-10**.

This register connects the canonical specification in [`../../docs/`](../../docs/INDEX.md) to the
current application. It prevents implementation adapters from being mistaken for changed client
requirements and keeps known gaps explicit.

## Authority

1. `../../docs/` defines current business intent, UI behavior, and workflows.
2. `app/docs/` explains implementation and contains a dated June 2026 historical baseline.
3. Code and migrations show what exists today. A mismatch is a tracked gap, not an implicit spec
   change.

The archived `docs/archive/` plans record completed investigations and past execution checklists;
they are historical references, not active sources of task status. Current priorities belong in
`docs/build-roadmap.md`. Shared decisions must be reflected here or in the canonical documentation.

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
| Application requirements | Persisted checklist sections `Basic intake` / `Application documents` / `Medical requirements`, separate from BC Flexi's original phase gates; verified-only completeness remains unchanged | Verified 2026-11-06 against supplied `REQUIREMENTS.md`: fresh Select, Blue Royale, FlexiShield, BC Flexi and Travel preview/persisted parity; remote/face-to-face alternatives, first-layer documents, conditional TAL/CAC and BC Flexi's 13-item agreement activation retained. Legacy null sections use an exact read-only label fallback, not a checklist rewrite. This is engineering source comparison, not fresh Eman sign-off. |
| Blue Royale requirements (H3b) | Primary Medical catalog category; shared keyed health builders, not HMO templates | The alleged HMO package was not reproduced. Authenticated BC Flexi → Blue Royale switching and Blue Royale draft resume verified 2026-11-06: health sections and regular form, no corporate/HMO rows. Existing persisted-checklist drafts cannot change product and silently reassign original documents; fresh drafts can switch. Requirement keys, row IDs and staged attachment identities are preserved. |
| Internal medical review | Six workflow steps: Requirements → Medical review → Email Pacific Cross → Pacific Cross reply → Payment → Log policy copy; terminal progress 7 | User-approved agency gate, not a new carrier underwriting requirement. Exact individual-health products Select / Blue Royale / FlexiShield and persisted principal/dependent `Yes` declarations trigger review; No/Unknown, BC Flexi and Travel do not. Staff-entered class (1–500 characters), distinct persisted-insured questionnaire associations and Verified medical originals are required. Senior Yes keeps both examination and questionnaire. Agent is scoped read-only; real active Admin/Staff clear. |
| Medical review submission boundary | Migration `0061` service-role-only locked clearance/recovery RPCs and material-input invalidation; authoritative eligibility shared by TypeScript preparation and SQL prepare/claim | Verified 2026-11-06: missing/unverified originals, blank/oversize class, missing/foreign/duplicate mappings, stale revision and Agent/inactive rejection; exact replay audits once. Material declarations/medical requirements/originals invalidate clearance while retaining class; unrelated billing and trim-only/no-op changes do not. Concurrent review, invalidation and dispatch-source locking serialized on the application row. Rollback prepare → invalidate → claim rejected without dispatch. |
| Historical medical questionnaire recovery | Explicit staff action creates one Pending questionnaire item for a persisted affected insured when historical checklists have none | No evidence is invented or auto-verified. Staff upload the original, verify the checklist, explicitly associate it and clear review. Existing exact questionnaire rows can instead be associated under the locked RPC; names, including identical dependent names, never establish identity. |
| Policy-driven renewals (H5a) | Migration `0047` locks each policy and synchronizes its renewal in the policy transaction; Admin `Sync policies` invokes the same routine for every Active policy | Renewal date takes precedence over expiry; Travel needs an explicit renewal date. One open cycle per policy; only source dates refresh. Paid/Renewed/Lapsed cycles retain history. No automatic page-load backfill or inactive-policy cancellation. SQL rollback, concurrent RPC, actual policy create/edit, repeated backfill and direct Staff rejection verified 2026-10-09–10. |
| Carrier renewal notice receipt (H5b) | Separate nullable `renewals.notice_received_date`, receipt action/modal and sortable list column | Receipt advances only Upcoming → Notice Received, preserves every later status and audits/timelines actual changes. Repeated saves are no-ops. Legacy sent-notice data is not reinterpreted/backfilled. Receipt never sends/logs an email; existing Send notice remains logged-only and retains receipt. UI and action boundaries verified 2026-10-10. |
| Renewal email rules and interim execution (H5c–e / DH10) | Migration `0048`, `renewal_email_rules` and separate `renewal_email_drafts`; repository/actions, Settings Notifications, Tasks/dashboard review modal, secret-protected `/api/cron/renewals` | User approved four Email-only draft/task cases: receipt immediately, reminder -30 days, missing notice -60 days and premium breakdown -60 days regardless of premium change. Existing Thea record selected, configurable by Admin. Staff view/review; Agent denied both payload and direct read/write. Broader canonical WhatsApp/payment/missing-document/auto-send automation remains outside this interim. No provider delivery or renewal-state advancement occurs. |
| Renewal draft history and staff ownership | SQL unique `(renewal_id, rule_id)` and row locks; task/draft insert and explicit email-log/task completion are transactional | Closed/ineligible work is suppressed; pending drafts are dismissed/cancelled, including missing-notice work after receipt. Early payer suppresses client reminders, not informational receipt. Draft source dates/context can refresh, but template/recipient snapshots and edited copy remain staff-owned; changed template/contact selections apply to newly queued drafts. Completed/dismissed/logged work is never automatically re-created for the same cycle. Checkbox completion does not log email. Revision checks reject stale forms; repeated committed logs reuse their communication. |
| Renewal cron activation | `vercel.json` keeps `sin1` and adds `0 0 * * *` (08:00 Manila); only the exact endpoint bypasses session proxy and enforces `CRON_SECRET` itself | Local missing configuration (503), missing/wrong token (401), authorized/repeated calls (200), and sibling-route login protection verified. Set `CRON_SECRET` in Vercel Production and deploy before claiming live scheduling. No push or Production web activation performed here. |
| Carrier assets | `document_library` plus communication-version links from migration `0023` | Loaded 2026-09-07 and extended through 2026-09-25: 40 source files represented by 49 library rows, including CCAF, Geographical Loading, and the CET. The 5 `TEST —` placeholders are archived. Distribution clearance was treated as not-a-gate by client decision — see Carrier-document rules. |
| Travel post-issuance pack (H6e) | Separate client originals (`Travel Policy`, `Travel Application Copy`) and three strictly matched shared-library slots; real active-user boundaries on pack reads/downloads, Admin/Staff-only filing and scoped upload initiation | Engineering verified 2026-11-06: distinct originals uploaded through authenticated Staff UI, reopened and downloaded with matching SHA-256; signed intake remained Verified. Download matrix: anonymous login redirect, inactive 403, assigned Agent allowed, foreign Agent 404; direct Agent filing, inactive upload, foreign-client path and >25 MB upload rejected. Existing TravelSafe NOC downloaded successfully. **Blocked on genuine Travel emergency numbers and COVID-19 coverage PDFs**: all three approved historical Gmail queries exhausted (one 100-result-limit page each, zero messages/candidates); no substitutes or mailbox/CRM backfill. Neither unavailable reference is claimed complete. |
| Email and attachment delivery | Migration `0059`: private `gmail_outbound_messages` ledger with prepare → claim → send → finish → apply-effects RPCs; `lib/communications/outbound-email.ts`, `lib/gmail/send-api.ts`, `outbound-mime.ts`, shared `EmailSendControls`. `communications.delivery_status` is `prepared`/`sending`/`sent`/`failed`/`unknown`, historical `logged` | Implemented 2026-11-04 for **reviewed individual emails** (Engage composer, missing documents, billing, Pacific Cross submission, proposal request/delivery, renewal drafts, wizard post-create review, Inbox Reply). Admin/Staff only, from `admin@pacificinsuranceph.com`, real file attachments, one dispatch per claimed intent, no automatic retry. `Sent` means Gmail accepted it, not delivery/reading. Business effects run only after acceptance. Campaigns, bulk payment links and the renewal cron stay log-only/draft-only. **Discovered constraint:** Gmail's send API replaces the supplied Message-ID and Date, so uncertain outcomes are reconciled by the server-built `X-PIPH-Outbound-ID` header within a sent-mail window, not `rfc822msgid:`. Live QA evidence is in [TESTING.md](../TESTING.md#november-4-real-gmail-sending-and-replies). |
| Gmail connection and incoming correspondence | Admin OAuth and Settings controls, private inbox repository, `/inbox`, authenticated Pub/Sub, daily reconciliation, attachment filing and non-disruptive update banner; migrations `0051`–`0058` | Production reading/push and the picker/freshness web release are verified on November 3. Admin reviews unassigned mail; Staff sees released mail; Agent sees assigned-client mail. Polling announces membership changes without navigation; refresh is explicit and retains the selected ID. Matching/filing remain human-confirmed. No outgoing delivery or automatic approval/verification. |
| Checklist attachment sources | Shared device/email picker for Application, Claim and Travel requirements and creation wizards; private source/usage/upload repositories and migration `0057` | Released with freshness in `dpl_5N4uyzXopqKPdGTNics94c3D1KTi`. Canonical production authenticated HTTP/Storage checks proved listing, new/repeated receipts, Verified preservation, cross-record acknowledgement, private previews/downloads, original/ZIP bytes and signed native upload. No visual/keyboard browser verification was performed, per the owner's instruction. |
| Proposal `Sent` | **Email proposal** (proposal-delivery origin) sends the current Illustrative Proposal and moves Received → Sent only after Gmail acceptance; **Mark sent manually** (`setProposalStatusAction`) remains for proposals sent outside the CRM | Aligned 2026-11-04. The manual action is explicitly not Gmail evidence. |
| Lead status `New → Attempted` on send | SQL `apply_gmail_outbound_email_effects` sets `lead_status = Attempted` once, only for a contact-origin email Gmail accepted, and returns the stage advance as a suggestion | Resolved 2026-11-04: both `lead-workflow.md` (no advance on mere logging) and `lead-stage-status.md` (first-touch send sets Attempted) now hold, because the advance happens only on Gmail acceptance. Unresponsive inference likewise counts only accepted Gmail (`delivery_status = 'sent'`); historical log-only rows no longer count as outreach and stored statuses were not rewritten. |
| `Mark externally sent` wording | Implemented as **`Mark Sent`**, not the docs' literal phrase | The docs (`lead-workflow.md`, `contact-profile.md`, `data-model.md`, `build-roadmap.md`) only ever use `Mark externally sent` as a mechanism name in backticks, never as prescribed UI copy. Renamed for the shipped button because "externally" collides with this app's distinct "External Contacts" concept (the Pacific Cross officer directory) and reads as ambiguous to Eman. `Mark Sent` mirrors the existing sibling button `Mark Received` in the same panel. |
| `Send Brochure` / `Send Intake / Application Form` as Lead Lifecycle **board** quick actions | Removed from the `/prospects` board header (`components/hub/screens/prospects-live.tsx`); both templates remain reachable from the Contact Profile composer's single template dropdown (`EmailForm`, `components/hub/overlays/send-email.tsx`) and its nurture chips (`contact-profile.tsx`) | **Doc conflict, resolved 2026-08-14 in favor of code as changed.** `../../docs/web/lead-workflow.md:45` lists these as "Available from the Contact Profile **and as Lead Lifecycle quick actions**" — i.e. the board too. `TO-BE-UPDATE-PLAN.md`'s Phase D UX audit flagged the board copies as redundant: both opened `EngageDrawer` with no contact in scope, forcing a lead search before landing on the exact same `EmailForm` the per-lead composer already exposes with a full template picker (including these two templates) once a lead is open. Since the composer covers the identical flow with no loss of capability, the board buttons were removed as duplicate surface area rather than kept to match the doc literally. `Request Proposal`, `Generate Proposal`, and `Log Call` were not template-driven `Email` composer actions (Log Call is a structured form; Request/Generate Proposal are their own modals), so they were out of scope for this collapse — **since removed on 2026-08-15, see the row below.** The corresponding `ENGAGE_ACTIONS` map entries (`components/hub/overlays/engage.tsx`) were removed alongside the buttons since nothing else called `openEngage` with those action names. |
| `Unresponsive` inference | `lib/queries/lead-status-inference.ts`, applied on read in the Prospects board and Contact Profile loaders | Aligned as of 2026-08-14. `../../docs/lead-stage-status.md:41,47` specs this as "System: N follow-ups with no reply — no button, an automatic count"; N=3 outbound `communications` rows with no inbound reply or Reached call breaking the streak, applied only to `Attempted`/`Nurturing` (the only two spec-listed source statuses). Deliberately **computed live on every read and never written to `clients.lead_status`**; the renewal cron added by H5e does not run Lead inference. Keeping the stored value untouched means existing win-back checks in `engage-actions.ts` keep firing once a reply lands without needing to also match `"Unresponsive"`. |
| Convert-to-Application discovery carry-over | `WizardForm` schema v4 carries `familySize`, `coverageTier` and explicit `selectVariant`; conversion and draft save/resume write the unified client's preference | Verified 2026-11-06: Plus survives conversion/save/resume; switching to Standard clears the incompatible Plus plan. Room preference matches only within an explicitly selected family. Old drafts derive a variant only from their exact selected plan family or exact legacy variant interest; ambiguous tier-only drafts stay blank. Superseded resume requests cannot overwrite current form state. No duplicate application/policy variant column. |
| BC Flexi application and two-phase requirements | A completed Group HMO wizard creates both the company-level `group_accounts` record and a canonical `applications` row for its primary contact; migration `0035_requirement_phase.sql` snapshots four `For proposal` requirements and thirteen initially non-required `Once the group agrees` requirements | Aligned as of 2026-08-24. The Group Account remains the operational roster view, while the Application owns checklist completeness, document links, and missing-document communication. `Mark agreed` activates the second gate as one audited, idempotent action. The initial G9 implementation exposed that fresh Group HMO submissions skipped `applications` entirely (draft-resume did not); the shared application-create path now covers both entry paths. |
| Pacific Cross portal handoffs | Proposal generation and Travel fulfillment use separately configurable HTTPS URLs; credentials are not stored. Both portals open in a sized pop-up window (`components/hub/overlays/portal-window.ts`) — neither can be embedded: the Travel portal sends `X-Frame-Options: DENY` and the proposal portal's session cookies are `SameSite=Lax`, so an iframe on our domain loses the login. Opening the proposal portal sets `proposal_status = Requested` (generation started); `Received` is set only when the illustrative proposal PDF is uploaded back (`recordProposalReceivedAction`, stored as a client document of type `Illustrative Proposal`) or by the explicit `Mark Received without PDF` fallback. Travel: marking the portal step `Issued` requires the portal-issued policy number, and the issued policy PDF can be uploaded back as a `Travel Policy` document | Corrected 2026-08-24 from the earlier C2a behavior that marked `Received` merely for opening a third-party tab. **Extended 2026-09-25** with the pop-up + upload-back flow, per the client decision (2026-09-25) that the portal PDF *is* the official illustrative proposal. That also fixes a gap in the 2026-08-24 version: opening the portal set no status at all, and `Mark Received` only renders from `Requested`, so individual-product leads had no path forward. HMO requests now default their follow-up task to `HMO_PROPOSAL_TURNAROUND_BUSINESS_DAYS` (5, a placeholder — the real turnaround varies by HMO and is unconfirmed). Carrier purchase and policy issuance remain manual, consistent with the canonical V1 boundary. |
| Eman client workbook | `EWMS List Of Client as of October 2024.xlsx` received 2026-08-24; 15 sheets and 105 nonblank Masterlist data rows identified | Receipt is complete, import is not. No client rows were loaded. Recency confirmation, privacy clearance, profiling, normalization, mapping, deduplication, exception review, dry run and approval remain mandatory. |
| 2026-08-24 carrier follow-up | Clean Travel form only; current document editions confirmed; Easy Payment retired; FlexiShield first-layer documents client-supplied; BC Flexi PDF enrollment derives from CET and Secretary's Certificate is client-supplied | Subsequent app work added CET member fields (`0030`), BMI capture (`0033`), beneficiary capture (`0034`), and the two-phase BC Flexi checklist (`0035`). CET remains carrier-provided, not generated as a spreadsheet. Client decisions still open include the Proposal Information Sheet recipient, officer-attestation signer, missing Employer's Application, renewal medical triggers, pre-approval record model, and partial commission rules; see `../../docs/message.md`. |
| Migration `0036` deployment | Idempotent source migration renames the legacy proposal integration key, adds the Travel portal row and corrects two BC Flexi requirement notes | Deployed and verified in the remote migration ledger on 2026-08-26. |
| Source-dated carrier product/rate catalog | Migration `0037_carrier_rate_catalog.sql`, Products repository and Admin catalog editor cover versions, plans, add-ons, discounts and published rates; Staff/Agent remain read-only | Deployed 2026-08-26 with 513 explicitly published rate rows: Select 220, Blue Royale 82, FlexiShield 14 and TravelSafe 197. BC Flexi is quote-only. Semi-annual instalments are not derived, provenance is retained, and mixed currencies remain separate. |
| Select variant and limit basis (H1b) | One Select product and product-level commission configuration; nullable explicit client preference and family-constrained plan metadata (`0060`) | Plus = `Aggregate, annual reset`; Standard = `Per illness, depleting`. Actual catalog amounts remain authoritative: Plus Private PHP 5,000,000 and Standard Ward PHP 1,000,000 exercised. Wizard/policy create/edit, register and profile show amount/currency/basis; historical omissions show Not recorded. Forged family/version/variant selections reject before client/application/policy writes. Unchanged historical unresolved plans may survive unrelated policy edits. No client-choice backfill, amount/premium/commission changes or duplicate product/rate rows. |
| Reports | Six live URL-filtered families (Overview, Sales, Commission, Agents, Conversion, Renewal) with scoped drill-down and audited XLSX/ODS/CSV export | Implemented 2026-08-26. Revenue uses verified payments by payment date; product mix uses issued-record counts; Agent sees assigned records, Staff sees agency aggregates without other-agent commission row amounts/by-agent commission chart, and Admin sees all. Detail output is capped at 500 with an explicit notice; source-query caps are also disclosed. Currency values are never converted or combined. |
| `Request Proposal` / `Generate Proposal` / `Log Call` as Lead Lifecycle **board** quick actions | Removed from the `/prospects` board header (`components/hub/screens/prospects-live.tsx`); all three remain reachable pre-scoped to the lead from the Contact Profile nurture chip row (`contact-profile.tsx:231-242`) | **Doc conflict, resolved 2026-08-15 in favor of code as changed.** `../../docs/web/lead-workflow.md:45` and `../../docs/web/pages.md:74` both still list these as board-level quick actions (`pages.md:74` is already partly stale — it also still lists the Send Intake Form/Send Brochure buttons removed the same day, and a "Convert to Application" board button that has never existed in code). Same redundancy as the `Send Brochure`/`Send Intake Form` row above: with no lead in scope, all three detoured through a `ClientPicker` search before landing on the exact same modal/form the Contact Profile already opens pre-scoped, with a required date field (Log Call's discovery capture) or a proposal-status precondition (Request/Generate Proposal) that a search-first flow adds no value to. The board header now only has `New Lead` plus the view toggles and filter. `ENGAGE_ACTIONS` (`engage.tsx`) had no entries for these three, so no map cleanup was needed. The Proposal Tracking panel's own per-lead `Generate Proposal` button (`prospects-live.tsx`, a different, already-lead-scoped call site) is untouched. |

| Dashboard export row scoping for the `agent` role | `app/api/dashboard/export/route.ts` gates on `can(role, "dashboard", "export")` but returns the same full dataset to every role — no per-row filtering | Known gap, deferred deliberately (2026-08-17). `MATRIX.dashboard.agent = "own"` (`lib/auth/permissions.ts:42`) implies an agent should see only their own records, and the export widens what one request returns from the ~12 rows the cards render to up to 500 per queue. It ships unscoped because `app/(app)/dashboard/page.tsx` itself has no row scoping either — scoping only the export would make the file disagree with the screen it is named after, which is the more confusing failure. All six users currently in `users` are Owner/Admin (→ `admin`); no staff or agent account exists, so nothing is over-exposed today and the branch could not be exercised if written. Revisit together with dashboard-page scoping when the first real agent account is created. |
| Campaign / payment-link fan-out logging | `sendCampaignAction` and `sendPaymentLinksAction` write one batched `communications` insert + one batched `activity_timeline` insert (`lib/communications/log-outbound-email.ts` `logOutboundEmails`, `lib/activity/log.ts` `recordActivities`) | **Deliberate semantics change, 2026-08-27** (refactor Tier 6 / [archived refactor notes](archive/future-refactor.md#f3-two-real-n1-write-loops-in-server-actions)). Previously a serial per-recipient loop could fail mid-batch and keep an unreported partial set of logged rows; the batch insert is a single statement, so a failure now logs nothing and the action reports the error. Attachment-carrying emails keep the single-row path with its per-row rollback. |
| Dashboard export visual styling | Column widths, number formats (`"₱"#,##0.00`, `yyyy"-"mm"-"dd`), merged title rows and autofilters — but no bold/coloured header cells and no frozen header row | SheetJS community edition cannot style cells (bold/fill/borders are a paid-tier feature) and has no `!freeze` handling at all — verified, the string appears nowhere in the shipped library, so setting it would be a silent no-op. Readability is therefore carried entirely by layout. Note the format strings are quoted deliberately: the obvious spellings (`₱#,##0.00`, `yyyy-mm-dd`) silently degrade in the **ODS** writer to `1,250,000.00` and `20260803`, since SheetJS's ODF writer drops unquoted literal characters. Both formats were verified by writing each file type and reading the rendered output back through LibreOffice. |

| `proposal_decision` value set | `null · Awaiting Decision · Negotiating · **Declined**` (`supabase/migrations/0027_proposal_decision.sql`, `components/hub/lead-config.ts`) | **Deliberate extension, 2026-08-17.** `../../docs/web/data-model.md:75` lists only `null · Awaiting Decision · Negotiating`. `Declined` was added because the spec left an outright rejection unrepresentable: `Unresponsive` is defined as *no reply* (wrong for a client who did reply, saying no), and `Lost` was only reachable through `Unresponsive`. Without it, a declined proposal could only be dispositioned by waiting out the 3-touch no-reply inference — i.e. by recording "never answered" about someone who answered. The column was specced but never built at all until this migration; the sub-state is cleared whenever `proposal_status` leaves `Decision`, enforced in the actions and backstopped by the `clients_proposal_decision_scope` check constraint. |
| `Mark Lost` preconditions | `lead_status = Unresponsive` **or** `proposal_decision = Declined` (`app/(app)/prospects/actions.ts` `markLostAction`, `components/hub/screens/contact-profile.tsx` ⋮ menu) | **Deliberate extension, 2026-08-17**, following from the `Declined` row above. `../../docs/lead-stage-status.md:48,51` states Lost is only ever reached through `Unresponsive`. Keeping that literally would have made `Declined` a recorded-but-inert state. Both layers gate identically, so the UI and the server cannot drift. |
| `proposal_status = Decision` trigger | A **Record decision** button on the Contact Profile proposal panel (`components/hub/overlays/record-decision.tsx`) | Pre-existing divergence, documented 2026-08-17. `../../docs/lead-stage-status.md:60` specs reaching `Decision` by "logging the lead's actual reply via Log Call or Log Message", with Eman picking the sub-state there. The shipped flow instead makes it an explicit button on the proposal panel — the sub-state picker the spec asks for now exists, just on that button rather than inside the call/message loggers. Consistent with the `Mark Sent` precedent above (a manual staff confirmation rather than an inferred one), but worth reconciling if the call-logging path is ever wired to it. |

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
- Some dashboards and long-tail operational flows still use partial data.

### Open assumptions (to confirm before go-live)

- **Commission VAT base (DH16, logged 2026-10-06).** Commission base computed as premium × 0.88
  per Eman's examples. Not verified against actual payout statements. Strict VAT method (÷1.12)
  would yield ₱40,178.57 vs ₱39,600 on a ₱250,000 premium. To be confirmed by finance before
  go-live. Applies to Phase H H9b.

### Superseded baseline assumptions

- The June blueprint's separate Prospect record and conversion-created Client record.
- A single-route, localStorage-backed SPA with no database or authentication.
- A committed Resend/Evolution delivery schedule. Provider selection and delivery automation are
  not implemented.
- Client Hub portal delivery as part of the current staff application.
- Phase E D1's rule to *preserve every website-created record not allowlisted as demo/test data*.
  Superseded 2026-10-06 by Phase H0 (decision DH1): every `clients` row and its dependent data
  was cleared with `scripts/clear-client-data.mjs` before real client staging, and every
  reference counter except `USR` was reset (DH2), so real records start at `<PREFIX>-2026-00001`.
  The seed migrations `0013`/`0014`/`0016` are unchanged and will re-seed demo data on a fresh
  `db reset`.

## Migration and deployment state

- Local migrations extend through `0061_application_medical_review.sql`; `0041` remains reserved
  for the D1 import schema. Hosted Gmail migrations: `0051` = `20261031084527`,
  `0052_gmail_incoming_mail` = `20261101074444`,
  `0053_gmail_inbox_checkpoint_attachment_alias` = `20261101074550`,
  `0054_shared_proposal_receipt` = `20261101080045`,
  `0055_gmail_inbox_metadata_limits` = `20261101082156`,
  `0056_gmail_inbox_provider_id_length` = `20261101082300`,
  `0057_requirement_attachment_picker` = `20261103112159`, and
  `0058_gmail_inbox_freshness` = `20261103132142`.
- October completion migrations applied 2026-11-06: `0060_select_variant_limit_basis` =
  `20261106054931`; `0061_application_medical_review` = `20261106060909`.
  Supabase types were regenerated from that hosted schema. No paid branch, push or deployment.
- Integrated verification: 66 targeted tests, 387 full-suite tests and `npx tsc --noEmit` passed.
  Authenticated desktop/narrow surfaces, uploaded QA Travel-original byte hashes, scoped reads/actions,
  per-product checklist parity, medical validation/network-input retention and the shifted reply →
  payment → policy/Back/reopen path were exercised with isolated QA records. Prior-submission
  navigation used an explicitly synthetic saved-state fixture, not a fabricated Gmail send.
  Preparation/claim assertions ran in rollback transactions; no email was dispatched.
- QA teardown removed all 11 newly created contacts and their application/policy/travel records,
  9 Storage objects, the disposable carrier contact and all 3 newly provisioned auth users after
  global sign-out. Private smoke scripts, credentials and snapshots were removed. Protected Joshua
  Mistal records were compared before and after teardown: 78 rows across 18 tables retained the
  same IDs and original-column values (SHA-256
  `514e64ea7518039a24fd7128e5eef0e0cdf909c87f04dfe5504419daad9712e5`).
- Advisor follow-up: service-role-only tables intentionally have RLS with no browser policies.
  The project still reports [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
  and informational [unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys),
  including the new nullable reviewer FK. No broad security/settings/index changes were made.
- `0053` fixes the PL/pgSQL variable/SELECT-alias ambiguity reproduced by the first hosted
  ingestion smoke. `0054` makes existing portal upload-back and inbox proposal filing use
  the same locked registration/receipt/replacement operation.
- `0055`/`0056` align retained MIME metadata with parser bounds rather than applying the 25 MB
  binary download/filing limit during ingestion. Oversize attachment metadata, 250 MIME files,
  longer reference/recipient headers and missing sender metadata remain reviewable without
  poisoning the cursor. Provider ID length is checked separately from PostgreSQL regex repetition.
- `lib/supabase/types.ts` was genuinely regenerated from the final hosted schema.
- Presence in source does not prove remote deployment. Check the target Supabase migration list
  before release.
- Regenerate `lib/supabase/types.ts` after applying migrations and review the diff.
- Unit tests run with `npm test` (Vitest 4, `vitest.config.mts`, `**/*.test.ts`). Added 2026-10-06
  for the commission formula (`lib/commissions/compute.test.ts`).
- H5a/b verification: rollback SQL plus eight concurrent synchronization calls and authenticated
  policy/backfill/receipt UI smoke. H5c–e adds isolated scheduling/logging SQL (61/60/30-day
  boundaries, receipt, cancellation, edited-copy preservation, closed/new cycles, early payer,
  do-not-contact and grants), eight concurrent queue calls (3 queued / 21 unchanged), actual
  Admin/Staff/Agent UI and Server Action boundaries, stale/network error retention, pending-close
  protection and fail-closed/authorized/repeated cron checks. Final `npm test`:
  **8 files / 58 tests**; `npx next typegen` and `npx tsc --noEmit` passed. Owned QA fixtures removed.
  No lint rerun or email-provider/Production web deployment is claimed.

### Gmail connection configuration and verification

- Server-only: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
  `GMAIL_SENDER_EMAIL`, and a dedicated base64-encoded 32-byte `GMAIL_TOKEN_ENCRYPTION_KEY`.
  The encryption key is generated once per environment and must be retained securely; changing
  it without re-encryption makes existing credentials unreadable. No secrets belong in browser
  props, audit JSON, provider-error logs or committed files.
  The local key is stored only in gitignored `.env.local`. Environments sharing this database
  and OAuth client must use the key that already encrypted its credential, not independently
  generated keys. Use a separate database or an explicit re-encryption migration for a new key.
- Callback: `/api/integrations/gmail/callback`. Local setup uses `http://localhost:3000`;
  production requires its exact registered HTTPS callback and separately configured secrets.
  The proxy exempts this exact callback from its optimistic login redirect; the callback
  itself requires the active CRM Admin and clears OAuth parameters before redirecting. The
  exact notification and Gmail cron paths have separate OIDC/secret authentication.
  Next development request logging ignores this exact callback to avoid printing its query;
  the synthetic callback logging smoke confirmed suppression. Production ingress/access logs
  must likewise redact OAuth query values before rollout.
- Isolated and subsequently hosted rollback SQL smoke exercised successful/stale writes,
  single-use/actor/browser-bound and expired attempts, redacted transactional audits, actual
  anon/authenticated table/RPC denials, Staff denial and inactive Admin denial.
  Rollback smoke creates no lasting synthetic connection, attempt or user rows. Both credential
  tables have RLS with no browser policies; access stays server-only through service_role.
  Multi-session concurrency races remain unverified.
- Actual Next callback smoke returned clean unauthenticated `303 /login?redirectTo=%2Fsettings`
  with private/no-store, no-referrer and cookie clearing; no OAuth code/state was forwarded.
  Direct unauthenticated Connect/Check Server Actions rejected access. Synthetic card states
  were viewed at desktop and narrow width; these are not proof of a connected mailbox.
  Keyboard focus reached Reconnect Gmail and the 390px surface had no horizontal overflow.
  The temporary synthetic route was removed after the smoke.
  `npx next typegen` and `npx tsc --noEmit` passed with the dev server stopped;
  the full Vitest suite passed: **14 files / 163 tests**.
- Initial mailbox-owner consent was send-only. The earlier secret-safe hosted check observed
  `admin@pacificinsuranceph.com`, status `connected`, an encrypted refresh credential present,
  and last check `2026-10-31T11:05:26.913899Z`. Credential values were not displayed.
  The preactivation checks showed `read_granted = false` and `inbox_enabled = false`;
  the production activation evidence below supersedes that state.

### Incoming Gmail activation and verification (2026-11-01)

- Read permission is `https://www.googleapis.com/auth/gmail.readonly`, added alongside the
  existing identity/send grants. Reconnect requests it; cancelling or lacking read permission
  preserves a valid send-only connection. Only **Enable incoming email from now** initializes
  the receipt boundary. Older messages are not imported, including during expired-history recovery.
- The worker holds a 90-second lease, uses a 45-second request budget, and checkpoints candidate
  IDs and progress before advancing the final decimal history cursor. Duplicate messages and
  notifications do not overwrite evidence or links. Recovery captures its profile cursor before
  listing mail. Watch renewal never replaces the ingestion cursor. Manual/daily renewal and
  reconciliation share one credential refresh and deadline; a watch failure does not block reads.
- `/inbox` has 100-message pages, metadata-only lists, selected plain text, matching suggestions,
  explicit Admin association, original downloads and staff-confirmed PDF filing. An established
  thread or matching reference is a suggestion, never permission to release or approve mail.
  Linking writes one Received communication at the original receipt time; the client timeline
  links back to it. Filing atomically creates the document, association, receipt and audit.
  Repeated filing returns its existing document; different purposes/requirements are rejected.
  Verified requirements and later lead proposal states are preserved. Unsupported/encrypted
  originals are not converted or presented as parsed carrier decisions.
- Incoming originals are private. The source client page, document download and submission ZIP
  now enforce active-account/assigned-client boundaries so linked evidence cannot bypass inbox
  scoping through existing routes. Browser table/RPC access remains denied.
- Additional server-only configuration:

  ```dotenv
  GMAIL_PUBSUB_TOPIC=projects/pacific-insurane-ph/topics/pacific-gmail-inbox
  GMAIL_PUBSUB_SUBSCRIPTION=projects/pacific-insurane-ph/subscriptions/pacific-gmail-inbox-push
  GMAIL_PUSH_SERVICE_ACCOUNT=pacific-gmail-push@pacific-insurane-ph.iam.gserviceaccount.com
  GMAIL_PUSH_AUDIENCE=https://pacific-insurance-ph-ten.vercel.app/api/integrations/gmail/notifications
  ```

  Preserve the project's actual spelling, `pacific-insurane-ph`. These values are configured
  locally and in Vercel Production. The existing encryption key was authenticated against the
  active credential before provisioning; it was not rotated. Existing production Supabase
  configuration was retained. Production `CRON_SECRET` is configured. No service-account key
  was downloaded and no secret values were printed.
- Production rollout:
  1. Deployment access was restored and the updated CRM is deployed; see live evidence below.
  2. Configure server-only values and the existing credential encryption key in Vercel;
     use/register `https://pacific-insurance-ph-ten.vercel.app/api/integrations/gmail/callback`
     as `GOOGLE_REDIRECT_URI` (configured). Ensure Google permits that callback for future production reconnects.
  3. The owner created subscription `pacific-gmail-inbox-push`; notifications currently fail OIDC
     audience verification. Edit its Push authentication Audience to match the full webhook URL.
     Keep authentication enabled with the dedicated push-delivery service account above. Use a 60-second
     acknowledgement deadline and retry backoff, e.g. 10–600 seconds. Gmail's existing
     `gmail-api-push@system.gserviceaccount.com` Publisher binding stays topic-scoped.
     The Pub/Sub service agent needs permission to mint the push identity; if delivery reports
     that permission missing, grant Service Account Token Creator on this service account only,
     not broad project privileges or an organization-wide sharing exemption.
  4. The owner completed Gmail reconnect/read consent and enabled incoming synchronization.
  5. Send a benign QA email after enablement; prove authenticated push, one imported message,
     manual sync deduplication, watch renewal and an authorized attachment download before
     claiming the live mailbox is receiving inside the CRM.
- `/api/integrations/gmail/notifications` verifies Google's signed OIDC token and exact
  audience/service-account identity before validating mailbox/subscription metadata. It durably
  enqueues notifications, never trusts their cursor as a checkpoint, and returns non-success for
  busy/partial work so Pub/Sub retries. Only POST is supported; browser GET is not a delivery test.
- `/api/cron/gmail` authenticates `CRON_SECRET` and runs daily at `15 0 * * *` (08:15 Manila
  nominally). Push is the normal near-real-time path; daily/manual reconciliation is the fallback.
  The daily cadence supports [Vercel Hobby limits](https://vercel.com/docs/cron-jobs/usage-and-pricing);
  Hobby scheduling can occur later in that hour. Neither a cron nor a notification enables reading.
- Verification: hosted rollback assertions passed for grants/RLS, active Admin/Staff/Agent scope,
  notification/message deduplication, cursor/lease/recovery protection, complete target lookup,
  message pagination, same/different-target linking, checklist ownership, filing retries,
  Received-not-Verified transitions, preserved verification, and guarded proposal receipt.
  The first failure was fixed by `0053`; the smoke passed again after the `0054` shared cutover.
  Multi-session races are not claimed.
- Actual Next UI: Admin linked synthetic evidence; Staff and Agent could not see unassigned mail
  or fetch its originals (404). Agent could read its released message but had no filing control.
  The saved Filed state, inert script text, keyboard focus and 390px no-overflow layout were
  observed. The shared shell's intrinsic-width overflow was corrected while preserving desktop.
  Settings showed Connected with read reconsent required and enablement disabled.
- Two throwaway integration checks injected benign PDF bytes only at the provider boundary,
  then exercised real private Storage, exact-byte download, idempotent document/checklist filing,
  and the shared upload-back proposal receipt/replacement service, including own-Agent permission.
  Actual HTTP verified an authorized document redirect and timeline evidence link; after synthetic
  client reassignment, document/ZIP downloads returned 404 and client/inbox pages showed not-found
  with no protected evidence. Next's streamed not-found pages returned HTTP 200; API denials were 404.
- Actual cron returned 503 with missing configuration, 401 with a wrong secret, and authenticated
  200 with `enabled:false`; no implicit activation or Gmail request occurred. Unsigned push returned
  401 and a sibling URL retained normal login protection. QA rows, accounts, objects, credential
  files and temporary source scripts were removed. Final hosted checks found zero QA users/messages.
  Activation continued below. Real incoming message ingestion, accepted signed push and provider
  attachment download remain unexercised; all outgoing workflows remain log-only.
- A missing-label parser regression was reproduced and fixed; absence means no applied labels,
  not invalid mail. A hosted rollback reproduced and then verified the metadata boundary fix
  with an unknown sender, 101 references/recipients, long headers and 250 attachment records,
  including a 30 MB original's metadata. Binary downloads/filing still enforce 25 MB.
- Source checks passed: `npm test` (**18 files / 224 tests**), optimized `npm run build`,
  and `npx tsc --noEmit`. Production deployment/live checks are recorded separately below.
- Setup references: [Gmail push/watch requirements](https://developers.google.com/workspace/gmail/api/guides/push)
  and [authenticated Pub/Sub push](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions).

### Production activation evidence (2026-11-01 UTC)

- Canonical production URL: `https://pacific-insurance-ph-ten.vercel.app`.
  Deployment `dpl_2j6E4R9mTBzVXm8d6ub8jNSPcr4K` compiled and passed TypeScript on Vercel
  and was promoted to production. The prior live build was from October 7 and redirected the
  notification endpoint to login; the new webhook now performs its own JWT authentication.
- A disposable authenticated QA actor proved the old production app used the same Supabase
  database without exporting its sensitive environment values. The actor was deleted.
  Gmail/cron production settings were provisioned using secret stdin, retaining the active
  credential encryption key. Existing Supabase environment values were not replaced.
- Reading is granted and the connection is `connected`. Incoming synchronization was explicitly
  enabled at `2026-11-01T16:44:11.643Z`. Real production reconciliation returned HTTP 200 with
  `enabled:true`, `watchRenewed:true`, `processed:0`, `complete:true`, `busy:false`.
  The watch expires `2026-11-08T17:08:58.411Z`; last completed sync was
  `2026-11-01T17:08:59.769743Z`, with no sync error or pending lease/work.
- Unsigned webhook POST and unauthenticated cron returned 401; the inbox still redirects
  unauthenticated users to login. No weakening of authentication was performed.
- The initial OIDC audience mismatch returned 401. This external configuration issue was
  resolved by November 3; subsequent real deliveries passed authentication. Fixed-reason
  diagnostics were removed, and JWT audience/identity verification remains mandatory.
- Temporary provisioning/diagnostic source was removed; zero deployment-QA accounts remain.
  No outgoing emails were sent and no client/application status was changed.

### Automatic push correction (2026-11-03 UTC)

- The owner confirmed received mail appeared after manual Sync. Before the fix, the database
  contained two messages but zero accepted push notifications. Authenticated pushes
  returned 400: Gmail supplied a numeric `historyId`, while the parser required a string.
- `lib/gmail/notifications.ts` now normalizes safe integer IDs to decimal strings. Existing
  decimal strings remain exact; fractional, nonpositive and unsafe numeric IDs are rejected.
  Mailbox, subscription, OIDC identity/audience and envelope validation are unchanged.
- Before/after regression proof: the two numeric-ID cases failed before the fix; all 229 tests
  across 18 files passed afterward. Production deployment
  `dpl_67PR8TXcEe6Jtmaf83Ke3kq65Ynm` built, passed TypeScript and replaced the temporary
  shape-only diagnostic. No payload logging remains.
- At `2026-11-03T07:30:59Z`, four distinct real Pub/Sub notifications were persisted; the
  production webhook returned 204 for all four observed deliveries. Background sync completed
  at `2026-11-03T07:28:50.674302Z`, with no error, pending work, active lease or partial checkpoint.
  The original two messages remained unique and unassigned. No manual sync was invoked to
  produce this post-fix evidence; no additional test email, attachment or business-status change
  was made. Import of a newly arriving email after the fix and provider attachment retrieval
  have not yet been observed.
- Production push updates the shared database, including records viewed from localhost.
  An already-open `/inbox` does not live-refresh; reload/navigation reads the saved messages.
  Manual **Sync** remains recovery, not the normal import trigger.

### Non-disruptive Inbox updates (2026-11-03)

- `0058` adds a service-role-only, stable membership revision using the existing
  `gmail_inbox_actor_can_read` predicate across the complete authorized ID set. No message
  content, headers, attachment metadata, first-page count or global sync counter is polled.
  The page reads revision before its existing 100-row list; deep-link authorization is unchanged.
- Exact `/api/inbox/freshness` authenticates the current active account and returns only
  `{ revision }`, private/no-store and nosniff. It bypasses only the optimistic proxy redirect;
  anonymous/inactive accounts receive 401 JSON, and sibling routes remain gated.
- The Inbox checks on mount, every 30 seconds while visible/online, and immediately on return.
  The controller is single-flight, aborts on hide/offline/unmount, times out at 10 seconds,
  ignores obsolete responses, recovers from transient failures and stops on 401/403.
- A polite **Inbox updates available** banner is informational until staff choose
  **Refresh inbox**. Explicit refresh exposes page 1 while retaining the selected message ID
  and detail key; workspace search/filter ownership is unchanged. Revoked selections still
  use the server's not-found boundary. Polling never syncs Gmail, navigates or files evidence.
- Verification: 264 tests across 22 files passed, including 14 deterministic controller cases;
  ESLint returned 0 errors and 8 existing unused-variable warnings. SQL rollback proof covered
  Admin/Staff/two Agent scopes, stable empty sets, old releases beyond 100 rows, reassignment,
  removal and no receipt/timeline/checklist mutation on reads or repeated releases.
  Authenticated HTTP proved private revision responses, inactive/anonymous denial, exact proxy
  isolation, actual insertion/release/reassignment changes and selected-ID retention after arrival.
  Picker smoke exercised Application/Claim/Travel reuse and idempotency, untouched Pending rows,
  preserved Verified, cross-record acknowledgement, role denial, exact original/ZIP bytes and
  2 MiB signed native upload. Real Health/BC Flexi/Travel and retained-draft creation paths passed,
  including distinct destinations for equal-name people. No browser/visual/keyboard acceptance
  or outgoing email delivery was exercised.
- Release: Vercel CLI 58.7.1 deployed an isolated HEAD-plus-reviewed-picker/freshness input set
  without `.env.local`, `.auth`, QA credentials or Vercel cache. Local optimized build/TypeScript
  passed with existing configuration supplied only to the build process. No Git commit/push.
  Production deployment [`dpl_5N4uyzXopqKPdGTNics94c3D1KTi`](https://pacific-insurance-2xb040v5g-pacific-insurance-ph.vercel.app)
  is READY; inspection confirmed [`pacific-insurance-ph-ten.vercel.app`](https://pacific-insurance-ph-ten.vercel.app)
  points to it. Prior READY rollback target: `dpl_HkEqMJPzwCoeypsrkg8kumnPby21`; no rollback needed.
  Region `sin1`, both cron schedules, OAuth/PubSub configuration and environment values were retained.
- Canonical production acceptance passed: login 200; anonymous Inbox/sibling paths gated;
  anonymous/inactive freshness 401 JSON; real Admin/Staff/two Agents receive revision-only,
  private/no-store/nosniff responses; unsupported POST remains 405. Unauthorized Gmail cron and
  webhook return 401 without triggering sync. Fresh QA Application/Claim/Travel receipts,
  repeated originals, untouched Pending rows, preserved Verified, cross-record acknowledgement,
  Agent denial, exact PDF/ZIP bytes and 2 MiB signed native upload passed. Excel originals list
  and download inertly with unchanged stored bytes; unsafe inline preview is rejected with 415.
  The authenticated Inbox payload includes its revision and retained selected message.
  Revoked Agent access uses Next's existing streamed not-found boundary (HTTP 200 with the
  404 fallback control), without serializing the message body. Browser interaction was not tested.
- Cleanup verified zero owned QA Auth/CRM users, clients, messages, documents, attachment
  usages/upload intents, audit/timeline rows or Storage objects. The original real source and
  filing remain (one each). Canonical HTTP reads after QA removal changed Admin/Staff/assigned
  Agent membership but not the foreign Agent's empty scope. No outgoing QA communication was
  logged. The user's existing local dev server was left running and `/login` still returned 200.


### Shared requirement attachment picker (2026-11-03)

- `Choose file` opens one device/email picker on Application (including BC Flexi), Claim and
  Travel requirements. Creation wizards stage selections against stable requirement/person
  identities and attach only after the server creates authoritative rows. Existing retained
  draft snapshots render their actual `persisted:<UUID>` rows instead of guessing by names.
  Client/person/roster/product/trip changes invalidate staged choices; drafts do not save files.
- `DocumentUploadForm` supplies the shared picker only for a requirement context. Ordinary
  document uploads and non-checklist portal upload-back remain separate. Obsolete Travel
  upload wrappers and the old requirement-only signed-upload initializer were removed.
- Migration `0057` records immutable email originals, per-requirement usages and actor/target-bound
  native upload intents. Existing filing metadata is backfilled without receipt/status changes.
  Destination documents retain the existing requirement foreign keys used by downloads and ZIPs.
  Shared bytes are retained when an individual association is removed; hard deletion is Admin-only.
- Candidate listing filters authorized client-linked mail before pagination and includes already-filed
  attachments. Same-client reuse across records requires acknowledgement; unassigned mail and
  cross-client use remain unavailable. Admin/Staff can file email; Agent can upload native files
  for owned clients but gains no Gmail filing permission. A client-profile email link alone does
  not trigger a false cross-record warning; existing uses in other records still do.
- Both sources use locked, idempotent receipt. Only the selected requirement becomes Received;
  Verified stays Verified. Original email links, first filings, other checklist items, optional
  phases and policy/payment decisions are untouched. Receipts never duplicate inbound communications.
- Source files retain their original bytes and filename, including Excel CET workbooks. Only
  signature-approved PDF/JPEG/PNG preview inline; other formats download inertly. Responses are
  authenticated, private/no-store and nosniff. Stored originals require no current Gmail connection.
- Verification used Orca terminals, not browsers: **250 tests / 21 files**, ESLint **0 errors /
  8 existing unused-variable warnings**, optimized build and its TypeScript phase passed.
  **18 SQL/Storage checks** exercised roles, ownership, explicit cross-record acknowledgement,
  concurrent/repeated receipts, Verified preservation, immutable originals and safe association removal.
  **17 authenticated HTTP scenarios** exercised real Server Actions, stored PDF previews and Inbox
  downloads with process-local Gmail credentials blank, inert Excel downloads, a 3 MiB direct signed
  upload, original-byte hashes, submission ZIPs, fresh Travel/Health/HMO creation and retained draft
  completion. Equal-name dependents received distinct destinations; new trips did not inherit files.
  No outbound email was sent/logged. New provider-original fetching and visual/keyboard interaction
  were not exercised in this slice.
- Post-DDL security advisory review found the expected service-role-only RLS/no-browser-policy
  information and the existing unrelated [disabled leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  No Auth settings or Gmail credentials were changed.
- Inquiry-only creation previews do not accept attachments because they create no checklist rows;
  switching application type invalidates staged selections. QA records, Auth actors, objects,
  temporary credentials and smoke scripts were removed. Final identity-scoped checks found zero
  owned QA clients/users/messages/sources/upload intents/objects; the original real filing remains.





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
- The Carrier Library is loaded through an explicit allowlist in
  `scripts/carrier-library-manifest.json`, not by scanning the attachments folder. The September
  2026 load included 40 source files; follow-up migrations `0039` and `0040` added support for
  CCAF, Geographical Loading, and the CET spreadsheet. The current manifest has 49 library rows.
- The 2026-09-07 client decision treated the unsigned distribution-clearance form as not-a-gate for
  that load. This remains an explicit recorded decision; if the clearance is refused,
  `scripts/load-carrier-library.mjs --apply --unapprove` reverts loaded rows to Inactive.
- Keep files with recoverable client data and internal-only documents excluded. The Proposal
  Information Sheet remains excluded pending a client decision on who completes it. Product-agnostic
  Agent's Attestation and Advisor's Declaration assets are loaded once per product because the
  approval RPC requires a product version.
- Migrations `0038`–`0040` are present in source. Their remote deployment has not been verified here;
  check the target project's migration ledger before release.
- **Optional library attachments are template-agnostic by design (2026-09-07).** The mandatory rule
  above is unchanged and still keyed to the two exact template names. Alongside it, every composer
  can now attach any approved asset for the contact's product, of any of the seven types, up to
  five per email. No template→type map was added for that path: `email_templates.template_name` is
  free text with no uniqueness constraint and deliberate casing duplicates (`Policy issued` and
  `Policy Issued` both seeded in `0011`), so an exact-name map silently misses the twin while a
  normalised one starts matching retired rows — and an optional attachment has no wrong choice to
  prevent. The required and optional paths share no resolver, no action and no component, and
  `sendEmailAction` takes them as separate fields so the server never has to infer which selection
  satisfies the gate.
- **The gate's exact-name matching is a known limitation kept on purpose.** Because `Policy issued`
  and `Policy Issued` coexist, making the match case-insensitive would start gating a retired
  template. Do not "fix" it without first resolving the duplicate rows.

## Submit to Pacific Cross (2026-10-07)

- **Spec:** completing a checklist opens an email to Pacific Cross with the documents attached (H7e).
- **Implemented:** the "Submit to Pacific Cross" step composes the email and downloads the
  checklist files as one ZIP. Eman sends it herself from her own mailbox, and **Mark as
  submitted** then logs a `communications` row (`delivery_status = logged`) and moves the
  application or claim to its submitted status. Nothing is delivered from the CRM until R1 is
  resolved.
- **Application → policyholder (decided 2026-10-07):**
  - **Payment:** the Payment step records the premium Pacific Cross billed as an Awaiting payment.
    Before this, no code created application payments.
  - **Conversion:** the client becomes `Policyholder` when the policy copy is logged from the
    application, not when payment is verified. Verifying payment still only marks the
    application Approved.
  - **Unchanged path:** the standalone Log policy copy drawer, opened without an application,
    does not convert anyone.
- **Pacific Cross reply (2026-10-07, assumptions pending Eman's confirmation):**
  - **Logging replies:** Pacific Cross's replies after submission are logged by hand as inbound
    `communications` with summaries starting `Pacific Cross reply`. Conformes and extra
    underwriting requirements become required checklist rows marked "Requested by Pacific Cross".
  - **Proposal:** the illustrative proposal is assumed to be the lead-stage proposal document
    (`documents.document_type = 'Illustrative Proposal'`).
  - **OR number:** the stored OR is assumed to be the service-invoice number.

## Reconciliation checklist

When behavior changes, update all three layers deliberately:

1. Confirm the business rule in `../../docs/web/` and lifecycle source files.
2. Update code/migrations and tests.
3. Update this mapping and the build roadmap.
4. Search both repositories for superseded wording and broken links.
5. Commit changes inside each independent repository, never at the parent workspace.
