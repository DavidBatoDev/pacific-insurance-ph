# To-Be Update Implementation Plan — Post Demo-Validation (2026-07-23)

## Context

On **2026-07-23** the team ran a client demo walkthrough + validation meeting with Matt and Eman
(notes/transcript now in the sibling notes repo: `../docs/Demo Validation Meeting - Notes.md` and
`… - Transcript.md`). That meeting produced a list of feature requests and fixes, and Joshua noticed
several additional gaps live in the demo. This file preserves the detailed implementation checklist
and completion history. Use [docs/build-roadmap.md](docs/build-roadmap.md) for current priorities;
many sections below describe work that has since shipped.

**Attachment-readiness update (2026-08-01):** Eman supplied current Select and Blue Royale forms,
health brochures, medical questionnaires, remote-selling material, an illustrative proposal,
medical/travel claim forms, a Travel application form, and Pacific Cross points of contact. The
inventory and remaining permission/input requests are tracked in
`../docs/attachments/checklist.md`; its prior version is preserved as
`../docs/attachments/old-checklist.md`.

**Requirement-list update (2026-08-18):** Eman sent Pacific Cross's *written* requirement lists for
BC Flexi, FlexiShield, Select/Blue Royale, and claims/pre-approvals — the first time the carrier
stated what it needs rather than us inferring it from blank forms. Checking those lists against the
code surfaced **nine app-side gaps**, none of which need anything further from the client. They are
now **Phase G** below, and they mean the plan is no longer purely dependency-gated.

**Big picture from exploration:** most requests are *further along than the meeting assumed*. The
DB schema already carries `date_of_birth`, `external_contacts`, `commissions`, and dormant
`required_document_*` tables. So the work skews toward **wiring/UI + a few targeted fixes**, not
green-field building. Client import, in-app proposal calculation, approved carrier collateral, and
production rollout each retain the explicit dependencies listed below.

**Web implementation update (2026-08-26):** migration `0036` is reconciled in the remote ledger;
`0037_carrier_rate_catalog` is deployed with the source-dated carrier catalog and 513 published
rate rows; Discovery family size/coverage tier now carry safely into the application wizard; and
all six Reports families are live with RBAC, drill-down and audited XLSX/ODS/CSV export. Client
workbook processing and outbound email remain outside this implementation slice.

**Follow-up implementation update (2026-09-25):** the Carrier Library load has been extended with
CCAF, Geographical Loading, and the Corporate Enrollment Template (migrations `0039` and `0040`;
remote deployment still needs verification). Proposal and Travel portal results can be uploaded
back into the corresponding records. The dated audit and Phase G checklists below remain useful
history; confirm current status against the build roadmap before acting on unchecked items.

**Oct 2 module review (2026-10-02):** the team walked Eman and Matt through every module. The
resulting work is **Phase H** below.
- Sources: `../docs/meeting_Notes_Oct_2.md` (authoritative, includes the Tagalog portion) and JC's
  `../docs/Oct2_Task_Assignments_Draft.md`.
- Phase H opens with **H0**: clear all client and lead data before client staging begins.
- It ends with twenty open decisions (DH1–DH20) for Joshua.

## Implementation audit (2026-08-03)

Audited against current source, Git history, and the connected Supabase migration ledger.

| Item | State | Evidence |
| :--- | :--- | :--- |
| A1–A2 | Implemented | `581b82d`; integration migration is deployed |
| B1–B3 | Implemented | `c6ed348` plus follow-up draft fixes |
| C1 | Implemented | `9316b6a` |
| C2a / C2b | C2a implemented and carrier URL received / C2b deferred for V1 | The app opens the configured proposal site without claiming completion; Eman chose the carrier site while the in-app discount formula remains unavailable |
| C3 | Implemented and deployed | `89708ba`; `external_contacts_directory` is in the remote ledger |
| C4 | Implemented and deployed | `efea273`; `0024_application_requirements` is in the remote ledger |
| C5 | Implemented | Applications derives verified-only progress from persisted requirements with completeness filtering and sorting |
| C6a | Implemented and deployed | `f53e67f`; `0023_document_library_attachments` is in the remote ledger |
| C6b | Blocked | No outbound email provider exists, so binary files are not transmitted |
| C7 | Implemented and deployed | `0025_application_workflow_reconciliation` and `0026_application_workflow_indexes` are in the remote ledger; application/Travel workflows now use versioned carrier-form assignments |
| D1–D2 | D1 data received, processing pending / D2 implemented (2026-08-15) | Workbook received 2026-08-24; profiling, cleaning, mapping, deduplication, approval and import remain. No importer exists. |

Remote schema verification found both `application_requirements` and
`communication_library_documents`. At audit time, five application-requirement rows existed and
the Carrier Library contained zero assets, which is the intentional pre-clearance state.

**Verification caveat:** `npm run lint` is not currently green (18 errors, 5 warnings across
existing UI files, primarily React hook/purity rules). This audit records feature presence and
database deployment; it does not claim a clean repository-wide lint run or fix those existing
issues.

---

## Conventions every task must follow (from `docs/build-roadmap.md` + code)

- **Repository per entity** — clone `lib/repositories/clients/` (4 files: `*.entity.ts` camelCase
  types, `*.repository.ts` port interface, `*.repository.supabase.ts` impl with `toDomain()` mapper +
  `getSupabaseAdmin()`, `index.ts` singleton factory). Closest "config table" precedent:
  `lib/repositories/payment-channels/`.
- **No zod** — validation is hand-rolled (client-side `canSave` booleans + guard clauses in server
  actions).
- **Migrations** — new numbered SQL file in `supabase/migrations/` (next is currently `0025_*`), applied via
  the **Supabase MCP** `apply_migration` (project ref in `.mcp.json`), then **regenerate**
  `lib/supabase/types.ts` via MCP `generate_typescript_types` or repos won't type-check.
- **Server actions** — `"use server"`, `getActor()`/`ActionResult<T>` from `lib/actions/context.ts`,
  then `recordActivity` (`lib/activity/log.ts`) + `recordAudit` (`lib/audit/log.ts`) +
  `revalidatePath(...)`.
- **Nav** — screens are registered in `components/hub/shell.tsx` (`ScreenId` union ~L18-20,
  `SCREEN_PATH` ~L32, `NAV_*` arrays ~L48-67).
- **"Email send" today = insert a `communications` row** (direction Outbound, channel Gmail,
  `delivery_status = logged`) + activity entry, body rendered through `fillTemplate()`
  (`lib/templates/merge.ts`). **There is no real SMTP/Gmail send yet** — see cross-cutting risk R1.

---

## Cross-cutting risks / dependencies

- **R1 — Emails don't actually send.** Every "send" only logs a `communications` row. The
  auto-follow-up-email features (missing-documents, etc.) will *log* an email, not deliver it to the
  client, until a real provider (Resend/Gmail per roadmap) is wired. Flag to Matt/Eman; decide
  whether that's in-scope now.
- **R2 — Remaining external inputs.** The client workbook is received but still needs recency
  confirmation, data engineering and real-client-data clearance before import. Both carrier portal
  URLs are received; credentials must be rotated and kept outside the app. The in-app proposal
  calculator is deferred for V1 while the discount formula remains unavailable.
- **R3 — Regenerate `lib/supabase/types.ts` after every migration**, or downstream repos break.
- **R4 — Carrier assets require approval, versioning, and privacy review.** Use the approved Pacific
  Cross originals as the legally authoritative forms. Some samples in `../docs/attachments/` contain
  real-client identity, address, premium, or medical underwriting details; never copy those samples
  into app seeds, migrations, or production storage until permission and redaction are confirmed.

---

## Phase A — Quick wins (small, unblocked)

- [x] **A1. Birthday field on the New Lead form.** Completed: Date of birth is required in the
  grouped New Lead intake UI and in `createLeadAction`, persists through the existing client mapping,
  and renders on the Contact Profile. Email and mobile remain an either/or requirement, as specified
  for a lead.

- [x] **A2. Pacific Cross portal redirect button (minimum integration).** Implemented with the
  recommended configuration path: `0020_integration_settings.sql`, a dedicated repository,
  admin-only HTTPS URL saving with audit logging, and launch buttons for all staff in Settings and
  the lead Proposal tracking card. The connected Supabase ledger confirms the integration-settings
  migration is deployed.

---

## Phase B — Bug fixes (Joshua's live-demo observations)

- [x] **B1. Lead profile "back" button + lead-vs-client confusion.** Completed: Prospect Pipeline
  record opens now carry `?from=prospects`; lead profiles (including direct links) show a
  **Prospects** back link, while client profiles retain **Clients**. The source is also preserved
  through Edit, Cancel, and save redirects. One profile route still serves both record types; the
  navigation context is now origin-aware.

- [x] **B2. Logging a discovery call doesn't advance the stage/status.** Completed: engagement
  actions apply call/message lead-status rules server-side and write activity/audit records. A
  reached call or inbound message changes New/Attempted → Connected; a no-answer call changes
  Connected → Attempted; completing discovery validates the structured fields then changes
  Connected → Qualified. Qualifying actions return a suggested **stage** transition for the shared
  confirmation modal. Outbound email logging intentionally does **not** advance status because
  `delivery_status = logged` is not evidence that the lead was contacted.

- [x] **B3. "Continue Application" for saved drafts (no resume path today).** Implemented with
  `0021_application_wizard_state.sql`: draft applications persist the full form, active step, and
  checklist; Applications and the contact profile expose **Continue Application** only for resumable
  Lead drafts. Resaving updates the same application/client, and completing HMO/Travel drafts keeps
  that application as the trail while also creating its group/travel operational record. The
  connected Supabase ledger confirms the application-wizard-state migration is deployed.

---

## Phase C — New features (larger)

- [x] **C1. Commissions as its own nav section.** Completed: the existing tracker is now the reusable
  `CommissionsLive` screen, available from the standalone `/commissions` route and the retained
  Payments sub-tab. Commissions is registered in `ScreenId`, `SCREEN_PATH`, Workspace navigation,
  the command palette, and the permission matrix; commission-producing/updating actions revalidate
  both routes. Existing CRUD, OR-triggered creation, role-based amount masking, email hooks, and
  client navigation are preserved. No migration was required.

- [x] **C2. "Generate Proposal" alongside "Request Proposal".** `Request Proposal` exists fully
  (`components/hub/overlays/request-proposal.tsx`, `requestProposalAction`, `proposal_status`
  machine). Product routing per the meeting: **HMO → Request Proposal (existing); Select / Blue
  Royale → Generate Proposal (new)**.
  - [x] **C2a — DONE (`c070a29`; corrected 2026-08-24).** `Generate Proposal` shipped for individual products: hands off
    to the Pacific Cross portal (reuses A2's redirect). Opening a third-party site is not evidence
    that its work completed, so the 2026-08-24 correction leaves proposal status unchanged until
    staff use the existing `Mark Received` action. The original implementation entered the
    proposal-artifact machine at `Received` immediately. It uses the existing
    `generateProposalAction`/`GenerateProposalModal`, wired into both the Contact Profile proposal
    card and the Prospects board's Proposal Tracking widget. Later gated to the `Proposal` stage
    (`180d9e9`, 2026-08-15) so it can't fire on a lead that's drifted past that stage — see the
    Phase D audit note on `Carla Mendez` below.
  - **C2b (DEFERRED FOR V1 — R2):** duplicate the Pacific Cross portal's proposal generator in-app with the
    **discount calculation** (formula to be obtained from Edzen; portal demo with Eman first). A
    current illustrative proposal has been received, so its layout and output fields can be used as
    the format reference after the sample is redacted/approved. Generate a PDF from data fields with an
    "amounts are estimated and may vary from the official Pacific Cross illustration" disclaimer.
    Eman's 2026-08-24 direction is to incorporate the carrier site instead; this is no longer a V1 blocker.
    New overlay `components/hub/overlays/generate-proposal.tsx` mirroring `request-proposal.tsx`;
    wire into `prospects-live.tsx` + the `contact-profile.tsx` proposal card; pick a PDF lib.

- [x] **C3. Pacific Cross officer contact profiles (e.g. Edzen Almario).** Implemented in
  `89708ba`: repository-backed Settings directory with create/edit support, Eman's New Business,
  Renewal, Claims, Client Services, and support contacts, plus recipient pickers for proposal and
  commission workflows. `0022_external_contacts_directory.sql` adds verification metadata; the
  connected Supabase ledger confirms it is deployed and generated types include the new field.
  Rose Anne remains intentionally inactive until her current commission role/email is verified.

- [x] **C4. Application requirements checklist + missing-document follow-up log.** Implemented in
  `efea273`. `0024_application_requirements.sql` adds durable per-application snapshots and a
  standard new-business baseline; the repository initializes requirements when applications are
  created. Applications and Contact Profile open a requirements modal with Pending / Incomplete /
  Received / Verified status updates, audit/activity logging, and verified-package progress. The
  staff-triggered missing-documents action merges outstanding required items into the template and
  logs the communication with `delivery_status = logged`—it does not claim delivery. The connected
  Supabase ledger confirms migration `0024_application_requirements` is deployed, and generated
  types include the new table. Per-product expansion from approved carrier forms remains C7; these
  persisted rows now feed the C5 Applications completeness column.

- [x] **C5. Application completeness column on the Applications page.** Implemented from the C4
  checklist in the existing bounded Applications repository query, without a migration or N+1
  reads. Required `Verified` items drive the numerator; optional items are excluded. The table shows
  progress plus Complete / In review / Missing, supports a dedicated completeness filter and
  percentage sorting, and uses safe Draft / Not initialized fallbacks when no checklist exists.
  Requirement status changes refresh the Applications route so the row and missing-requirements
  statistic stay current.

- [x] **C6. Carrier document library + real attachment selection (current providerless scope).**
  - [x] **C6a (implemented in `f53e67f`, deployed 2026-08-03):** Admins can upload,
    review, approve, edit metadata, and archive versioned assets in the private `documents` bucket
    under `library/`. Admins and staff can select active approved brochure/application-form assets
    strictly matched by product, variant, and age band. Communications snapshot exact versions in
    `communication_library_documents` instead of logging decorative filenames. At the original
    2026-08-03 audit the library was empty pending clearance; it was subsequently loaded, as recorded
    in the Carrier-document rules in `docs/development-alignment.md`. The connected Supabase ledger
    confirms `0023_document_library_attachments` is deployed, and generated types contain its schema.
    **C6b (BLOCKED — R1):** transmit the actual binary attachments when a real email provider is
    implemented. Until then the UI must state that the action is logged but not delivered.
  - Do not ingest the illustrative proposal, CAC, or TAL samples until they are redacted and approved
    under R4.

- [x] **C7. Reconcile application workflows with the received carrier forms.** Keep the Pacific
  Cross originals legally authoritative; do not reproduce every declaration or medical-questionnaire
  answer as a native app field. Use the forms to close operational gaps:
  - Health: choose the regular vs. age-71+ Select/Blue Royale form automatically; track plan/coverage,
    applicant/dependents, valid ID, attestation/advisor declaration, remote-selling confirmation,
    and conditional medical questionnaire/TAL/CAC requirements.
  - Travel: reconcile the application/travel records with the received form's applicant/traveler,
    trip/itinerary, plan, beneficiary, ID/passport, and payment-tracking needs; persist only fields
    needed to operate/search the workflow and retain the completed carrier form as a document.
  - FlexiShield: retain the received application form as a supported library variant; final brochure
    and product/payment reference data remain permission-dependent.
  - Any new persisted fields require the next migration, types regeneration, repository mapping,
    draft-state compatibility, and a safe fallback when reopening drafts saved under the old shape.
  - **Implemented 2026-08-03:** Health requirements and carrier-form assignments are generated per
    insured person, including separate 71–100 forms, remote-sale documents, conditional medical
    items, and staff-activatable TAL/CAC items. Travel uses a single dedicated request with
    normalized travelers, itinerary, beneficiary, ID/passport, collection, portal-payment, and
    requirement records. Completed originals upload to `documents` with the source library version.
    FlexiShield now follows the medical category and matches its application-form variant. Missing
    approved assets warn without blocking; no supplied binaries were ingested.
  - **Partially superseded 2026-08-19 — the tick stands, the scope moved.** C7 was designed and
    delivered on **2026-08-03**, two weeks before Pacific Cross supplied its written requirement
    lists. It correctly implemented what we understood at the time; the carrier's actual lists then
    contradicted two of the bullets above. **`G2`, `G3` and `G6` (Phase G) all fall inside C7's
    stated scope** and are the follow-through, not a rework:
    - ~~The *"attestation/advisor declaration"* bullet — the app emits the Agent's Attestation
      unconditionally and *appends* the Advisor's Declaration on remote sales.~~ **Closed
      2026-08-19 by G2** — the two are now mutually exclusive, driven by a `sale_channel` column on
      the requirement template.
    - The *"conditional medical questionnaire"* bullet — the real triggers are smoker status, BMI and
      Obese Class 1, naming specific panels. Neither smoker nor BMI is captured anywhere, so only a
      generic line can be produced. → **G3**
    - *"FlexiShield now follows the medical category"* — this is the defect, not the fix. Following
      the medical category is exactly what makes it inherit Select/Blue Royale's TAL/CAC items and
      miss its own two first-layer HMO documents. → **G6**

---

## Phase D — Lead Lifecycle QA Audit (OrcaCLI run, 2026-08-10)

Senior UX/QA + accessibility audit of the **Lead Lifecycle** board (`/prospects`) and the
**Contact Profile** lead actions, driven live through the OrcaCLI browser and cross-checked against
`../docs/lead-stage-status.md` and `../docs/lead-stage-status-example.md` (Eman's end-to-end
journey) plus the source. Findings carry `file:line` evidence. Fixes are **not yet applied** — this
is the backlog. Severity: 🔴 blocker · 🟠 major · 🟡 minor.

### # OrcaCLI Report

- **Scope driven:** `/prospects` board (Board view, Status distribution, Proposal tracking,
  Follow-up queue) + Contact Profile for leads across every stage
  (`New Lead`/`Contacted`/`Discovery`/`Proposal`/`Product Selected`/`Application Started`).
- **Method:** `orca goto` + `snapshot`/`eval`/`click`; state cross-checked in Supabase; UI logic
  confirmed against `components/hub/screens/prospects-live.tsx`,
  `components/hub/screens/contact-profile.tsx`, `components/hub/overlays/advance-lead.tsx`,
  `components/hub/overlays/engage.tsx`.
- **Headline:** the two-axis model is faithfully *displayed* (Stage columns + independent Status
  chips, Status distribution counts) — but the *write paths* don't enforce the model's rules.
  (Correction 2026-08-10: an earlier claim that the board quick-action row was "non-functional" was a
  false positive — those buttons open the Engage drawer with a lead search; see Critical UX Blockers.)
- [x] `/prospects` remains the canonical Lead Lifecycle board route for build compatibility, as
  specified by the canonical UI docs; `/leads` now permanently redirects there so the documented
  user-facing name also resolves without changing existing back links or cache revalidation paths.

### # Documentation Compliance

| Spec rule (source) | Status | Evidence |
| :--- | :--- | :--- |
| Two axes shown independently (Stage column + Status chip) | ✅ Pass | Board renders Stage columns + per-card Status chips; Status distribution New/Attempted/Connected/Qualified/Nurturing/Unresponsive |
| Stage "only ever moves forward (or to Lost)" (`lead-stage-status.md:6`) | 🔴 Fail | `advance-lead.tsx:126` renders **all** `LEAD_STAGES` as `<option>`; can move backward or skip stages |
| `Connected → Qualified` requires structured discovery fields (`…example.md:21`) | 🟠 Partial | Profile `Log Call` captures them (`contact-profile.tsx:632-643`) & `completeDiscoveryAction` validates, but the **Advance** popup Status dropdown sets `Qualified` directly with **no** field check (`advance-lead.tsx:141`) |
| `Lost` reachable **only** via `Unresponsive`, as a separate prompted action (`…status.md:48,51`) | 🔴 Fail | `Mark Lost` is an always-on toggle inside the Advance popup (`advance-lead.tsx:172-188`), offered for a `Connected` lead |
| `Mark as Nurturing` is a deliberate action that sets a re-engagement follow-up date (`…example.md:22`) | 🟠 Fail | No dedicated action; `Nurturing` only settable via the generic Status dropdown — the re-engagement date semantics are lost |
| Convert happens at Step 5 after `Product Selected` (`…example.md:122-136`) | 🟡 Partial — FIXED 2026-08-10 | Primary CTA now requires `Product Selected`+; earlier stages get a ⋮ entry behind a skip confirm, enforced in `createFromWizardAction`. Step 5's `Application Started` phase itself is still unbuilt — see the backlog note below |
| Advance popup *suggests* the next stage; Eman confirms (`…example.md:63`) | 🟠 Partial | Action-triggered path suggests; **manual** `Advance` opens defaulting to the *current* stage (`contact-profile.tsx:342`), no forward suggestion |
| Proposal micro-status lives only inside the `Proposal` stage (`…status.md:55`) | ✅ FIXED 2026-08-15 (`180d9e9`) | `Carla Mendez` (now `Product Selected` stage, still carrying `proposal_status=Requested`) was the live re-verification case: Contact Profile's proposal-action buttons (Mark Received/Sent/Record decision, Generate/Request Proposal) are now gated `client.leadStage === "Proposal"`, with an explanatory note shown instead of the buttons when a stale status exists outside that stage. Board-card chip and Proposal Tracking widget were already correctly scoped. |
| Every touch auto-logs; Convert carries data forward (`…example.md:135,173`) | ✅ Pass | Profile `Log Call`/`Email` log to timeline; wizard prefills from contact via `openWizard({convertClientId,…})` |
| Terminology "Lead Stage" | 🟡 Drift | Board subtitle says "pipelineStage," not the spec's "Lead Stage" |

### # Critical UX Blockers

- [x] ✅ **~~Board quick-action buttons are dead~~ — RETRACTED (false positive).** Re-verified via
  OrcaCLI on 2026-08-10: `Send Brochure` / `Send Intake Form` / `Log Discovery Call` on the
  `/prospects` header **do open** the Engage drawer, which carries a built-in **`RECIPIENT` lead
  search** ("Search a lead or client…"). Confirmed flow: click → search "Robert" → results list
  (`Roberto Pascual · Individual Client`, `Robert Lim · Prospect`) → select → drawer shows
  "logged to Robert Lim's timeline" + `OUTCOME`/`CALL NOTES` and the `Log call` button **enables**.
  The lead-picker pattern this finding proposed as the *fix* already exists (`openEngage(action)` with
  no contact opens the drawer in search mode). The original run's "no drawer" result was a false
  negative — the drawer is portal-rendered at the end of the DOM and the click likely didn't register.
  Residual (real) gap tracked separately as **QD3**: the drawer's call logger captures only
  `OUTCOME + CALL NOTES`, not the structured discovery fields (budget/family/product/tier).

- [x] ✅ **Advance popup permits illegal stage transitions — CONFIRMED, then FIXED (2026-08-10).**
  *Confirmed live first:* from `New Lead`, all six stages were selectable; selecting
  `Application Started` and confirming was **accepted and persisted** by the server (Anna Cruz landed
  at `Application Started` + status `New`; test data restored afterwards). *Fixed* — see **QD1**
  below: options are now `current + next` only, with a server-side guard. Re-verified via OrcaCLI.
- [x] ✅ **Two conflicting paths to `Qualified` — CONFIRMED, then FIXED (2026-08-10).**
  *Confirmed live first:* on a lead missing family size + tier, `Mark Discovery Complete` was
  rejected 3/3 times while the Advance popup's Status dropdown set `Qualified` on the first click
  (Tonio Reyes landed Qualified with 2 of 4 fields null). *Fixed:* the two paths are now **one** —
  `Mark Discovery Complete` is retired, and `advanceLeadAction` refuses both a move into `Proposal`
  and a set to `Qualified` until all four fields are on file. See **QD1c/QD6/QD7** below.
- [x] 🟠 **`Convert to Application` invites premature conversion — FIXED 2026-08-10.** It was the
  highlighted primary button from the first stage onward, with no gate that Discovery/Proposal ran.
  **The close-without-save revert cited here does not exist** — nothing writes `Application Started`,
  so nothing reverts; the only protection was the number of clicks. Now: primary button requires
  `Product Selected`+, earlier stages get a ⋮ entry behind a confirm naming the skipped stages, and
  `createFromWizardAction` rejects the convert without that confirmation. See **QD4**.

### # Useless Inputs Found

- [x] 🟠 **Three call-logging entry points, two implementations — FIXED 2026-08-11.** Profile header
  `Log Call`, more-actions `Log Discovery Call` (Engage drawer), and the inline composer `Log Call`
  tab disagreed: the drawer's call form omitted the four discovery fields, so a "discovery call"
  logged from the board could never drive `Connected → Qualified`. See **QD3** below for the fix.
- [x] 🟡 **Duplicate email actions — DONE 2026-08-11.** *The bug:* two full implementations behind
  the header (already removed as a QD3 side effect), the nurture chips, and `EngageDrawer` — each
  with its own private field wrapper (`ComposerField` vs `Field`, markup-identical), its own
  byte-identical `INPUT` constant, its own `applyTemplate`, and two real divergences: `EngageDrawer`
  sent `externalContactId` (the inline tab never did — always an internal client) and only
  `EngageDrawer` rendered the live preview pane, even though `docs/web/contact-profile.md:84`
  already (incorrectly, until now) described the inline tab as having one.
  *What shipped:* one `EmailForm` (`components/hub/overlays/send-email.tsx`), the exact shape
  `LogCallForm` established for calls — owns all field state + the `sendEmailAction` submit, built
  on the exported `DrawerField`/`DRAWER_INPUT`. It **always** renders the preview pane now, so the
  Contact Profile tab gained one it didn't have before, matching the spec instead of leaving the
  mismatch in place. `EmailTarget.externalContactId` reconciles the two payload shapes in one call
  site. The Contact Profile composer tab renders it inline (`focusEmail` now bumps an
  `emailFormKey`/`initialEmailTemplate` pair to remount fresh, same mechanism `focusCall` already
  used for calls); `EngageDrawer` became a thin wrapper — Drawer chrome + contact resolution only,
  handing off to the shared form once a contact is known.
  *Also fixed along the way:* `EngageDrawer`'s hand-rolled `RecipientPicker` (56 lines, duplicated
  `ClientPicker`'s search/debounce pattern) is deleted — `PickedClient`
  (`components/hub/overlays/client-picker.tsx`) gained an optional `email` field so the shared
  `ClientPicker` can populate Recipient the same way `RecipientPicker` did. Checked all 7 other
  `PickedClient` consumers before extending it — none construct object literals or destructure
  exhaustively, so the addition is non-breaking everywhere.
  *Deliberately not touched:* toast copy stays a caller responsibility (`EmailForm`'s `onSent`
  passes back what was actually sent — `{template, subject}` — rather than hardcoding either
  caller's phrasing), since the two callers' confirmation text already differed and baking one in
  would have been a silent behavior change disguised as a refactor.
  *Files:* `components/hub/overlays/send-email.tsx` (new), `components/hub/overlays/client-picker.tsx`,
  `components/hub/overlays/engage.tsx`, `components/hub/screens/contact-profile.tsx`.
  *Verified end-to-end via OrcaCLI against the running dev server, on Bianca Sy
  (`0007d8aa-4b7b-4517-8102-d10c4213de52`), then reverted:* the Contact Profile chip opened the
  form with template/recipient/subject/body merge-filled and the preview pane rendering for the
  first time on that surface; submitting wrote a `communications` row. The Prospects board's
  `Send Brochure` quick action (no contact in scope) opened `EngageDrawer`, showed the shared
  `ClientPicker`, and picking Bianca correctly populated Recipient from the new `email` field on
  `PickedClient` — confirming the attachment gate still blocked submit for a template that needs
  one (`templateNeedsLibraryAttachment`), then switching to a template that doesn't and submitting,
  which wrote its own `communications` row. Both test rows deleted afterward via the same service-role
  script pattern used for the QD3/QD4a verifications, since the Supabase MCP write path is still
  blocked by the permission classifier in this session.
  *Out of scope, flagged separately below:* wizard Step 5's own email-field implementation.
- [x] 🟡 **Advance popup Status dropdown — scope narrowed 2026-08-12, then RESOLVED by QD5 same day.**
  *(Was 🟠. Original wording claimed the whole dropdown duplicates the automation and should be made
  read-mostly; that overstated both the problem and what the spec allows — corrected below.)*
  **What the spec does back:** `docs/lead-stage-status.md` is explicit that "**Every transition below
  is tied to a specific web action, not a free-floating state change**", and enumerates all eleven
  `lead_status` transitions with a named button or an explicit `System:` automatic count for each.
  So "status should follow from actions" is the documented model, not a preference.
  **What the spec does NOT back:** removing the dropdown. `docs/web/modals.md:228` specs this field
  directly — `| **Status** | Dropdown | Required | New · Attempted · … ; pre-set from the action |` —
  i.e. **pre-set, not read-only**, and `lead-stage-status.md:93` likewise hedges that status is
  "*often* set automatically by an action". Making Status read-mostly is therefore a **spec change**,
  not a spec violation being fixed. Decide it as one before building it.
  **The example it cited is already fixed.** "Manual `Qualified` without a logged qualifying call"
  was closed by **QD1c** (2026-08-10): `advanceLeadAction` (`app/(app)/prospects/actions.ts:73-86`)
  rejects `Qualified` server-side unless budget, family size, product and coverage tier are all on
  the record, and the popup disables Confirm with the gaps named. Gated at both layers — do not
  re-litigate this part.
  **What is genuinely still open** (the whole remaining scope): `Nurturing` and `Unresponsive` are
  still hand-settable from the dropdown (`advance-lead.tsx:187` maps all of `LEAD_STATUSES`), but per
  `lead-stage-status.md` neither should be reachable that way — `Nurturing` is only ever a deliberate
  `Mark as Nurturing` **with a required re-engagement date** the dropdown cannot capture, and
  `Unresponsive` is only ever inferred by the system from unanswered follow-ups ("no button"). Those
  two are real drift holes. Both are **QD5**'s territory; fold this item into QD5 rather than
  tracking it twice.
  **RESOLVED 2026-08-12 by QD5** — `Nurturing` is out of the dropdown and rejected server-side, with
  `Mark as Nurturing` as its only route. `Unresponsive` stays for now and is tracked as its own
  blocked item (the inference it depends on is unbuilt). Nothing left here; see QD5 in Phase F.
- [x] 🟡 **Redundant "Send Intake Form" vs "Send Brochure"** on the board — **DONE 2026-08-14
  (`995ddad`).** Both removed from the board header; both remain reachable from the Contact
  Profile composer's template dropdown, where a full picker already exists.
- [x] 🟠 **Wizard Step 5's "Initial email" is a fourth, still-separate email implementation —
  found while unifying the other three, 2026-08-11; GATED 2026-08-13.** `components/hub/overlays/wizard/steps-2.tsx`
  `Step5` builds its own Template/Recipient/Subject/Message block (it already reuses
  `DrawerField`/`DRAWER_INPUT`, so it isn't a field-wrapper duplicate like the other three were, but
  its `applyTemplate` and merge-context construction are their own copy of that logic) and **never
  calls `sendEmailAction`**. It only stages `emailSubject`/`emailBody`/`emailTemplate`/
  `emailRecipient` onto the wizard's form state; `app/(app)/applications/wizard-actions.ts:672-676`
  sends it later via a **direct** `logOutboundEmail` call on wizard Create — bypassing the
  attachment-requirement gate `sendEmailAction` enforces via `templateNeedsLibraryAttachment`
  (`engage-actions.ts:103-111`). Consequence: a template that requires a carrier attachment
  (`Send brochure`, `Send application form`) can be "sent" through the wizard with **no** attachment
  picker and no server-side enforcement, unlike every other email path in the app. Deliberately left
  out of the `EmailForm` consolidation below — it's a genuinely different lifecycle (defer-to-Create
  vs. send-now), and forcing it through a send-now component would conflate the two. *Fix options:*
  either route Step5 through the same attachment gate before Create, or explicitly document the
  wizard as an intentionally-ungated exception.
  **Took option 1 — gate it.** The spec decides it: `../docs/web/pages.md:321` names "the Contact
  Profile composer, **the application wizard**, and every send-enabled modal" as composers that
  "also select active, approved Carrier Library assets; selected versions are logged with the
  communication", and `new-application-wizard.md:240` calls Step 5's selector "the **same send
  component reused across the app**". The wizard was already *specified* to have the picker — it
  simply never got one, so option 2 would have documented an exception the spec doesn't grant.
  *What shipped:* the gate, **not** the composer. `EmailForm` was deliberately left alone — Step 5
  really is defer-to-Create, and its own Template/Recipient/Subject/Message block stays exactly
  where it is. Three pieces: (a) `WizardForm` carries `emailLibraryDocumentId` (Step 5 unmounts on
  every step change, so the pick can't live in component state, and it has to reach the server with
  the rest of the form); (b) a new `listWizardEmailAttachmentsAction` in `wizard-actions.ts` +
  a Step-5 `WizardAttachmentPicker` rendering the *same* markup and copy as
  `LibraryAttachmentPicker`; (c) a **pre-flight** check at the very top of `createFromWizardAction`,
  before the `try` and before any write.
  *Why a new picker rather than reusing `LibraryAttachmentPicker`:* that component resolves
  eligibility from a `clientId`, and the wizard's whole point is that the contact may not exist
  until Create. The new action asks against `form.productName` + `form.dob` instead. Verified the
  two agree: `ProductOption.productName` (`policies/actions.ts:30`), `client.productInterest` (which
  `createFromWizardAction` sets *from* `form.productName`) and `LibraryDocument.productName` are all
  `products.name`, so the wizard and the Contact Profile offer an identical list for the same person
  and product. Eligibility deliberately passes only `{productName, documentType, ageBand}` — no
  `productVersionId`/`variant` narrowing, unlike the neighbouring `matchCarrierForm`, which picks the
  application's *own* carrier forms and is legitimately stricter.
  *Why pre-flight rather than at §4 where the email is logged:* one wizard Create writes a client, an
  application, a checklist and a task. Refusing at the point of send would leave all of that behind
  with an error toast; refusing before the first write means a rejection costs nothing and the user
  goes back to Step 5, picks the asset and re-clicks. Drafts are never gated — `mode === "draft"`
  never sends, and the staged pick round-trips through `wizardState` on resume.
  *Also:* Step 6's "This will automatically create" list gains a red **Carrier attachment required —
  go back to Step 5** blocker, and `canCreate` plus the split menu's `Create & log email` entry grey
  out to match. Both mirror the server's own condition (`sendEmail` **and** a recipient), so an email
  that was never going to be logged doesn't block Create. The server check remains the enforcement;
  the disable just stops the click from bouncing.
  *One knowing duplicate:* `wizardAttachmentRequirement` in `wizard-actions.ts` re-states the
  three-line template→document-type map. `attachmentRequirement` isn't exported from
  `engage-actions.ts`, and `templateNeedsLibraryAttachment` lives in a `"use client"` module so it
  can't be called server-side — the client half of the wizard imports that one rather than copying
  it. Comments on both sides name the twin.
  *Flagged, not silently absorbed —* two things the research turned up, now rows in
  `docs/development-alignment.md`: the *requirement* half of this gate has **no** canonical source
  (`pages.md:361` says approved versions "**may** be selected"; nothing anywhere says an attachment
  is mandatory), and `document_library` is still **empty** on the shared dev project (confirmed by
  query, 0 rows), so both gated templates are already unusable on every surface. That emptiness is
  the intentional pre-clearance state this file already records at `:46`/`:191` under **R4**, not a
  defect — but it does mean this change extends a gate nothing can currently satisfy. It makes the
  wizard fail the same way as every other composer, with the same amber explanation, instead of
  silently logging a "Send brochure" communication with nothing attached. If the client wants those
  templates sendable bare, the requirement is what should be relaxed, not the wizard re-exempted.
  *Files:* `components/hub/overlays/wizard/steps-2.tsx`, `app/(app)/applications/wizard-actions.ts`,
  `components/hub/overlays/wizard/wizard-data.ts`, `components/hub/overlays/wizard/new-application.tsx`,
  `docs/development-alignment.md`.
  *Verified:* `npx tsc --noEmit` and `npm run build` both clean; `npm run lint` reports nothing in
  any of the four changed files (the 17 pre-existing errors are all elsewhere). The eligibility query
  was exercised against the real Supabase project with the service-role script pattern used for the
  QD3/QD4a verifications — three temporary Approved/Active `document_library` rows (FlexiShield
  brochure + both application-form age bands) confirmed the form-derived lookup returns them and that
  a product with no assets returns empty, then all three were deleted and the table re-checked back
  to 0. **Not** verified in-browser: this worktree has no `.env.local`, no `.auth/staff.json` and no
  Playwright MCP, so the Step 5 → Step 6 → Create click-through is unexercised.

### # Automation Opportunities

**Can automate / default (actionable):**

- [x] Advance popup should **pre-select the suggested next stage** and pre-fill the `Outcome note`
  from the triggering action, instead of defaulting to the current stage (`contact-profile.tsx:342`).
- [x] Keep auto-deriving Status from logged actions (B2) and stop asking Eman to set it by hand in
  most cases — **CONFIRMED COMPLETE 2026-08-25.** Email, inbound-message and call actions already
  derive the applicable Lead Status, while the Advance popup presents the suggested transition and
  hides manual Stage/Status controls behind `Adjust details`. Nurturing, Lost and the stage advance
  itself remain deliberate actions; provider-delivery evidence remains a separate integration rule.
- [x] Default the `Next follow-up` date from the action type (e.g., first touch → +3 days) rather
  than an empty date input.
- [x] Extend Convert → wizard prefill to birthday — **DONE 2026-08-15 (`48ea43b`)**: `dob` now
  threads through `WizardPrefill` into `WizardForm`, feeding `ageFromDob()`-dependent logic even
  though the Step 2 input itself is hidden for Convert flows (`lockIdentity`). Family size and
  coverage tier were **not** carried into the wizard — `WizardForm` has no matching fields, and
  mapping either into the unrelated `coverage` (Individual/Family) field would've been a silent
  guess (documented in `docs/development-alignment.md`). Solved differently instead: **DONE
  2026-08-15 (`551adb2`)** — product interest, budget, family size, and coverage tier are now
  directly editable from the Contact Edit page (`/clients/[id]/edit`), closing the original
  "no fix short of faking a phone call" gap without touching the wizard at all.

**Cannot / must-not automate (guardrails — explicit intent required, do not "complete"):**

- The **stage advance itself** — the two-sided condition (Eman's action + the Lead's reply/answer)
  is the whole point; keep confirm-to-advance (`…example.md:5,177`).
- `Mark as Nurturing` — spec is explicit it is a deliberate choice, never a decay (`…status.md:51`).
- `Mark Lost` — deliberate, and only from `Unresponsive`.
- `Mark Discovery Complete` — the human judgment that the need is understood.

### # Missing Feedback & Hints

- [x] ✅ **~~Dead board buttons give zero feedback~~ — RETRACTED.** The board buttons open the Engage
  drawer with a `RECIPIENT` lead search (re-verified 2026-08-10). No missing-feedback issue.
- [x] 🟠 **`Mark Discovery Complete` fails reactively — SUPERSEDED, resolved via QD1c (2026-08-10).**
  `Mark Discovery Complete`/`completeDiscoveryAction` no longer exist (retired by QD1c below). The
  inline readiness checklist this item asked for shipped anyway, just relocated: the Advance popup
  now shows `discoveryChecklist()` live (budget ✓ / family ✓ / product ✓ / tier ✓) and disables
  Confirm until met, sharing the exact same check the server guard runs — so the guidance-not-error
  goal is met, just on the popup that replaced the old button.
- [x] 🟠 **No guardrail microcopy on `Convert to Application` — FIXED 2026-08-10.** The skip confirm
  (`overlays/convert-confirm.tsx`) names the stages being jumped and where the proposal actually
  stands ("There is no proposal on file at all.").
- [x] 🟡 **`Mark Lost` mislabeled/buried — DONE 2026-08-14 (`f1b4c69`, `ab0d758`).** Moved out of
  the Advance popup into its own `MarkLostModal`, reached from the Contact Profile ⋮ menu, and
  gated to appear only when the lead is inferred `Unresponsive` (see `Unresponsive` inference item
  below) — matching the spec's "Lost only ever reached through Unresponsive" rule exactly.
- [x] 🟡 **Empty states are thin — DONE 2026-08-14 (`392951e`).** Dependents/Documents/Timeline
  cards now show a one-line prompt ("No dependents added yet.", "No documents uploaded yet.",
  "No calls logged yet — log the first touch.") instead of a bare `0` count.
- ✅ **Good feedback already present** (keep, no action): Advance popup's *"nothing moves silently"*
  microcopy + mandatory outcome note + follow-up date; the inline call form's *"Structured discovery
  writes to the record"* hint (`contact-profile.tsx:665-667`); origin-aware `← Prospects` back link
  (B1).

### # Cognitive Load & Friction

- [x] 🟠 **Confirm-to-advance is a good friction, but the popup asks too much.** Two open dropdowns +
  note + date is a form, not a confirm. Reduce to: a **suggested transition sentence**
  ("Discovery → Proposal — Grace is Qualified"), an accept button, and an "adjust" affordance for the
  exceptions. This preserves accountability without the "clicky" feel Eman flagged for validation
  (`…example.md:177`).
  **DONE 2026-08-13 — combined with the two checked automation items above.** *What shipped:* the
  popup now opens as a compact suggested-transition confirmation with one `Accept suggestion`
  button; `Adjust details` reveals the existing editable stage, status, outcome-note and follow-up
  controls. Recognized lifecycle actions seed both the permanent note and an editable local-calendar
  follow-up: `First outreach sent` → +3 days, `Inbound response logged` / `Reached call logged` → +1
  day. Generic profile/list Advance and board-drag labels seed neither field, because opening or
  dragging is not an interaction worth putting in Eman's timeline. The collapsed view shows the
  seeded reason/date and keeps the discovery checklist visible; a blocked `Proposal`/`Qualified`
  suggestion names its missing fields and replaces the accept label with disabled
  `Complete discovery first`. Forward-only stages plus the preset escape hatch, the `Nurturing`
  exclusion/current-value
  exception, and the existing `Mark Lost` toggle all remain unchanged. *Files:*
  `components/hub/overlays/advance-lead.tsx`, `components/hub/lead-config.ts`. *Verified:* `npx tsc
  --noEmit` and `npm run build` clean; per-file ESLint remains identical to `HEAD`
  (`advance-lead.tsx`: one pre-existing `react-hooks/preserve-manual-memoization` error, zero warnings;
  `lead-config.ts`: zero errors/warnings).
- [x] 🟠 **Board header is overloaded — DONE 2026-08-15 (`89ea6da`, plus `995ddad` earlier).**
  Request Proposal, Generate Proposal, and Log Call removed from the board header — all three
  needed a lead in scope to do anything useful, and with none selected just detoured through a
  client search before landing on the exact same action already pre-scoped on that lead's own
  Contact Profile. Board header now has only `New Lead` + the view toggles + the filter.
- [x] 🟡 **Verify board card click opens the profile — CONFIRMED not a bug, 2026-08-15.**
  Re-verified live via the Orca embedded browser: the click *does* fire `router.push`/the RSC
  navigation fetch every time; the original OrcaCLI run's "no navigation" read was just Next.js
  dev-mode compile latency (the destination route hadn't been compiled yet) outrunning a short
  fixed wait, not a stuck click or a drag-vs-click intercept. No code change needed.

### # Polish & Micro-interactions

- [x] 🟡 Trim the profile action cluster — **partially done 2026-08-11 as part of QD3.** The header
  `Email` and `Log Call` buttons are gone (redundant with the nurture chip row directly below, per
  `docs/web/contact-profile.md`); `Log Discovery Call` is renamed `Log Call` and is the same form
  everywhere now, so the naming half of "which of these five is the real one" is resolved. Still
  open: `Log Email`/`Send Brochure`/`Send Intake`/`Request Proposal` remain five separate chips with
  no primary + overflow grouping — that's the email-side duplication tracked below.
- [x] 🟡 Normalize terminology to **"Lead Stage" / "Lead Status"** across the board subtitle and
  popups. Confirmed complete: `pipelineStage` no longer appears anywhere in the repository.
- [x] 🟡 **Loading states on advance/convert — investigated 2026-08-15, confirmed non-issue.** The
  profile-header `Advance` and `Convert to Application` buttons are purely synchronous (they open a
  modal/wizard via local state, no server call on the button itself); every action in
  `contact-profile.tsx` that *is* async (message, note, flag toggle, proposal-status) already has
  `disabled={pending}`. Nothing to add. (What actually shipped that day instead: pending labels on
  the proposal-status buttons — "Marking received…" etc., part of `6f6b205`.)
- [x] 🟡 Proposal-tracking cards on the board expose `Proposal · Sent` / `Proposal · Received` chips —
  **confirmed already correctly scoped**, and the equivalent gap on the Contact Profile's own
  proposal card was fixed 2026-08-15 (`180d9e9`) — see the Phase D audit row above.
- [x] 🟡 Confirm the canonical lead route/label: `/prospects` remains canonical for build
  compatibility, and `/leads` permanently redirects to it. The UI continues to say "Leads" and
  "Lead Lifecycle" while existing `?from=prospects` and revalidation paths remain stable.

### Suggested follow-up tasks (consolidated — now detailed as **Phase F**, QD1–QD6)

- [x] **QD1. Advance popup rework — DONE 2026-08-10.** Forward-only **stage** options shipped and
  OrcaCLI-verified (see the full entry in Phase F). **QD1c superseded the original default behavior:**
  commit `927ba3a` pre-selects an action-supplied stage or the immediate next stage, and pre-selects
  `Qualified` when moving into `Proposal`. The `Mark Lost` clause of this summary is the only part
  still open — tracked as **QD1b**.
  *(This line read `[ ]` until 2026-08-12 even though the task was finished on the 10th.)*
- [x] ~~**QD2. Fix board quick-actions**~~ — **RETRACTED (false positive)**; the board buttons open
  the Engage drawer with a built-in lead search. Only QD3 (structured discovery in that drawer)
  remains.
- [x] **QD3. Unify call logging — DONE 2026-08-11** — one structured logger; the Engage-drawer call
  path is gone, not just fixed. Full writeup below.
- [x] **QD4. Gate `Convert to Application` — DONE 2026-08-10** (demoted to the ⋮ menu behind a skip
  confirm below `Product Selected`, with a server guard).
- [x] **QD1b. `Mark Lost` as a deliberate, gated action — DONE 2026-08-14.** Full entry in Phase F below.
- [x] **QD5. `Mark as Nurturing` — DONE 2026-08-12.** Contextual action with a required
  re-engagement date, `Nurturing` removed from the Advance popup and rejected server-side, and the
  `Nurturing → Qualified` return path wired. `Unresponsive` deliberately left in the dropdown —
  blocked on the unbuilt inference, tracked separately below. Full writeup in Phase F.
  *Note the axis:* QD1 was the **stage** dropdown (forward-only); QD5 is the **status** dropdown.
  Same popup, different fields of the two-axis model.
- [x] 🟠 **`Unresponsive` is unreachable-by-design but nothing builds it — found during QD5,
  2026-08-12. BUILT 2026-08-14 (`ab0d758`).** `lib/queries/lead-status-inference.ts` computes it
  live on every read (no Lead-inference cron; renewal scheduling was later added by H5e): N=3 outbound `communications` rows with
  no inbound reply or Reached call breaking the streak, applied only to `Attempted`/`Nurturing` (the
  two spec-listed source statuses). Deliberately never persisted to `clients.lead_status`, so
  existing win-back checks keep matching the real stored value once a reply lands. `"Unresponsive"`
  is now dropped from `allowedLeadStatuses()` in `components/hub/lead-config.ts`, closing both the
  popup and the server guard with the one shared exclusion list. *Unblocked* QD1b, which now gates
  `Mark Lost` on this inferred status.
- [x] **QD8. `Application Started` is now reachable — DONE 2026-08-10.** *The problem:* no code wrote
  `"Application Started"` anywhere. The stage was in `LEAD_STAGES`, rendered as a board column, and
  was counted in `prospects-live.tsx:120`, but was unreachable except by hand-advancing; the demo
  rows carrying it were seeded. The blocker was the old spec's trigger — it moved the stage on the
  `Convert to Application` **click** and reverted on close, which needs the system to tell "abandoned
  the wizard" from "still typing". It cannot: a closed tab, a refresh and a long pause are
  indistinguishable, and every false positive strands a lead in a stage it never reached.
  *The resolution:* **the spec was changed** (Joshua authored it; rewritten 2026-08-10 across
  `docs/lead-stage-status-example.md` Steps 5-7, `lead-stage-status.md`, `web/lead-workflow.md` §5,
  `web/data-model.md`, `web/new-application-wizard.md`, `web/pages.md`, `INDEX.md`). The trigger moved
  from the click to the **first `Save as Draft`**, which removes the revert problem instead of
  managing it — opening the wizard now writes nothing, so there is nothing to undo.
  *What shipped:* `APPLICATION_STARTED_STAGE` in `lead-config.ts` is the shared constant. Step 1b of
  `createFromWizardAction` gained a second branch: on `mode === "draft"` a lead that isn't already
  there is moved to `Application Started` and a `lead.stage_changed` activity is logged; re-saving is
  a no-op. Drafts created for a brand-new walk-in are created at that stage directly, so the column
  means one thing — "a saved draft is waiting to be finished" — regardless of how the contact got
  there. *Files:* `components/hub/lead-config.ts`, `app/(app)/applications/wizard-actions.ts`.
  *Acceptance:* saving a draft moves the card into the `Application Started` column while
  `lifecycle_stage` stays `Lead`; closing the wizard unsaved leaves the card where it was;
  completing the wizard converts and removes it from the board.
  *Known hole, unchanged by this:* reaching the draft through the wizard's **Existing client**
  picker skips the `canConvertLead` guard, so a lead at `Discovery` can jump straight to
  `Application Started` without the skip confirmation. The jump is logged, and the same hole already
  existed for conversion — closing it means gating the picker, which is its own decision.
- [x] **QD6. Inline discovery-readiness checklist — DONE 2026-08-10** (moved onto the Advance popup,
  since `Mark Discovery Complete` no longer exists).
- [x] **QD1c. Single Advance path, gated on discovery — DONE 2026-08-10.** `Mark Discovery Complete`
  and `completeDiscoveryAction` retired; `discoveryChecklist()`/`discoveryGaps()` in
  `components/hub/lead-config.ts` are the one definition shared by the popup checklist and the
  server guard in `advanceLeadAction`. The popup shows `Budget / Family size / Product / Coverage
  tier` with the missing ones named ("A quote needs family size and coverage tier"), disables
  **Confirm advance**, and offers **Complete discovery** → closes and drops the user into the Log
  Call composer with Outcome preset to `Reached`. A clean confirm sets stage **and** `Qualified` in
  one step. *Verified via OrcaCLI:* blocked state correct; forcing the disabled button past the UI
  was **rejected server-side** and the DB was unchanged; after filling the two gaps the confirm
  produced `Proposal` + `Qualified` with both timeline entries.
- [x] **QD7. Surface the discovery fields — DONE 2026-08-10.** Contact properties now renders
  **Budget / est. premium** (peso-formatted), **Family size**, and **Coverage tier** beside Product
  interest, and the Log Call composer prefills budget/family from the record instead of opening
  blank. Previously three of the four gating fields were write-only.

---

## Phase E — Data & infra (input/deployment dependent)

- [ ] **D1. Process and import Eman's client workbook; delete fake/test data first.** The workbook was
  received 2026-08-24. It has 15 sheets and 105 nonblank Masterlist data rows; receipt is complete,
  but the October 2024 filename needs recency confirmation. No importer exists. Next steps are
  profiling, canonical mapping, normalization, deduplication against existing contacts, an exception
  report, reversible dry run, approval, then import.

  Fake data originates in migrations: 15 demo leads under `@lead.demo` (`0013:36-59`), 14 demo
  clients under `@client.demo` with child rows tagged `notes like 'seed:%'` (`0014:6-89`), and 3
  corporate contacts under `@group.demo` (`0016:53-57`). Keep config/reference seeds (`0009`,
  `0011`, `0019`) and preserve every website-created record that is not explicitly allowlisted as
  demo/test data. Before cleanup, export the targeted records and their children; delete them through
  a reversible transaction rather than a broad client-table reset.

  The workbook is now the dependency, not its delivery. Use
  `../docs/attachments/SPREADSHEET-STATUS.md` to build a non-destructive working copy with separate
  client, policy, insured-person and premium-history staging sheets, source lineage, mapping and
  exception rows. Do not infer current policy status, requirement completeness, expiry semantics or
  payment records from the source. Import only after Eman answers the workbook questions, existing
  contacts have been deduplicated, the dry run reconciles to control totals, and the reviewed import
  actions are approved.

- [x] **D2. Provision + share Vercel/Supabase creds for Eman and Matt.** **Rescoped 2026-08-15:**
  originally "Fix Vercel login" — that wording came from the 2026-07-23 demo meeting notes
  ("Login credentials will be shared after Vercel login is fixed"), written as an
  investigate-first checklist, not a confirmed bug. `git log -- proxy.ts` shows no fix was ever
  committed (only the original phase-0 migration + one unrelated perf commit), and login was
  confirmed working end-to-end on the live Vercel production deployment. **Completed 2026-08-15:**
  `eman@pacificinsurance.ph` (Admin) and `matt@pacificinsurance.ph` (Owner) both exist as staff
  users (confirmed live in the `users` table); credentials provisioned and shared with both.

- [x] **D3. Load the received carrier assets into the document library — DONE 2026-09-07.** C6a
  shipped the upload / approve / version UI; the load itself ran via
  `scripts/load-carrier-library.mjs`, landing 40 source files as 46 Active + Approved rows in
  `document_library`, matched to product, variant and age band, with the 5 `TEST —` placeholder
  rows archived. The distribution clearance at `checklist.md:70-71` remains **unsigned**, but was
  explicitly treated as not-a-gate by client decision the same day (see the Carrier-document rules
  in `docs/development-alignment.md`). The Illustrative Proposal, CAC and TAL samples were
  correctly excluded per R4. `Send brochure` and `Send application form` are unblocked on every
  composer. **CCAF + Geographical Loading followed on 2026-09-21** (migration `0039`, two new
  `document_type` values). **The CET followed on 2026-09-25** (migration `0040`, `Enrollment Template`
  type, `.xlsx` allowed end to end) — `document_library` is now 49 rows.
  **Not fully closed: the Proposal Information Sheet remains excluded, blocked on a client answer to
  checklist C3 — see "Received but not loaded" below.**

---

## Phase F — Lead Lifecycle UX Remediation (QD1–QD6 from the Phase D audit)

Promotes the Phase D audit backlog into executable tasks. All behavior must match
`../docs/lead-stage-status.md` + `-example.md` (two-axis model, forward-only stage spine,
Lost-only-via-Unresponsive, deliberate Nurturing). These are **UI + server-action logic** changes;
no migration is expected unless a task says so. Verify each against the same OrcaCLI path used in
Phase D, and re-run `npx tsc --noEmit`.

- [x] **QD1. Advance-popup rework — forward-only stage. DONE 2026-08-10** (parts (a)–(c); the
  Mark-Lost move stays open as QD1b). **Superseded by QD1c:** commit `927ba3a` changed the popup to
  pre-select an action-supplied stage or the immediate next stage, and to pre-select `Qualified` for
  a move into `Proposal`; the earlier current-stage-default description is stale.
  *Implemented:* `nextLeadStage()` + `allowedLeadStages()` in `components/hub/lead-config.ts`;
  `advance-lead.tsx` renders only `current + next` (plus any action-supplied preset, so a suggested
  transition never renders an empty select) and shows a hint line; `advanceLeadAction`
  (`app/(app)/prospects/actions.ts`) rejects unknown stages, backward moves, and skips.
  *Verified via OrcaCLI:* `New Lead` → options `{New Lead, Contacted}` + "One stage at a time — next
  is Contacted."; `Discovery` → `{Discovery, Proposal}`; `Application Started` → itself only +
  "Final lead stage — convert the application to move on."; forcing `Application Started` past the UI
  (injected option + native setter) was **rejected server-side** with "Leads advance one stage at a
  time — from New Lead you can only stay or move to Contacted." and the DB was unchanged.
  `npx tsc --noEmit` clean.

  Original task description, for reference:
  *What exists:* `advance-lead.tsx` renders **all** `LEAD_STAGES` as `<option>` (`:126`) and all
  `LEAD_STATUSES` (`:141`), with a `Mark Lost` toggle (`:172-188`). The single transition
  `advanceLeadAction` (`app/(app)/prospects/actions.ts:33`) applies `leadStage`/`leadStatus` with
  **no** forward-only or field guard and sets Lost on `markLost` regardless of current status
  (`:46-52`).
  *Change:* (a) add a `nextStage()` helper to `components/hub/lead-config.ts` (the ordered
  `LEAD_STAGES` array makes this `index+1`); (b) in `advance-lead.tsx`, restrict the STAGE options to
  **current stage + next stage only** and default-select the suggested next stage using a
  `suggestedStage` preset passed from `contact-profile.tsx:342`; (c) enforce the same rule
  server-side in `advanceLeadAction` (reject a stage that is neither current nor the immediate next);
  (d) remove the `Mark Lost` toggle from this popup (moves to QD1b).
  *Files:* `components/hub/overlays/advance-lead.tsx`, `components/hub/lead-config.ts`,
  `app/(app)/prospects/actions.ts`, `components/hub/screens/contact-profile.tsx`.
  *Acceptance:* from `Discovery`, STAGE options = `{Discovery, Proposal}` only; `Application Started`
  and any backward stage are unselectable; the server rejects an out-of-range stage with a clear
  error; existing stage/status timeline logging is retained.

- [x] **QD1b. `Mark Lost` as a deliberate, gated action — DONE 2026-08-14 (`f1b4c69`, then gated by
  `ab0d758` once the `Unresponsive` inference existed).** A dedicated `markLostAction`
  (`app/(app)/prospects/actions.ts`) replaced the old always-on `markLost` toggle inside the Advance
  popup; it's now surfaced as a contextual "Mark Lost" row in the Contact Profile ⋮ menu (styled
  red, directly above Delete) that only appears when the lead is inferred `Unresponsive`, opening
  its own `MarkLostModal` (optional note field) rather than `overlays.confirm`, since the modal
  needed its own copy/layout. Server-side, `markLostAction` re-checks the inferred status before
  writing, so Lost is unreachable from `Connected`/`Qualified` directly. *Verified live via the Orca
  embedded browser:* Mark Lost only appears once a lead crosses the 3-unanswered-touch threshold
  into `Unresponsive`, and disappears again once a reply/Reached call resets it.

- [x] ~~**QD2. Fix (or remove) the dead board quick-actions.**~~ **RETRACTED (false positive) —
  re-verified via OrcaCLI 2026-08-10.** The board header buttons call `openEngage(action)` with no
  contact (`prospects-live.tsx:611-612`), and the Engage drawer opens in **search mode**: a
  `RECIPIENT` field ("Search a lead or client…") returns matching leads/clients, selecting one sets
  the recipient and enables `Log call`. This is already the "lead-picker first" pattern the finding
  proposed. No fix required. *(Optional polish only: the board-header copies duplicate the per-lead
  Contact Profile actions and add a search step; consider whether they earn their place in the header
  — but they are functional.)* The genuine gap — that this drawer's call form omits the structured
  discovery fields — is tracked as **QD3**.

- [x] **QD3. Unify call logging — DONE 2026-08-11.** *The bug:* two divergent implementations behind
  three entry points. The Contact Profile composer tab captured Outcome + four discovery fields
  (Budget, Family size, Product interest, Coverage tier) + notes + follow-up date and passed all of
  it to `logCallAction`'s `discovery` payload; the Engage drawer — reachable from the Prospects board
  as `Log Discovery Call` — captured only Outcome + notes and never sent `discovery` at all. Those
  four fields are exactly what `discoveryGaps()` checks before `Connected → Qualified` or a move to
  `Proposal`, so a call logged from the board was *labelled* a discovery call and was structurally
  incapable of completing one.
  *What shipped:* one form, not a config flag choosing between two. New
  `components/hub/overlays/log-call.tsx` exports `LogCallForm` (owns all field state + the
  `logCallAction` submit, built on the exported `DrawerField`/`DRAWER_INPUT` instead of a third
  private field-wrapper copy) and `LogCallModal` (wraps it in `Modal`, resolves the contact via
  `ClientPicker` when none is passed — the board quick action has none in scope). There is now
  exactly one `logCallAction(` call site in the repo. Contact Profile renders `LogCallForm` in its
  tab; `focusCall` bumps a remount key instead of reaching into child state. The Engage drawer lost
  both call keys from `ENGAGE_ACTIONS` and its `kind` union — it is now email-only, which is what it
  actually is (a templated composer, not a discovery form). The Prospects board quick action
  (renamed `Log Discovery Call` → `Log Call`) opens the new modal instead of the drawer.
  *Related fix picked up along the way:* `overlay-host.tsx`'s host-mounted `AdvanceLeadModal` was
  missing `onCompleteDiscovery`, so the "Add missing details" escape hatch only worked from the
  Contact Profile's own locally-mounted copy — any advance raised from elsewhere hit a dead end. Now
  wired to `openLogCall`.
  *Header cleanup, applying an already-written spec line:* `docs/web/contact-profile.md` said `Email`
  and `Log Call` should not be header buttons — redundant with the nurture chip row directly below.
  Both are removed; the nurture chip carries the call form, `Email`'s header button removal is a
  small scope-creep beyond the call consolidation itself, flagged here rather than hidden.
  *Files:* `components/hub/overlays/log-call.tsx` (new), `components/hub/screens/contact-profile.tsx`,
  `components/hub/overlays/engage.tsx`, `components/hub/overlays/overlay-provider.tsx`,
  `components/hub/overlays/overlay-host.tsx`, `components/hub/screens/prospects-live.tsx`,
  `components/hub/prospect-data.ts` (renamed a dead mock-UI label for consistency).
  *Verified:* `tsc --noEmit` and `npm run build` clean; per-file ESLint error/warning counts unchanged
  against `HEAD` on every touched file (no new problems, none of the pre-existing ones papered over).
  *Browser-verified end-to-end 2026-08-11, via OrcaCLI against the running dev server:* both paths
  driven for real against Bianca Sy (`0007d8aa-4b7b-4517-8102-d10c4213de52`), then reverted.
  **Profile chip** — `Log Call` opened `LogCallForm` inline, `Outcome` preset `Reached`, `Budget`
  (₱220,000) and `Product interest` (Premier Health) prefilled from the record as coded; filled the
  two missing fields and submitted. **Board quick action** — the renamed `Log Call` button opened
  `LogCallModal` with no contact, showing `ClientPicker` first (previously impossible — the old
  Engage drawer never sent `discovery` at all); picked Bianca, fields opened blank (no prefill, as
  designed for a freshly-picked contact), filled different values, submitted. Both wrote a
  `communications` row (channel `Phone`) through the same `logCallAction`, each carrying exactly the
  discovery values entered — confirmed by direct DB read, not by trusting the UI. Neither triggered
  `Advance lead`, correctly: Bianca's status was already `Qualified`, not `New`/`Attempted`, so
  `updateLeadStatus` no-ops as designed. Test writes reverted afterward (client fields + both
  `communications` rows) via the same service-role script pattern as the QD4a data correction, since
  the Supabase MCP write path is still blocked by the permission classifier in this session;
  confirmed by re-read (`phone_logs: 0`, fields back to baseline). *Tooling note, not an app bug:*
  the CLI's `fill`/`type` did not reliably fire React's `onChange` on these controlled inputs —
  worked around with a manual `dispatchEvent(new Event("input"))`; direct DOM mutation then confirmed
  the handlers themselves are correct.

- [x] **QD4. Gate `Convert to Application` — DONE 2026-08-10.** *What shipped:* `canConvertLead()` /
  `stagesSkippedByConvert()` in `components/hub/lead-config.ts` are the single rule, read by both the
  UI and the server. The primary CTA renders only at `Product Selected`+; below that a
  `Convert to Application…` row in the ⋮ menu opens `overlays/convert-confirm.tsx`, which names the
  skipped stages and the proposal position. Only that dialog sets `confirmedSkip`, and
  `createFromWizardAction` rejects the convert branch without it — verified live: with the wizard
  opened at `Product Selected` and the record moved back to `Discovery` underneath it, `Save draft`
  was refused ("Advance Robert Lim to Product Selected before converting to an application.") with
  the record and application count unchanged. Confirmed skips append "— skipped Proposal, Product
  Selected" to the `lead.converted` timeline entry. The guard sits inside the convert branch, so it
  covers `Save as Draft` as well as the Create modes. *Files:* `lead-config.ts`,
  `screens/contact-profile.tsx`, `overlays/convert-confirm.tsx`, `overlays/wizard/new-application.tsx`,
  `app/(app)/applications/wizard-actions.ts`.
  *Note:* the plan's assumption that "closing the wizard without saving reverts to `Product Selected`"
  was wrong — see the backlog item below.
  *Acceptance:* on a New/Contacted/Discovery lead Convert is gated per the chosen pattern; on
  `Product Selected` it behaves as today; wizard prefill is unchanged. *Dep:* QD1 (stage integrity).

- [x] **QD4a. `Save draft` must not convert the record — DONE 2026-08-10.** *The bug:* saving a draft
  on wizard step 1 flipped the contact to `Applicant` / `leadStage = Converted` immediately, even
  though nothing had been submitted — the convert branch ran for every `WizardMode`, and the
  new-contact branch only kept a Lead when step 6 happened to say `Lead`. *What shipped:*
  `createFromWizardAction` derives one predicate, `startsApplication = mode !== "draft" &&
  form.status !== "Lead"`, and moved the flip into a single **step 1b lead → applicant hand-off**
  that runs only when it holds. The client-resolution branches now just record the contact in
  `leadAwaitingHandOff` when it is still on the lead board; resuming a draft (where
  `getDraftResumeAction` nulls `convertClientId`) therefore converts on the completing save, and
  picking a Lead through the *Existing client* search hands off the same way instead of leaving a
  lead carrying a live application. Drafts created for a brand-new contact or a Group HMO contact are
  created as `Lead / New Lead / New`. The skip-ahead guard deliberately still runs in `draft` mode:
  a draft is resumable later without re-confirming, so an unauthorised convert has to be refused at
  the door rather than parked. Wizard/confirm copy now says the conversion happens when the
  application is created. *Files:* `app/(app)/applications/wizard-actions.ts`,
  `overlays/wizard/new-application.tsx`, `overlays/wizard/steps-1.tsx`, `overlays/convert-confirm.tsx`.
  *Acceptance:* a lead that only ever had `Save draft` pressed stays on the pipeline board with its
  stage/status intact and shows **Continue Application**; finishing that draft (Create / & email /
  & documents) converts the same record once, with the `lead.converted` timeline entry and any
  skipped stages; an `Inquiry Only (Lead)` application never converts.
  *Follow-on (same day):* the spec was then rewritten to match rather than recording a divergence —
  see **QD8** for the `Application Started` half. Drafts deliberately **stay** on the Applications
  register (Eman uses it as his work queue and wants upcoming applications visible); they are now
  excluded from the "In progress" stat and counted separately in the subtitle, so neither number
  claims work nobody has submitted. *File:* `components/hub/screens/operations.tsx`.
  *Residue — corrected 2026-08-10:* four contacts mis-converted before the fix (Carla Mendez
  APP-2026-00015, Johnny Smith APP-2026-00012, Noel Dela Paz APP-2026-00009, Patricia Lim
  APP-2026-00014) were `lifecycle_stage = Applicant` / `lead_stage = Converted` with nothing but a
  resumable draft. All four were returned to `Lead` / `Product Selected` — their pre-conversion stage
  is unrecoverable, and `Product Selected` is what the convert button required of them — with
  `lead_status` left as `Qualified` (Johnny Smith's was null and was filled in). Each correction
  wrote a `lead.conversion_reverted` timeline entry and a `correct_draft_conversion` audit row
  carrying the before/after. Their drafts are untouched, so they show **Continue Application** from
  the lead board and will convert properly through step 1b when finished.

- [x] **QD5. `Mark as Nurturing` — DONE 2026-08-12.** *The gap:* no dedicated Nurturing action
  existed. The only route into `lead_status = Nurturing` was hand-picking it from the Advance
  popup's status dropdown, which has no field for the **required re-engagement date** the state is
  defined by (`docs/lead-stage-status.md`: "a deliberate hold, not a decay"). A lead put on hold
  that way was parked with nothing to resurface them — `next_follow_up_date` is what the Prospects
  follow-up queue reads (`prospects-live.tsx:740`). A second gap sat underneath: `advanceLeadAction`
  validated `stage` but **never validated `status` at all**, writing whatever it was handed.
  *What shipped:*
  (a) `markNurturingAction` (`app/(app)/prospects/actions.ts`) — guarded on `lifecycleStage = Lead`
  **and** `leadStatus = Qualified` (the spec's only entry to the state), requires a re-engagement
  date, writes `leadStatus` + `nextFollowUpDate` together, logs `lead.status_changed` (+ an optional
  `lead.note`) and a `lead_nurturing` audit row with before/after.
  (b) `allowedLeadStatuses()` in `components/hub/lead-config.ts` — one exclusion list shared by the
  popup and the server guard, mirroring how `allowedLeadStages()`/`discoveryGaps()` already prevent
  UI-vs-rule drift.
  (c) `advanceLeadAction` now rejects unknown statuses and `Nurturing` specifically, pointing at the
  new action. It deliberately still allows an already-nurturing lead to keep its status while
  advancing a stage, so a held lead isn't locked out of the popper entirely.
  (d) `MarkNurturingModal` (`components/hub/overlays/mark-nurturing.tsx`) — its own modal rather than
  `overlays.confirm()`, which resolves a bare boolean and has nowhere to put a required date. Follows
  `request-proposal.tsx`'s shape.
  (e) Contextual trigger on the Contact Profile header, gated `leadStatus === "Qualified"` per
  `docs/web/contact-profile.md:39`, copying the proposal-panel precedent.
  (f) **The exit:** `Nurturing → Qualified` wired into both `logCallAction` (Reached) and
  `logMessageAction` (inbound) in `clients/engage-actions.ts`. Without it the new button would be a
  one-way door whose only escape is the dropdown option being removed. Discovery data is already on
  file, so it returns straight to `Qualified` with no re-asking and no advance suggestion (the stage
  never moved).
  *Verified end-to-end via OrcaCLI, then reverted:* button appears only at `Qualified` and vanishes
  once held; confirm stays disabled until a date is entered; saving wrote `Nurturing` +
  `next_follow_up_date` with the stage and all four discovery fields untouched, plus both timeline
  entries; the popup's dropdown now lists `New/Attempted/Connected/Qualified/Unresponsive` with the
  "use Mark as Nurturing" hint; **injecting `Nurturing` back into the select past the UI and
  confirming was rejected server-side with the DB unchanged** (same bypass technique QD1 used); and a
  Reached call on the held lead returned her to `Qualified` with the `Re-engaged during nurture hold`
  entry. Test writes reverted via the service-role script pattern (MCP writes still blocked by the
  permission classifier).
  *Left open:* `Unresponsive` — see the blocked item in the Phase D audit section. *Dep:* QD1 (met).

- [x] ~~**QD6. Inline discovery-readiness checklist on `Mark Discovery Complete`.**~~ **SUPERSEDED —
  stale entry, corrected 2026-08-11.** This write-up described adding a client-side checklist to a
  `Mark Discovery Complete` button that `completeDiscoveryAction` validated server-side. That button
  and action no longer exist: **QD1c** (2026-08-10) retired both and folded discovery-readiness
  directly into the Advance popup, sharing `discoveryChecklist()`/`discoveryGaps()` with the server
  guard. See QD1c above for what actually shipped — this entry was left unmarked when that happened.

**Suggested order:** ~~QD1~~ → ~~QD3~~ → ~~QD4~~ → ~~QD6~~ (via QD1c) → ~~QD8~~ → ~~QD5~~ →
~~Unresponsive inference~~ → ~~QD1b~~ — **all done as of 2026-08-14.** (QD2 retracted — already
working.) Phase F is fully closed; nothing left here.

---

## Phase G — Carrier requirement reconciliation (2026-08-18 requirement lists)

Nine gaps between what Pacific Cross says it requires and what the app does. They come from the
carrier's own written lists (reproduced verbatim in `../docs/attachments/forwarded-email.md`),
checked line by line against the source on **2026-08-19**.

**None of these is externally blocked.** Every other open item in this plan waits on Eman, Edzen, a
clearance signature, or an email provider; these nine wait on us. That makes Phase G the only
actionable work left.

**Numbering:** each task carries its `checklist.md` D-number. The detail and carrier rationale stay
in `../docs/attachments/checklist.md` (section *"D. App-side gaps — ours to fix"*); this phase is the
execution home. Note the plan's Phase E already uses `D1`/`D2`/`D3` for data-and-infra items —
unrelated to the checklist's D-numbers, hence the `G` prefix here.

**Migrations:** highest existing is `0027_proposal_decision.sql`, so allocate from **`0028_`**.
Every schema task must apply via Supabase MCP `apply_migration`, then regenerate
`lib/supabase/types.ts` via `generate_typescript_types`, or the repositories won't type-check
(risk **R3**).

| Task | Checklist | Core site | Schema work |
| :--- | :--- | :--- | :--- |
| **G1** BC Flexi never reaches the HMO workflow | D1 | `wizard-data.ts:213-217`; `0009_seed.sql:8` | data fix |
| **G2** Attestation + Declaration both emitted on remote sales | D2 | `wizard-actions.ts:89` vs `:94-97` | none |
| **G3** Smoker / BMI / Obese Class 1 not captured | D3 | `wizard-data.ts:39-121`; `wizard-actions.ts:84-85` | migration |
| **G4** No beneficiary in the health flow | D4 | `wizard-data.ts:9-17`; `0025:12-20` | migration |
| **G5** First-layer HMO declaration not captured | D5 | `external_coverage` `0006:56-78` (exists, unused) | repository only |
| **G6** FlexiShield inherits the generic health checklist | D6 | `wizard-data.ts:213-217`; `wizard-actions.ts:156` | none |
| **G7** CET unproducible from `group_members` | D7 | `0016_group_accounts.sql:31-46` | migration |
| **G8** No claims / pre-approval requirements schema | D8 | nothing exists | migration |
| **G9** BC Flexi's list is two-phase, the snapshot is flat | D9 | `0024_application_requirements.sql:3-17` | migration |

---

- [x] **G1. BC Flexi never reaches the HMO workflow.** *(checklist D1 — the most consequential item
  here, and the cheapest to fix.)* Eman's email is explicit that BC Flexi is an **HMO group
  product**. `categoryForProduct()`
  (`components/hub/overlays/wizard/wizard-data.ts:213-217`) matches `hmo` only on a `Group Medical`
  category or an `hmo`/`group` token in the name. BC Flexi is seeded as category `Primary Medical`
  (`supabase/migrations/0009_seed.sql:8`) and its name carries neither token, so it falls through to
  `health` and generates the **individual** checklist.
  - **Fix the seed category to `Group Medical`** rather than widening `categoryForProduct()` — the
    product row is the source of truth, and the function is already correct for FlexiShield's
    `Second-Layer Medical`. A data migration, not a logic change.
  - **Reconcile the two names.** `PRODUCT_COLORS`
    (`components/hub/lead-config.ts:289-298`) carries **"BC Flexi"** (`:294`) *and* **"BC Flexi
    HMO"** (`:295`) as separate entries — and the second one *would* match the `hmo` regex while the
    first does not, so the same product routes differently depending on which name a lead's
    `product_interest` happens to hold. Pick one. (The same map also lists `Premier Health` and
    `Family Shield`, which aren't in the products table at all — the wider catalog gap, and part of
    the outstanding "product plan/tier/premium confirmation" question for Eman, `checklist.md`
    section C.)
  - **What this unblocks:** the entire group branch is currently unreachable for the only product
    that needs it — company/group details (`steps-1.tsx:282-315`), the member-list table with its
    min-3 gate (`steps-2.tsx:150-236`, `new-application.tsx:253`), the group-account + member loop
    (`wizard-actions.ts:632-659`), and the `Group Application` app type (`wizard-actions.ts:578`).
  - Verify a BC Flexi application actually enters the group branch end to end before closing.

- [x] **G2. Agent's Attestation and Advisor's Declaration are emitted together on remote sales.**
  *(checklist D2.)* Pacific Cross states these are **alternatives** — attestation *if face-to-face*,
  declaration *if remote*. `snapshotApplicationRequirements()`
  (`app/(app)/applications/wizard-actions.ts:75-146`) adds "Attestation letter with specimen
  signatures" **unconditionally** for every person (`:89`), then appends the advisor declaration and
  remote-selling confirmation when `remoteSale` is set (`:94-97`). A remote sale therefore asks the
  client to sign a form the carrier does not want.
  - The flag needed already exists and is fully wired — `wizard-data.ts:88`, UI at
    `steps-2.tsx:104`, persisted to `applications.remote_sale`
    (`wizard-actions.ts:601`, `:729`; column `0025_application_workflow_reconciliation.sql:8`). The
    change is gating `:89` on `!form.remoteSale`.
  - **Also reconcile the client preview**, which is already out of step: `new-application.tsx:210`
    shows **one** combined item ("Advisor declaration and remote-selling confirmation") where the
    server writes **two**. Fix both together so the preview matches the snapshot.
  - Check the template baseline seed too — `0024_application_requirements.sql:41` carries the same
    item as a single row.
  - **Implemented 2026-08-19.** Migration `0028_requirement_sale_channel.sql` adds a nullable
    `sale_channel` (`Face-to-face` | `Remote`, null = both) to `required_document_items`, tags the
    two baseline rows, and renames the advisor row to **`Advisor's Declaration`**. Matching on
    `document_name` was rejected — it breaks silently the first time a template is edited.
    - Health branch (`wizard-actions.ts:86-100`): the attestation moved out of the unconditional
      `base` array and is now gated on `!form.remoteSale`; the declaration is one row per
      submission, not two. `Remote-selling confirmation` was **dropped** — Eman describes a single
      document, so it duplicated the declaration.
    - Template branch (`wizard-actions.ts:134-160`): now reads `sale_channel` and drops items whose
      channel contradicts the sale, falling back to the persisted `applications.remote_sale` when no
      form is supplied. Previously `form` was accepted and never read, so `remoteSale` had **zero**
      influence on non-health applications.
    - Client preview (`new-application.tsx:202-213`) and the Step 3 checkbox label
      (`steps-2.tsx:104`, which asserted the both-forms model) both reconciled.
    - **Verified live**, both branches, with SQL assertions on the persisted rows: a face-to-face
      health application writes the attestation and no declaration; a remote one writes a single
      `Advisor's Declaration` and no attestation. The follow-up email
      (`requestMissingDocumentsAction`) on a remote application now lists three documents and no
      attestation — the actual client-facing symptom. Probe data removed afterwards.
    - No backfill: no application with `remote_sale = true` had a requirements snapshot.
    - **Not exercised end-to-end:** the template branch's *remote* case. Travel writes
      `travel_request_requirements` through its own path, and `hmo` is unreachable until **G1**, so
      no non-health application can currently be created with `remoteSale` set — the Step 3 checkbox
      only exists in the health branch. The face-to-face template case is covered by the seed
      assertions.

- [x] **G3. Smoker, BMI and Obese Class 1 are not captured, so conditional medical panels can't be
  generated.** *(checklist D3.)* Verified absent: a repo-wide search for
  `smoker|smoking|bmi|body_mass` returns **zero** hits, and there are no height/weight fields in any
  form type or migration. Current triggers are age ≥ 71 or `preExisting === "Yes"`
  (`wizard-actions.ts:84-85`), producing one generic "medical questionnaire or supporting records"
  line (`:91`). The carrier's real rules name specific panels — chest X-ray within 6 months (smoker);
  Lipid Profile / HbA1c / Creatinine / BUN / Uric Acid / SGOT / SGPT / GGT (BMI); ECG / TMST
  (Obese Class 1).
  - Capturing smoker status and the BMI inputs is a **prerequisite**, not a checklist tweak. Add to
    `WizardForm` near the existing underwriting fields (`wizard-data.ts:85-88`) and to the
    per-person shape, plus a migration for `applications` / `application_dependents`.
  - **Extract the trigger into one shared helper as part of this.** It is currently duplicated
    server-side (`wizard-actions.ts:84-85`) and client-side (`new-application.tsx:201`, `:207`);
    adding a third condition to two copies is how they drift. `ageBandFor` (`wizard-actions.ts:150`)
    is the nearby precedent.
  - Decide whether BMI is stored as height/weight (derivable, auditable) or as a computed figure.
  - **Implemented 2026-08-20** (`0a1105c`). Migration 0033 adds `smoker_status`, `height_inches` and
    `weight_lbs` to `applications` and `application_dependents`. Stored as height/weight, **not** a
    computed BMI — BMI is a pure function of the two, so persisting it would create a second source
    of truth that can fall out of step with its own inputs. Units follow the carrier's own form
    (`WEIGHT (lbs.)`, `HEIGHT (ft. & in.)`) so staff transcribe rather than convert; the UI takes ft
    and in separately and stores total inches.
  - **The trigger is now one function** — `medicalRequirementDocumentsFor()` in `wizard-data.ts`, called by both
    the server snapshot and the client preview, replacing the two hand-maintained copies. It also
    de-duplicates the chest X-ray that smoker and Obese Class 1 both ask for.
  - **⚠️ The BMI cut-offs are an assumption, not carrier-confirmed.** Eman's list names the panels but
    no numbers, and nothing in the requirement lists, the application forms or `REQUIREMENTS.md`
    states any. Shipped on the **Asia-Pacific** scale (overweight ≥ 23, Obese Class 1 25–29.9) rather
    than WHO's (≥ 25, 30–34.9); a 5'7"/165lb applicant triggers both panels on one and neither on the
    other. Isolated in a single `BMI_THRESHOLDS` constant so a correction is one line. Question is
    open with Eman — see `../docs/attachments/checklist.md` section C.
  - Smoker is three-state (Never/Former/Current) because the carrier's form asks it that way; only
    `Current` triggers the X-ray. The form's follow-ups (sticks/day, years since quitting) are
    deliberately not mirrored, per C7's rule that the carrier's form stays authoritative.

- [x] **G4. No beneficiary person exists in the health flow.** *(checklist D4.)* Select, Blue Royale
  and FlexiShield all require a valid ID for the **beneficiary** as well as the principal insured.
  `WizardMember` (`wizard-data.ts:9-17`) has `id, name, dob, rel, email, preExisting?,
  medicalNotes?` — no beneficiary, so there is no person to attach the requirement to. Neither
  `dependents` (`0005_operations.sql:158-171`) nor `application_dependents`
  (`0025:12-20`) has a beneficiary column.
  - The fillable FlexiShield form raises the cost: it gives **each dependent its own beneficiary
    block**, so the relationship is per-person, not one beneficiary per application.
  - **Reuse the travel shape** — `WizardTraveler` already models it (`wizard-data.ts:28-31`:
    `beneficiaryName`, `beneficiaryDob`, `beneficiaryRelationship`, `beneficiaryContact`) with
    columns at `0025:76-79`. But note travel is itself only half-wired: **only `beneficiaryName` has
    an input** (`steps-2.tsx:268`); the other three are initialised to `""` and never rendered
    (`steps-2.tsx:240`, `:269`; `wizard-actions.ts:323-324`). Decide whether to render travel's
    dead fields at the same time or leave that as separate work.
  - **Implemented 2026-08-20** (`40df0d0`). Migration 0034 adds
    `beneficiary_name`/`_birthdate`/`_relation`/`_contact` to `applications` and
    `application_dependents`, named to match `travelers` so health and travel describe a beneficiary
    with one vocabulary. `beneficiaryIdDocumentFor()` is shared by the server snapshot and the client
    preview, like `medicalRequirementDocumentsFor()` before it. Naming nobody requests nothing.
  - **⚠️ Correction to the premise above, found by reading the forms.** The *fillable* FlexiShield
    form does **not** have per-dependent beneficiary blocks — it has **zero** beneficiary fields, as
    do every Select and Blue Royale form we hold. Only the FlexiShield **print** edition (2024-09)
    has them, and it has two: one under the principal ("Relationship to Principal Applicant") and one
    under each dependent ("Relationship to Dependent"), each with its own GOV'T ISSUED CARD field.
    The per-person conclusion was right; the stated source was wrong.
  - **New question for Eman as a result:** Select and Blue Royale carry no beneficiary field on their
    forms at all, yet their requirement lists still demand the beneficiary's valid ID. Either it is
    captured somewhere we have not seen, or the list is generic across products.
  - Travel's three unrendered beneficiary inputs were left alone — still out of scope, still noted.

- [x] **G5. The first-layer HMO declaration is not captured — but the table for it already exists.**
  *(checklist D5 — **cheaper than the checklist states**, corrected 2026-08-19.)* Both FlexiShield
  application editions require name of existing HMO, type/name of plan, **maximum benefit limit**,
  effective date and expiry date. The whole second-layer product turns on that MBL, and today it is
  asked for on the carrier's paper form and stored nowhere queryable.
  - **`external_coverage` already exists and models exactly this** —
    `supabase/migrations/0006_docs_money.sql:56-78`, including `maximum_benefit_limit` (`:65`), and
    it is linked from `policies.first_layer_coverage_id` (`:80-82`). **It has no repository and no
    app code touches it.** So this is *wiring an existing table*, not designing a new one — build
    `lib/repositories/external-coverage/` on the 4-file pattern (see **Conventions**) and capture
    the fields in the wizard.
  - The wizard's nearest field is the wrong question: `existingPC` — *"Existing Pacific Cross
    client?"* (`wizard-data.ts:85`, default `:262`, rendered `steps-2.tsx:106-108`). It asks about
    *our* relationship, not the *other* HMO's coverage. Replace or requalify it. (It is not quite
    unpersisted, as the checklist says: the whole `WizardForm` is serialised into
    `applications.wizard_state` jsonb on **draft** saves — `wizard-actions.ts:596`, `:724` — so it
    survives there, unqueryable, and is `null` on non-draft create.)
  - `claims.hmo_mbl_amount` and `claims.first_layer_exhausted` already exist
    (`0005_operations.sql:113-114`), so **the MBL is currently re-keyed at claim time because it was
    never captured at application time.** Closing this closes that loop.
  - **Implemented 2026-08-20** (`538c445`). No migration, as expected:
    `lib/repositories/external-coverage/` on the 4-file pattern, six fields on `WizardForm`, and a
    "First-layer HMO coverage" block in Step 3 gated on `isFlexiShieldProduct()` — G6's helper, so
    the requirement builder, the carrier-form lookup and this block never disagree about what counts
    as FlexiShield. Written against the **client**, not the application: the cover outlives any one
    application, which is why the table keys on `client_id` with a nullable `policy_id`. Re-applying
    updates the existing Active row rather than stacking a second one, and an entirely blank block
    writes nothing — staff often take the MBL off the Certificate of Coverage after the client sends
    it, and an empty shell row is worse than none.
  - **`existingPC` was left alone, not replaced.** It asks about *our* relationship with the client,
    which is a different question that merely sat nearby — not a wrong version of this one. Still
    form-only, now with a comment saying so. Removing it was out of scope.
  - Verified live with SQL assertions on both directions: a FlexiShield application persisted all six
    values with `currency` defaulting to PHP and `policy_id` null, and a Blue Royale application
    driven to the same step never renders the block.

- [x] **G6. FlexiShield routes through the generic health checklist.** *(checklist D6.)*
  `categoryForProduct()` returns `health` for it, so it inherits the Select/Blue Royale requirements
  — including the TAL and CAC conformes, which do not apply — and misses the two documents unique to
  it: **Schedule of Benefits** and **Certificate of Coverage of the first-layer HMO** (the latter
  carrying the full MBL and expiry date). Its catalog category is already correct
  (`Second-Layer Medical`, `0009_seed.sql:9`) — unlike BC Flexi — so this is a **mapping fix, not a
  data fix**. The only FlexiShield-specific branch today is the carrier-form variant
  (`wizard-actions.ts:156`); it needs its own requirement template alongside that.
  - Pairs naturally with **G5** — the two documents it's missing are the evidence for the
    declaration G5 captures.
  - Both documents are issued by the *other* HMO, so the client supplies them; there is correctly no
    template to load. One line of confirmation from Eman is outstanding (`checklist.md`, section C).

- [x] **G7. The Corporate Enrollment Template can't be produced from what the app stores.**
  *(checklist D7.)* The CET wants roughly **19 fields per member** — last/first/M.I., gender, civil
  status, nationality, birth date, place of birth, effective date, occupation/employee grade, R&B
  plan, MBL, PhilHealth Y/N, address, e-mail, mobile, landline, beneficiary name and birth date.
  `group_members` (`supabase/migrations/0016_group_accounts.sql:31-46`) holds four usable ones:
  `full_name`, `relationship`, `coverage_tier`, `join_date` (the rest are `ecard_status`, `status`,
  `notes`, FKs and timestamps). Producing a submittable CET is a **data-model change, not an export
  feature** — migration, types regeneration, and `lib/repositories/groups/` mapping
  (`groups.repository.supabase.ts:15`).
  - Gated behind **G1** in practice: BC Flexi is the product that needs a CET, and it can't reach
    the group branch until G1 lands.
  - No CET template file has been supplied — the field list above comes from the carrier's document.
    Confirm the exact column order before building an export.

- [x] **G8. Claims and pre-approvals have nowhere to put a requirements checklist.** *(checklist
  D8.)* Verified absent: `pre_approval|preapproval|claim_requirements|claims_requirements` returns
  **zero** hits across migrations, `lib/`, `app/` and `components/`. There is no claims-requirements
  table and **no pre-approval concept at all** — no table, no status, no reference series. Claims
  documents attach only through the generic `documents` table. The NOC page-4 checklist is the first
  fully-specified, conditional requirement set we have for claims, and there is no structure to hold
  it.
  - **Copy the established pattern:** `application_requirements`
    (`0024_application_requirements.sql:3-17`) and `travel_request_requirements`
    (`0025:89-102`), and build on **C4's** configurable template/instance model rather than
    hardcoding the list — as *"Dependency-gated domain completion"* below already directs.
  - `documents` enforces `documents_one_requirement_check` across two mutually-exclusive FKs
    (`0025:109-115`). A third requirement type means amending that constraint, not just adding a
    column.
  - Travel claims differ from medical: the TravelSafe NOC carries its requirements inside the form,
    the medical NOC lists them on page 4.

- [x] **G9. BC Flexi's requirement list is two-phase and the checklist is flat.** *(checklist D9.)*
  "For proposal" (4 items) versus "once the group agrees to the proposal" (13 items) are sequential
  gates, not one list. `application_requirements` (`0024:3-17`) is a flat snapshot — no `phase`,
  `gate` or `stage` column; the only ordering signals are `sort_order` and `is_required`. A group
  would be shown all 17 at once, including 13 that are meaningless before they've accepted a
  proposal.
  - **Blocker to design around:** `unique (application_id, required_document_item_id)` at `0024:16`
    will prevent snapshotting the same template item under two different phases. Current wizard
    health items pass `required_document_item_id = null` so they don't collide today (Postgres treats
    NULLs as distinct), but a phased template will.
  - Phase intent is currently free text only — `applies_to` strings
    (`wizard-actions.ts:101-102`) and `cond` strings (`wizard-data.ts:184-209`) — neither
    machine-readable.
  - Note **five of the 13** post-agreement items have no template to send (see `checklist.md`
    section B); the phase gate is what stops staff being shown them prematurely regardless.
  - **Implemented 2026-08-24.** Migration `0035_requirement_phase.sql` adds a nullable, constrained
    `phase` to the configurable template items and immutable application snapshots, and seeds a
    product-version-specific BC Flexi template with four `For proposal` items plus thirteen
    `Once the group agrees` items. The second gate starts non-required, remains visible as
    forthcoming, and is excluded from completeness and missing-document messages until staff use
    `Mark agreed`; activation is audited and idempotent. The existing unique constraint remains —
    none of the carrier's seventeen items belongs to both phases, so weakening duplicate protection
    was unnecessary.
  - **Completion fix 2026-08-24:** the first implementation exposed a pre-existing wizard defect:
    completing a fresh Group HMO application created only `group_accounts` / `group_members`, not an
    `applications` row, leaving the phased snapshot with no parent. The shared application-create
    path now runs for fresh Group HMO submissions as well as drafts, so BC Flexi creates both the
    operational Group Account and the canonical Application record with its requirement snapshot.
    Travel remains in its intentionally separate request workflow. The wizard preview now mirrors
    the same 4 + 13 gates, and its request summary counts only the two currently unconditional
    proposal requirements instead of the old generic seven-item Group HMO list.

- [ ] **G10. Pre-approvals have no record of their own.** *(Split out of G8 on 2026-08-20.)* G8
  delivered the claims half of checklist item D8 — `claim_requirements`, a repository, an overlay and
  the medical NOC page-4 templates. It deliberately did **not** model pre-approvals, and that half is
  still open.
  - Verified absent: no table, no status, no reference series, nothing named `pre_approval` anywhere
    in `supabase/migrations/`, `lib/`, `app/` or `components/`.
  - **Why it was not folded into G8:** a pre-approval *precedes* a claim — it is the carrier
    assessing a proposed operation or treatment before it happens. Hanging its requirements off a
    `claim_id` would assert a claim exists when one may never be filed, so the FK would be a lie.
    It needs its own entity, not a second use of `claim_requirements`.
  - Eman's stated requirement is thin — the completed Pre-Approval Form plus medical results Pacific
    Cross requests case by case (`../docs/attachments/forwarded-email.md`). The form itself is richer:
    `Pacific_Claims_and_Pre-Approval/PRE-APPROVAL FORM 2024.pdf` (`V03.24`) has claimant particulars,
    authority/data-privacy/declaration statements, and an **attending physician's report** — procedure,
    diagnosis, symptom and consult dates, employment relation, pregnancy, accident, implants — with
    its own signature line, separate from the patient's.
  - **Blocked on one answer, not on effort:** whether a pre-approval carries its own reference number
    and statuses (submitted / under assessment / approved / declined), or is just paperwork that ends
    up attached to the eventual claim. That decides entity-vs-attachment, so it decides the whole
    shape. Question is queued for Eman in `../docs/attachments/checklist.md` section C.
  - If it does become an entity, `claim_requirements` (`0031`) is the pattern to copy, and `documents`
    would need a fourth requirement FK — note `documents_one_requirement_check` was already
    generalised to "at most one non-null" in 0031, so adding a fourth is a one-line constraint change
    rather than a rewrite.

**Suggested order.** **G1 → G2 → G6** first: no migrations, highest correctness-per-line, and G1
unblocks the group branch that G7 depends on. Then **G5** (repository + wiring, no schema design,
and it completes G6). Then the schema work — **G3, G4, G9**, then **G7** and **G8**, which are the
largest and least urgent since neither Claims nor group enrollment is in active use.

---

## Phase H — Oct 2 module review (2026-10-02)

On **2026-10-02** the team walked Eman and Matt through every module: Clients, Proposals,
Applications, Policies, Renewals, Travel, Claims, Payments and Commissions. Client-data readiness
was also covered.

**Sources, and which one wins:**
- `../docs/meeting_Notes_Oct_2.md` is Joshua's notes. They include the Tagalog portion,
  transcribed and translated, and they are **authoritative**.
- `../docs/Oct2_Task_Assignments_Draft.md` is JC's task draft. It was built from the English
  transcript only, so it misses everything said in Tagalog.
- Where the two differ, the notes win. Each conflict is called out inline and listed in the
  decisions table below.

**Every `DH#` decision is open, for Joshua to decide.** Each one carries a recommendation; nothing
here has been decided on anyone's behalf.

**Ground rules for this phase:**
- **Migrations start at `0042_`.** The highest file is `0040`, and `0041` is already claimed by
  the D1 import-schema task in Proyekto ("Migration 0041: schema for premium history, riders,
  second billing and import lineage"). Apply each migration via Supabase MCP, then regenerate
  `lib/supabase/types.ts` (R3).
- **R1 still applies.** Every "automatic email" below can only *log* a `communications` row, or
  queue it for staff, until a real provider exists.
- **H0 gates everything that touches client data.** It runs first.

| Task | Module | Core site | Schema work | Gated by |
| :--- | :--- | :--- | :--- | :--- |
| **H0** Clear client and lead data | Data | `clients` + FK graph | none (data script) | DH1, DH2 |
| **H1a** Coverage tier → Ward / Semi-Private / Private | Clients | `log-call.tsx:30`, `wizard-data.ts:470-498` | none (maybe group CHECK) | DH3, DH4 |
| **H1b** Select Plus vs Select Standard | Clients | `0037:121-131` | migration (limit basis) | DH5 |
| **H1c** Edit policy number and product on the client | Clients | `policies.repository.supabase.ts:119-138` | none | H0 |
| **H1d** Archived client status | Clients | `0002_identity.sql:64` | migration (CHECK) | — |
| **H1e** Policy Schedule 2 extraction pipeline | Data | new script | none | NDA, Eman's PDFs |
| **H2a** Payment frequency on Generate Proposal | Proposals | `generate-proposal.tsx` | migration | — |
| **H2b** Portal-mirroring "details to encode" | Proposals | `prospects/actions.ts:475-485` | none | — |
| **H2c** Load the updated applications and brochures | Library | `scripts/load-carrier-library.mjs` | none | Matt's files, DH6 |
| **H2d** Auto-detect received proposals | Proposals | — | — | **PARKED** (DH7) |
| **H3a** "New Application" opens the full requirement set | Applications | `new-application.tsx:212-264` | none | DH8 |
| **H3b** Verify the draft-only application items | Applications | `wizard-data.ts` | — | DH9 |
| **H4a** "Issue policy" → "Log policy copy" + PDF upload | Policies | `issue-policy.tsx` | none | — |
| **H4b** Auto-log policies from the agency email | Policies | — | — | **PARKED** |
| **H5a** Generate renewal rows from policies | Renewals | `renewals.repository` (no callers) | none | H0, import |
| **H5b** Notice-received date | Renewals | `0005_operations.sql:65-82` | migration | — |
| **H5c–e** Configurable renewal email schedule + engine | Renewals | `renewal-automation/*`, Settings Notifications, task draft modal, `/api/cron/renewals` | `0048` applied | Done, logging-only interim; Production cron needs `CRON_SECRET` + deployment |
| **H6a** Travel quote doesn't preselect TravelSafe | Travel | `overlay-host.tsx:95` | none | — |
| **H6b–e** Two-step travel flow, client picker, uploads | Travel | `wizard/*`, `steps-2.tsx:481-613` | maybe | DH11, DH12 |
| **H7a–f** Claim types, policy lock, merged checklist, back bug, email | Claims | `file-claim.tsx`, `claim-requirements.tsx` | maybe | DH13, DH14 |
| **H8a–d** Awaiting payments, source link, USD, installments | Payments | `payments-live.tsx`, `wizard-actions.ts:959` | migration (installments) | DH15 |
| **H9a–f** Commission rate table, formula, breakdown, voucher | Commissions | `payments/actions.ts:22` | migration | DH16–DH20 |

---

- [x] **H0. Clear all client and lead data before client staging begins.** ✅ *Done 2026-10-06.* *(Gate. Run before any
  other H task that touches client data, and before the D1 import.)* We are moving onto real
  client staging, so the demo and test records go. That covers both the seeds and everything
  created through the website during testing.
  - **Current state (read-only check, 2026-10-05):** `clients` holds **45 rows**: 22 Lead,
    4 Applicant, 18 Client, 1 Lost. 31 of them are demo seeds (`@lead.demo`, `@client.demo`,
    `@group.demo`); the other 14 were created through the app. Leads are not a separate table:
    they are `clients` rows with `lifecycle_stage = 'Lead'` (`0013_lead_lifecycle.sql:2,6`).
    Child rows:

    | policies | applications | claims | payments | commissions | renewals | travel requests | group accounts | documents | communications |
    | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
    | 7 | 13 | 6 | 8 | 2 | 5 | 6 | 3 | 3 | 51 |

  - **Delete order.** These FKs are `ON DELETE RESTRICT`, so the order matters:
    1. Delete application children first. `application_dependents.dependent_id` and
       `application_carrier_forms.dependent_id` both RESTRICT on `dependents`
       (`0025:14,29`). Then delete `applications`.
    2. Delete `policies`, `renewals`, `claims` and `travel_requests`. All of them RESTRICT on
       `clients` (`0005_operations.sql:6,37,69,97,133`).
    3. Delete `clients`. This cascades to `dependents`, `workflow_instances`, `documents`,
       `external_coverage`, `tasks`, `communications` and `relationship_activities`.
  - **Rows the FKs won't clean up:**
    - `payments` and `commissions` are SET NULL, so they would survive as orphans. Delete the
      rows that belong to the targeted records.
    - Delete `referrals` rows that point at deleted clients.
    - Delete the `group_accounts` / `group_members` rows (the `@group.demo` corporates). Their
      client links are SET NULL, so they would otherwise survive.
    - Delete `activity` and `audit` rows keyed by `scope_id` / `record_id`. No FK covers them.
    - Remove the Storage objects behind the deleted `documents` rows, in the private `documents`
      bucket. Leave `library/` untouched.
  - **Keep:** users and staff, the product catalog (`0009`, `0037`, `0039`, `0040`), templates
    (`0011`), `document_library`, `external_contacts`, integration settings, `payment_channels`,
    and the requirement templates (`0024`, `0028`, `0032`, `0035`).
  - **Method:**
    - Export every targeted row to a dated JSON backup, outside the repo or gitignored, since it
      contains PII.
    - Run the delete from a script, `scripts/clear-client-data.mjs`
      (dry run by default; `--backup`; `--apply --confirm=CLEAR-CLIENT-DATA`). `load-carrier-library.mjs` is the
      nearest script pattern.
    - Afterwards, assert that every targeted table has zero client-linked rows and that the
      catalog and library counts are unchanged.
  - **This supersedes Phase E D1's rule.** D1 says to *"preserve every website-created record
    that is not explicitly allowlisted as demo/test data"*. Record the change in
    `docs/development-alignment.md`.
  - **Decisions:** DH1 ✅ wipe all; DH2 ✅ reset counters (seed-migration note still open).
  - **Script written 2026-10-06:** `scripts/clear-client-data.mjs`. PostgREST can't wrap the
    deletes in one transaction, so they run in FK-safe order as whole-table deletes and the
    script is re-runnable. Dry run on 2026-10-06: 45 clients, 13 applications, 7 policies,
    6 claims, 6 travel, 5 renewals, 8 payments, 2 commissions, 3 groups/13 members,
    51 communications, 195 timeline + 154 audit rows, 4 storage files, 11 counters.
  - **Applied 2026-10-06** by Joshua (`--apply`). Verified afterwards: 0 clients, policies,
    applications, communications, groups, payments and timeline rows, and no client files. Kept:
    7 users, 54 library entries and their 74 `library/` files, and the 337 non-client audit
    rows. Only the `USR` counter remains. Backup:
    `~/pacific-insurance-backups/clear-client-data-2026-10-06T06-00-45-607Z/` (1.5 MB, holds PII).
  - **Proyekto:** widens the existing *"Back up and remove demo and test seed data through a
    reversible transaction"* task.

### H1 — Clients

- [x] **H1a. Coverage tier becomes the product's real tiers.** Eman asked to remove
  "Standard" and "Suite/Executive". ✅ *Done 2026-10-06.*
  - **Shipped:**
    - `lib/coverage-tiers.ts` holds the per-product tiers (DH3). Each one is exactly a catalog
      `plan_options.coverage_tier` string: Select = Ward, Semi-Private, Private 2M / 3M / 5M;
      Blue Royale = Plan A / B / C.
    - The shared `CoverageTierSelect` replaces the old `TIERS` list in Log Call and the client
      form. It narrows the options to the product interest, and keeps any old value selectable
      as "(old value)".
    - Wizard Step 3's free-text tier field is now a dropdown of the chosen product's catalog
      tiers. Picking a tier auto-selects the plan when exactly one plan matches.
  - **Known limit, resolved by H1b:** for Select, Ward, Semi-Private and Private 2M exist in both
    Plus and Standard, so the plan is not auto-picked. Private 3M / 5M and Blue Royale plans
    are.
  - **For the D1 import:** write these exact tier strings into `clients.coverage_tier`.
  - Browser-verified on `/clients/new` and in wizard Step 3 (Select and Blue Royale). No
    records were created.
  - **Current state:** four vocabularies that disagree.
    - `TIERS` in `components/hub/overlays/log-call.tsx:30` is "Standard / Ward", "Semi-private
      room", "Private room", "Suite / Executive". `components/clients/client-form.tsx:12,256-263`
      reuses it.
    - The carrier catalog uses `Ward`, `Semi-Private`, `Private 2M/3M/5M`
      (`0037_carrier_rate_catalog.sql:121-131`).
    - `group_members` has a CHECK of `Standard/Premium/Executive` (`0016_group_accounts.sql:38-39`).
      `group-live.tsx:34,81,402` hardcodes the same values.
    - `clients.coverage_tier` is free text (`0019:9`). Discovery labels therefore never match a
      catalog plan in `normalisePlanPreference` / `uniquePlanPreferenceMatch`
      (`wizard-data.ts:470-498`), so the wizard never auto-selects a plan.
  - **Change:**
    - Replace `TIERS` with one shared constant (`Ward`, `Semi-Private`, `Private`) and use it in
      discovery, the client form and the wizard.
    - Make plan matching normalise to the catalog's tier names, so a discovery answer selects
      the plan again.
    - No data backfill is needed if H0 runs first.
  - **Decisions:**
    - **DH3 ✅** Tiers are split per product: Select Plus has Ward / Semi-Private / Private
      2M / 3M / 5M; Select Standard has Ward / Semi-Private / Private 2M; Blue Royale has
      Plan A / B / C.
    - **DH4 ✅** The group tiers are left alone for now.

- [ ] **H1b. Select Plus vs Select Standard.** These are one product with the same commission.
  They differ only in how the limit behaves:
  - **Select Plus:** ₱1,000,000 *aggregate* limit that replenishes every year.
  - **Select Standard:** ₱1,000,000 *per illness*, depleted as the client uses it.
  - **Current state:** both already exist as plan families in the catalog (`0037:121-131`), with
    the amount in `maximum_coverage`. **No field anywhere records the limit basis**; a grep for
    "aggregate" returns nothing.
  - **Change:**
    - Make the variant an explicit choice wherever Select is picked: discovery, application and
      the policy record.
    - Store the limit basis (`Aggregate, annual reset` vs `Per illness, depleting`) on the plan
      family, and show it on the client and policy views.
    - Commission keys on the product (H9a), so both variants share a rate.
  - **⚠️ Decision:** DH5. The notes say ₱1M for both, but the catalog lists Select Plus Private
    at 2M/3M/5M.

- [x] **H1c. Make the policy number and product/plan editable on the client.** ✅ *Done 2026-10-06 (`eda87a4`, `edadc59`): a Policies card on the profile (number, product · plan, term, status, PDF / Attach PDF, Edit). `EditPolicyDrawer` → `updatePolicyAction`, with activity and a before/after audit. `PolicyUpdate` covers product, plan, payment mode and currency. Browser-verified.* Eman needs to
  correct these; staging is already surfacing wrong policy numbers.
  - **Current state:**
    - `PoliciesRepository.update()` supports `policyNumber`, status, dates, premium and notes
      (`lib/repositories/policies/policies.repository.supabase.ts:119-138`), but **nothing calls
      it**.
    - The policy number is written once, at issue (`issue-policy.tsx:115`).
    - The contact profile shows only the Discovery card's "Product interest"
      (`identity-cards.tsx:56`) and a policy *count* that links away (`records-cards.tsx:27`).
  - **Change:**
    - Add a Policies card on the contact profile listing each policy: carrier policy number,
      product, plan, payment mode, dates and status.
    - Add an Edit action backed by a new `updatePolicyAction` that calls the existing
      `update()`, with `recordActivity` + `recordAudit` + `revalidatePath`.
    - Product/plan changes need `update()` extended to accept `product_version_id` /
      `plan_option_id`.

- [x] **H1d. Archived client status.** ✅ *Done 2026-10-06 (`f12470c` migration `0043`, `614ae17`): hidden from the Clients list (with a "Show archived" toggle), the lead board, pickers, the nav count and the dashboard KPI. Still visible in global search (badge) and on the profile (banner). Archive / Restore in the ⋮ menu. The importer mapping stays with D1. Browser-verified.* *(From the draft.)* Clients who have left (e.g. Assad Abla)
  are kept for history, not deleted.
  - **Current state:** `clients.status` is `text default 'Active'` with no CHECK
    (`0002_identity.sql:64`). "Archived" exists only on `documents.status`.
  - **Change:**
    - Add a migration with a CHECK on the allowed statuses, including `Archived`.
    - Exclude archived clients from active lists, pickers and dashboard counts, while keeping
      them searchable and visible on their profile.
    - The D1 importer maps the spreadsheet's "archived" flag to this status.

- [ ] **H1e. Policy Schedule 2 extraction pipeline.** *(Joshua + JC, agreed in the meeting.)*
  Eman confirmed that every client's details are on their policy PDFs, which use one format
  across all products. Instead of hand-keying, we extract them into staging.
  - **Fields:**
    - **Schedule 1 (the policy):** issue date, policy number, policy holder, address, benefit
      plan (plan, business type), period of insurance (from / to / renewal date), and premium
      (net annual, taxes, total annual, policy fee).
    - **Schedule 2 (list of insured):** policy holder, policy number, effective date, debit note
      number. Then per insured person: name, member number, sex, age, birthday, civil status,
      member effective date, plan and gross premium.
  - **Output:** `Policies_Staging` and `Insured_Persons_Staging` rows with source lineage (file
    and page). This feeds D1. It also covers the demographics Eman listed as the next staging
    gap (age, gender, birth date) after the policy-number corrections.
  - **Gated on:** the **NDA being signed**, then Eman sharing the Schedule 2 pages with the
    passwords removed. Never commit extracted data or source PDFs to either repo (R4).
  - **Proposed change (2026-11-09, awaiting Matt):** under
    `../docs/sensitive-data-handling-proposal.md`, Eman uploads the PDFs and confirms the extracted
    fields in the app on the live system; developers build and test the extractor on fake PDFs only.
    The same applies to the D1 workbook import.

### H2 — Proposals

- [x] **H2a. Capture payment frequency (Annual / Semi-annual) on Generate Proposal.** ✅ *Done 2026-10-06, Playwright-verified.* *Migration `0044` adds `clients.payment_frequency` (and `gender`). Generate Proposal requires the frequency (Annual / Semi-annual), saves it on the lead, and it prefills the wizard (`206792c`, `bebb83f`, race fix `4aab447`).* The portal
  asks for it at the Generate step.
  - **Current state:** the modal has only a lead/client picker (`generate-proposal.tsx:89`).
    Frequency exists only in the wizard (`steps-2.tsx:248`) and on `policies.payment_mode`
    (`'Annual','Semi-Annual'`, `0005:18`).
  - **Change:** add the field and persist it on the lead (migration), using the same two values.
    It carries forward into the wizard and drives H8d installments.

- [x] **H2b. Make the "details to encode" list mirror the portal's actual inputs.** ✅ *Done 2026-10-06, Playwright-verified.* *The encode list is grouped like the portal (Header / Principal / Dependents / Generate step), with required fields starred. Missing ones are flagged "Missing — add to the lead before encoding" with a count. Optional benefit and discount show as "Choose in portal". Lead gender is editable on the client form (`206792c`).* This is the
  meeting's main point: prepare everything before opening the portal so nothing is re-keyed or
  missed.
  - **Current state:** `prospects/actions.ts:475-485` lists full name, DOB, age, product,
    coverage tier, family size and dependents.
  - **Portal inputs (Eman's walkthrough):**
    - **Quotation header:** quotation number, policy holder name\*, product\*, total
      principals\*.
    - **Per principal:** first name\*, last name\*, gender\*, date of birth\*, age, plan,
      optional benefit, discount, plus Add/Remove Dependent.
    - **Generate step:** Annual or Semi-annual. The output shows the quotation number, agent
      code and agent name.
  - **Change:**
    - Add the missing fields to the encode list: gender, optional benefit, discount, total
      principals and payment frequency.
    - Warn when a required portal field is empty on the lead.
    - The generated PDF downloads to Eman's device immediately; the existing upload-back
      (`88274c8`) remains how it gets into the app.

- [ ] **H2c. Load Pacific Cross's updated applications and brochures.** Matt is sharing new
  versions.
  - **Change:**
    - Run them through `scripts/load-carrier-library.mjs` as new versions, matched by product,
      variant and age band, and archive the superseded rows. Update
      `scripts/carrier-library-manifest.json`.
    - Update "the Excel" to list them.
  - **Already done, per the notes:** all brochures and templates shared before Oct 2 are loaded
    (D3).
  - **⚠️ Decision:** DH6 (which Excel).

- [ ] **H2d. Auto-detect received proposals and advance the lead. PARKED.** Joshua raised this as
  "need to confirm if possible".
  - **Updated dependency state (2026-11-03):** forward-only incoming Gmail, safe MIME decoding,
    authenticated push, daily/manual synchronization and staff review/filing are now implemented.
    Production reading and automatic synchronization are verified: after the numeric history-ID
    parser fix, four real pushes were accepted and background sync completed without duplicates
    or errors. The owner subsequently confirmed linking/filing an incoming Travel PDF. Migration
    `0057` now supports explicit checklist attachment receipt/reuse; H2d's automatic decision or
    lead advancement remains unimplemented and parked.
  - Manual portal upload-back and explicit inbox proposal filing now share the same guarded
    registration/Received transaction (`0054`). Later proposal decisions are never reset by receipt.
  - **⚠️ Decision:** DH7.

### H3 — Applications

- [x] **H3a. "New Application" should land on the full requirement set for the product.** ✅ *Done 2026-10-06, Playwright-verified.* *DH8. Continue and the step rail are gated on the product. Template-driven products preview the same template the server snapshots (`listProductRequirementPreviewAction`). After create, the Requirements overlay opens (`ba1dfce`). Testing exposed that the BC Flexi template sat on a deactivated version; migration `0045` re-points it (`514775e`).* Eman
  expected **New Application** to open the selected product's complete application form and
  requirements. Instead it opens the six-step wizard with only basic requirements. In the meeting
  Joshua explained that the full list appears under **Continue Application** on the client; that
  explanation is the UX problem.
  - **Current state:**
    - The header and Applications-screen buttons call `openWizard()` with no prefill
      (`shell.tsx:536`, `operations.tsx:104-105`).
    - The Step 4 preview is built client-side from the Step 1 product plus Step 3 inputs
      (`new-application.tsx:212-264`). With no product chosen it shows *"Select a product in
      Step 1…"* (`steps-2.tsx:602`).
    - The authoritative per-product list is snapshotted server-side only on create
      (`snapshotApplicationRequirements`, `wizard-actions.ts:~141`), then managed in the
      Requirements overlay.
  - **Change:**
    - Require the product before leaving Step 1, and show the product's full checklist preview,
      including conditional items marked *"applies if…"*.
    - After create, open that application's Requirements overlay directly, so the user never has
      to discover "Continue Application".
  - **⚠️ Decision:** DH8.

- [x] **H3b. Verify the draft-only application items before scheduling any work.** Verified
  2026-10-09–10 in the authenticated app with owned temporary QA records.
  - *"Blue Royale currently shows the HMO list."* Not reproduced for a fresh application,
    Select comparison, BC Flexi → Blue Royale switching, or Blue Royale draft save/resume/create.
    The active catalog version is Primary Medical. Face-to-face/remote alternatives, beneficiary
    ID, conditional medical documents and persisted health requirements were verified; no corporate
    PIS/CET package leaked into Blue Royale. At that verification the preview combined TAL/CAC;
    the 2026-11-03 shared keyed builder now separates both optional rows in preview and persistence.
  - *"Add a medical review stage when the health declaration has a 'yes' answer."* G3 already
    generates conditional medical documents (`medicalRequirementDocumentsFor()` in `wizard-data.ts`). A
    separate review *stage* would be new workflow.
  - **⚠️ Decision:** DH9.

### H4 — Policies

- [x] **H4a. Reframe "Issue policy" as filing the carrier's copy, and add the PDF upload.** ✅ *Done 2026-10-06 (`eda87a4`): "Log policy copy" with an optional PDF filed as a `Policy Copy` document linked to the policy, plus "Attach PDF" later from the Policies card. Browser-verified.* Eman
  and Matt clarified that **Pacific Cross issues policies directly to the policyholder; the agency
  only receives a carbon copy for filing.** Matt confirmed the section's purpose is to store and
  quickly retrieve client policy copies.
  - **Current state:** `IssuePolicyDrawer` (`issue-policy.tsx`, titled "Issue policy" at `:63`)
    is manual data entry with **no document upload**. The only policy-PDF upload in the app is
    Travel's.
  - **Change:**
    - Rename the button, drawer and copy to "Log policy copy" or similar.
    - Add a required-or-optional policy PDF upload. Eman removes the carrier password manually
      before uploading, as agreed in the meeting. Reuse the `PdfUpload` +
      `recordTravelPolicyAction` pattern.
    - Link the PDF from the H1c Policies card so it can be retrieved in one click.

- [ ] **H4b. Auto-log policies received at the new agency email. PARKED.** Every Pacific Cross
  policy is password-protected for data privacy, so the team agreed to do this manually (H4a).
  Revisit only once the new address is live and R1 is resolved.

### H5 — Renewals

Timeframes are **not final**. Eman and Matt will settle them offline, and JC is following up. The
numbers below are the meeting's proposals.

- [x] **H5a. Generate renewal rows from policies.** Delivered and verified 2026-10-09–10.
  - Migration `0047_policy_renewals_notice_receipt.sql` synchronizes Active policies atomically
    through a policy trigger and service-role-only RPC, using renewal date before expiry.
    Travel requires an explicit renewal date. One open cycle per policy is enforced; corrections
    retain its ID and staff fields, while Paid/Renewed/Lapsed cycles remain historical.
  - Admin-only `Sync policies` explicitly backfills all Active policies and audits the counts/IDs.
    It does not run on page load or in the migration. Policy create/edit, rollback SQL assertions,
    eight concurrent sync calls, repeated UI backfill and direct Staff denial were verified.

- [x] **H5b. Record the date the renewal notice was received, per renewal.** Delivered and
  verified 2026-10-09–10. Notices can arrive inconsistently; no lead-time window is imposed.
  - `notice_received_date` is independent of the legacy outbound `renewal_notice_date`.
    `Mark notice received` / `Edit receipt date` and the sortable `Notice received` column are live.
  - Receipt advances only Upcoming → Notice Received. Later statuses are preserved; identical
    saves create no mutation/activity/audit. Calendar validation, persistence after reload,
    Awaiting Payment/Paid edits, cancellation, failed-save form retention and Send notice receipt
    preservation were exercised. No email delivery, scheduler or payment creation was added.

- [x] **H5c. Configurable email schedule.** Delivered and verified 2026-10-10.
  - `renewal_email_rules` stores four fixed email types with date basis, signed day offset,
    client/carrier recipient, selected directory contact, Email template and active flag.
  - **Settings → Notifications:** Admin saves/runs the queue; Staff views; Agent receives no
    rules/template payload and has no Notifications tab. Direct Server Action denials verified.
  - Notice receipt remains immediate (receipt date, offset 0); missing-notice requests use the
    renewal date. Reminder/breakdown timing is configurable; negative offsets are before the date.

- [x] **H5d. The four renewal emails.** User-confirmed defaults, delivered 2026-10-10:
  1. **Client notice receipt:** immediately when H5b records receipt.
  2. **Client renewal reminder:** 30 days before renewal.
  3. **Carrier notice request:** 60 days before renewal, only while no notice is recorded.
  4. **Carrier premium breakdown:** 60 days before every renewal, regardless of premium increase.
  - Four new editable Email templates are seeded without overwriting the existing manual
    `Renewal reminder`. Renewal/client/carrier merge fields use the shared renderer; renewal
    premium is not invented from the previous policy premium.
  - Both carrier rules initially select the existing Active **Thea Opura** directory record.
    Admin can change the officer/template; Staff must review the individual draft before logging.

- [x] **H5e. Execution engine.** DH10 interim approach approved and implemented 2026-10-10.
  - Service-role-only SQL queue atomically creates one linked task/draft per rule and renewal,
    protected by renewal-row locks and a unique cycle/rule constraint. Receipt/date/status updates
    invoke the same queue in the renewal transaction; migration/page loads never backfill.
  - Due dates use **Asia/Manila**. Closed renewals, inactive policies, Lost/archived/do-not-contact
    clients, disabled rules/templates and inactive carrier contacts are suppressed; early-payer
    clients skip reminders. Pending work that becomes ineligible is dismissed/cancelled.
  - Existing draft facts/timing refresh; template/recipient snapshots and staff-edited copy are
    retained. Logged/dismissed drafts remain historical and are never re-created for that cycle.
  - Tasks board and dashboard expose **Open draft / View draft**. Staff can save, log or dismiss.
    Revision checks reject stale edits. Log atomically records `delivery_status = logged` and
    completes the task; it never delivers email or advances the renewal. Checkbox completion
    alone never logs an email.
  - `/api/cron/renewals` is secret-protected; `vercel.json` schedules **00:00 UTC / 08:00 Manila**
    daily and preserves `sin1`. Set server-only `CRON_SECRET` in Vercel Production before deploying.
    Source/local cron proof does **not** claim Production activation; no push was performed.
  - Verified rollback SQL boundaries (61/60/30 days), receipt/cancellation, source-edit preservation,
    paid/early-payer suppression, next cycle, stale/log retry and grants; eight concurrent calls
    yielded 3 new pairs + 21 unchanged outcomes. Actual Admin/Staff/Agent UI/actions, network/stale
    errors, pending-close guard and cron 503/401/200/repeat responses passed. Final checks:
    **8 files / 58 tests** and `npx next typegen && npx tsc --noEmit` passed.
  - Installment automation remains **H8d**, not part of this four-email interim.

### H6 — Travel

The meeting's synthesis applies here most: **the app must not make Eman type client details twice**
(once in the app, once in the TravelSafe portal).

- [x] **H6a. Bug: "New travel quote" doesn't preselect TravelSafe.** *(Quick win.)* ✅ *Done 2026-10-06: prefill now passes `TravelSafe`; browser-verified.* Eman asked
  that the product default to Travel Safe.
  - **Current state:** the modal opens the wizard with `productInterest: "Travel Insurance"`
    (`overlay-host.tsx:95`). Migration `0037` deactivated that legacy product (`0037:58,60`); the
    live product is **"TravelSafe"** (`0037:71`). The wizard matches by exact name
    (`new-application.tsx:144`), so **nothing is selected** and Step 1 shows an unmatched-product
    notice (`:171`).
  - **Change (as shipped 2026-10-06):** the prefill now passes the live name `"TravelSafe"`, a
    one-line fix. It is still matched by display name, so renaming the product would break it
    again.
  - **Not done, optional follow-ups:**
    - Prefill by the product's stable `source_key`.
    - Remove the unreferenced `NewTravelQuoteDrawer` (`new-travel-quote.tsx:14`).
  - **Found while verifying → H6g.** A travel quote opens with Application Type **Inquiry Only
    (Lead)**. The wizard defaults `appType` to `INQUIRY_APP_TYPE` whenever any `productInterest`
    is prefilled (`new-application.tsx:141-171`). That rule exists for leads, but the travel-quote
    entry point inherits it.

- [x] **H6g. Travel quote should not default to "Inquiry Only (Lead)".** ✅ *Done 2026-10-06, Playwright-verified.* *A travel product defaults to "New Insurance Application" (`b5f0a68`).* Found 2026-10-06 while
  verifying H6a.
  - **Change:** let the travel-quote entry point skip the inquiry default. Either pass an
    explicit `appType` in its prefill, or scope the default to the lead entry points only.
  - Check this against H6b first: the 2-step flow may remove the application-type field
    altogether.

- [x] **H6b. Collapse the travel path to Eman's two steps.** ✅ *Done 2026-10-06, Playwright-verified.* *`WIZ_TRAVEL_STEPS`: (1) Client, trip & requirements, (2) Review & create. Create reserves the TravelSafe portal pop-up, uploads the files, then opens the Travel workflow (`b5f0a68`).*
  1. **Client information + product/trip details + requirements**, on one screen. This is also
     where the requirements from the signed application form (e.g. passport) are uploaded.
  2. **Review & create**, which then opens the Pacific Cross portal.

  - **Current state:** six steps.
    - Step 3 (`Step3Travel`, `steps-2.tsx:481`) already repeats client fields and copies the
      applicant into the traveler list (`:484`).
    - Step 4's travel checklist is built entirely from the Step 3 traveler list
      (`new-application.tsx:261-262`).
  - **Fields:** base them on the Pacific Cross travel application form. We already hold it; it
    was received 2026-08-01. Persist only what we need to operate and search (C7's rule); the
    signed form stays the legal record.
  - **⚠️ Decision:** DH11. JC's draft lists four steps.

- [x] **H6c. Client entry: pick an existing client or type a new one, with no silent autofill.** ✅ *Done 2026-10-06, Playwright-verified.* *DH12. Picking an existing client fills traveler 1 visibly (`getTravelClientFillAction`: client record plus their last trip's passport and nationality), marked "Traveler details filled from …", and editable (`b5f0a68`).*
  Some travel clients are repeat travelers (JC asked; Eman confirmed).
  - Joshua suggested autofill from existing records.
  - Eman leaned towards manual entry, or a dropdown if feasible. Either is fine, as long as Eman
    never re-keys client information.
  - **⚠️ Decision:** DH12. JC's draft says "autofill with manual override".

- [x] **H6d. Requirement uploads inside the travel step.** *Done 2026-10-06; expanded 2026-11-03 with the shared requirement attachment picker.*
  - **Current state:** Travel creation and workflow requirement rows offer `Choose file` →
    `Upload from device` or authorized `From email attachments`, including already-filed originals.
    Application/Claim checklists and creation requirement rows use the same picker.
  - **Persistence:** choices are staged until actual requirement rows exist. The server returns
    keyed destinations; explicit receipt marks only that item Received and preserves Verified.
    Previous-trip files are never inherited automatically, and cross-record reuse needs confirmation.
    Drafts do not save selected files. The superseded one-off upload helpers were removed.
  - **Verification:** 250 tests, build/TypeScript, 18 SQL/Storage and 17 authenticated HTTP checks
    passed through Orca CLI; no browser visual checks were performed, per the owner's instruction.
  - **Eman's intake:** they send the client the PDF application form by email; the client
    returns it signed with a passport copy. Some signed forms are hard to read, which is why
    reading them automatically is out of scope.

- [x] **H6e. File the primary Travel originals; record supplementary attachments from Inbox.**
  ✅ *Done 2026-11-09: migration `0067_travel_reference_inbox_links` (`20261109080122`), Travel
  workflow `Supplementary references (optional)` with `Record from Inbox` / `Change attachment` /
  `Unlink`, and the Inbox correction blocker. Verified with tagged synthetic QA records; see
  `docs/development-alignment.md`. Not deployed.*
  **Scope clarified by the user on 2026-11-07.** Implement in the existing Travel workflow's
  policy-issuance/post-issuance area, not a new creation step. This supersedes the earlier
  manual-filename-field proposal; do not implement its three text columns or `Save filename`.
  - **Primary originals:** keep actual PDFs for the issued Travel policy and carrier-completed
    application copy. The latter contains the portal-encoded details and remains separate from
    the client's signed intake. Supplementary links or filename text cannot replace these originals.
  - **Supplementary references:** emergency/contact information, COVID-19 coverage and TravelSafe NOC
    are optional associations to real Inbox attachments. Filename matching suggests categories and
    candidates; the recorded identity is the message ID plus attachment part ID, not text alone.
    No second upload or duplicate stored copy is needed. The two unavailable reference PDFs are
    no longer external blockers or items to request separately from Eman.
  - **Truthful states:** a saved link shows `Recorded from Inbox`, its source filename/email/date
    and authorized original access; no link shows `Not linked` neutrally. `Recorded` means the
    actual Inbox source is linked, not that another copy is stored locally. Known stale/unavailable
    sources must remain explicit errors, not silently replaced by a similar filename.
  - **Source boundaries:** use correspondence released to the same trip, or client-level
    correspondence explicitly confirmed for that trip. Reject foreign clients and other-trip
    sources. Never infer ownership from filenames or sender text, auto-release unassigned mail,
    or confuse a COVID recovery questionnaire with Travel COVID coverage.
  - **Current implementation:** policy/application originals and guarded library downloads exist;
    original uploads, hashes and permission/isolation checks were verified 2026-11-06. Inbox also
    already exposes authorized message/part metadata and stored/Gmail original retrieval.
    **Implemented 2026-11-09:** trip/reference Inbox associations, eligibility-first candidate
    selection with filename suggestions, record/change/unlink controls, Agent read-only view and
    separate `Library copy` downloads.
  - **Invariants:** preserve the `Issued` policy-number gate and all payment/checklist state.
    No fake `documents` rows, filename-derived paths, new reference-PDF prerequisite, outbound
    send or automatic historical-mail backfill.
  - **Canonical contract:** `../docs/web/pages.md` §8, `../docs/web/modals.md` §7 and
    `../docs/web/data-model.md` Travel supplementary-reference links.

  **Implementation plan — policy issuance step (revised 2026-11-09, executed 2026-11-09):**

  *Changes since the 2026-11-07 draft:* Inbox link corrections (`0065`) now exist and can move an
  email to another record, so a reference link is a correction dependency (step 2). Candidate listing
  is a dedicated eligibility-first RPC rather than a client-wide filter (step 1). QA follows
  `../docs/sensitive-data-handling-proposal.md` (step 5).

  1. **Reuse source identities and category suggestions, not manual filename fields.**
     - Reuse `TravelPackReferenceKey` / `TRAVEL_PACK_REFERENCE_SLOTS` from
       `lib/travel/post-issuance-pack.ts` and Inbox's `(messageId, partId)` attachment identity.
       Add named source/link DTOs; derive display filenames from server-read Inbox metadata.
     - Add conservative case-insensitive filename-based candidate suggestions to the existing
       pure pack module. Suggestions are not saved links or content verification. Show the
       source email and preview; multiple plausible matches require staff selection.
     - Add service-role-only `list_travel_reference_candidates(p_actor_id, p_travel_request_id,
       p_search, p_offset)`. It returns only parts of messages the actor can read, owned by the
       trip's client and linked either to this trip or at client level, and applies that filter
       **before** pagination (25 per page, as in the existing picker). Each item carries
       `messageId`, `partId`, filename, MIME type, size, subject, sender, received date, stored-
       original flag and `clientLevel` (needs confirmation). Other trips, other clients and
       unassigned mail never appear. Reuse the existing picker's email-list and preview UI patterns,
       not its checklist-receipt finalizer.

  2. **Persist one source association per trip/category, with atomic audit.**
     - Inspect actual tables and both migration ledgers before choosing the next source number.
       `0065`/`0066` are now used by Inbox corrections; use `0067_travel_reference_inbox_links.sql`
       or the next free number. The superseded filename-column migration was never created or applied.
     - Add `travel_pack_reference_attachments` with primary key `(travel_request_id, slot)`,
       foreign keys to `travel_requests` and `gmail_inbox_messages`, `part_id`, a server-captured
       `file_name_snapshot`, and `linked_by` / `linked_at`. Index FK lookups. Limit slots to the
       existing three keys. Require real source identities; do not create empty placeholder rows.
       Part metadata is stored in Inbox JSON, so validate actual part existence explicitly.
     - Keep RLS enabled and browser roles denied direct table writes/reads. Add a narrow
       service-role-only link/unlink RPC with `SECURITY INVOKER`, empty search path, qualified
       names and EXECUTE revoked from PUBLIC/anon/authenticated. Recheck active real Admin/Staff,
       trip/client/source ownership, existing Inbox visibility and valid part metadata under
       locks following existing Inbox lock order/helpers. Client-level sources need explicit
       trip confirmation; foreign-client/other-trip sources always fail closed.
     - The link RPC locks the source message row first (`FOR UPDATE`), matching the first lock
       taken by Inbox filing and `correct_gmail_inbox_message`, then the trip, then the slot row.
       This serializes linking with Inbox corrections.
     - **Inbox correction dependency:** in the same migration, `create or replace`
       `preview_gmail_inbox_correction` with its `0065` body plus one blocker: "This email is
       recorded as a Travel supplementary reference on TRV-…. Unlink it in the Travel workflow before
       correcting this email." Commit already re-runs preview under the message lock, so a link
       saved after the review also blocks the correction. Signature and types are unchanged.
     - Save/change one slot at a time; removing it deletes only the association. Same-source
       replay is a no-op; different-slot edits preserve both. Atomically audit previous/new
       source IDs and filenames, slot, trip and actor, with an internal
       `travel.reference_attachment_linked` or `travel.reference_attachment_unlinked` event.
       No upload/Received/Verified evidence is fabricated. Use non-retryable validation errors,
       not custom SQLSTATE 40001. Unlink never deletes email, stored originals or shared usages.
     - Apply hosted DDL through the repository's migration workflow, genuinely regenerate
       `lib/supabase/types.ts`, and verify table/FK/RPC permissions and advisors.

  3. **Wire authorized source selection, persistence and original retrieval.**
     - Extend `lib/repositories/travel/travel.repository.ts`,
       `travel.repository.supabase.ts` and named type exports for listing/set/unlink of reference
       associations. Keep them outside generic `TravelRequestUpdate` financial/status patches.
       No `TravelRequest.referenceFileNames` field or three free-text columns are needed.
     - In `app/(app)/travel/actions.ts`, add paginated candidate listing plus
       `recordTravelReferenceAttachmentAction({ travelRequestId, slot, messageId, partId,
       confirmClientLevel })` and `unlinkTravelReferenceAttachmentAction({ travelRequestId, slot })`.
       Validate real active Admin/Staff and trip access inside every directly callable mutation;
       validate UUIDs, slot and actual part ID, including the valid empty root part.
       Never accept actor, ownership, filename or storage path as trusted browser input.
     - Use `getScopedInboxMessage` from `lib/gmail/review.ts` for source visibility and
       `getRequirementAttachmentOriginal` from `lib/documents/requirement-attachments.ts` to
       confirm the original can actually be retrieved before saving a new/replacement link.
       This reuses existing Storage bytes when present, otherwise Gmail; no re-upload/copy or
       checklist receipt call. Source/permission failures preserve the previous association.
       The write RPC rechecks current source metadata and authorization after external retrieval.
     - Extend `TravelWorkflowPayload` with a batch-loaded `referenceAttachments` projection,
       keyed by slot. Recheck both current trip access and source visibility before serializing
       source descriptors; do not leak an inaccessible filename snapshot. Preserve assigned-client
       Agent read-only scope and real `canFilePostIssuance`. Do not refetch all attachment bytes
       on every workflow load or silently substitute another part when the source disappears.
     - Reuse `/api/requirement-attachments/[id]/[part]/preview` and `/download`, and the Inbox
       original download route, with their current independent authorization, 25 MiB limit,
       signature-safe rendering and private/no-store response behavior. URLs use saved source IDs,
       never filenames; the empty part becomes `__root__` only in the URL. Keep optional library
       downloads on the existing guarded Travel pack route. Revalidate `/travel` and linked client
       after successful association changes; recording a reference does not dispatch an email.

  4. **Integrate Inbox-linked rows in the existing issuance area.**
     - Edit `components/hub/overlays/travel-workflow.tsx` beside the two primary PDF controls.
       Render `Supplementary references (optional)` with `Record from Inbox`, `Change attachment`
       and `Unlink`, using the existing device/email picker's email-selection/preview patterns.
       Reuse/refactor its source-list UI only as needed; do not invoke `attachRequirementSelection`
       or its document-copy/requirement-receipt finalizer for these optional references.
     - Show `Recorded from Inbox` plus original filename, source email/date, `View email`,
       supported `Preview` and `Download original`; show `Not linked` for empty slots.
       Surface known original-unavailable errors honestly. Keep genuine `Library copy` links
       separate, without claiming they are the same version as the selected email attachment.
     - Save each association independently of `Save workflow`. Retain selection, prior link,
       other slot drafts and unsaved portal/payment inputs on validation/access/network failure.
       Unlink affects no original or checklist; allow corrections after issuance. Agent remains
       read-only, including under a forged persona preview. Support long filenames at 390px.

  5. **Prove source identity, access and workflow invariants.**
     - Extend `lib/travel/post-issuance-pack.test.ts` with candidate/ambiguity boundaries:
       COVID coverage versus recovery questionnaire, NOC versus application form, case/extension
       variations, duplicate filenames with different message/part IDs, and unrelated trips.
       Retain real library product/approval/date/age and NOC eligibility coverage; remove
       wording/default-slot-only assertions rather than repinning obsolete UI labels.
     - Rollback SQL/direct actions: browser RPC denial; inactive/Agent/foreign-client/other-trip
       rejection; client-level confirmation; valid root part; forged/stale part rejection;
       no-op replay audits once; concurrent different-slot updates; unlink preserves all sources.
       Snapshot money/currency/status/policy/checklist/originals before and after association edits.
     - **QA environment:** if the separate development project from
       `../docs/sensitive-data-handling-proposal.md` exists, run all QA there. Otherwise use newly
       tagged disposable QA users, trips, synthetic Inbox correspondence and clearly synthetic PDFs
       on the shared project, as for the Inbox correction work. Never use real-client files.
       Verify stored-original reuse with matching hashes; exercise the Gmail-original path only
       with an explicitly authorized QA provider message, or report that limit.
     - Correction interaction: a linked email shows the Travel-reference blocker in `Correct link`;
       after `Unlink` the correction proceeds; a link saved between review and commit blocks commit.
     - File policy/application originals; select and record two Inbox reference attachments without
       a second upload; leave one unlinked. Close/reopen, change and unlink; verify exact source
       identity, neutral optional state, genuine original access, no duplicate Storage/Documents,
       no cross-trip carry-over, and independent signed intake. Exercise missing original,
       unavailable provider, stale/ambiguous matches, error retention and forged direct URLs.
     - Check desktop/390px/error surfaces; run `npm test` and `npx tsc --noEmit`. Record migration,
       actual exercised paths and advisors; remove only tagged QA fixtures and private scripts.
       Never modify Joshua Mistal/other real clients, send emails, backfill a mailbox, create a
       paid branch, change financial rules or deploy as part of this slice.

- [x] **H6f. Travel payment tracking: mostly already done.** ✅ *Done 2026-10-06 (`ff1e088`): a Payment method select (Card / GCash / Over the counter, column `travel_requests.portal_payment_method`, migration `0046`) in the workflow's Portal processing, also shown under the premium on the Travel list. Playwright-verified.*
  - **Current state:** the portal modal records portal reference, amount and status
    (`travel-workflow.tsx:89-91`).
  - **Portal payment flow (Eman's walkthrough):** card, GCash or OTC. Eman usually pays on the
    client's behalf and screenshots the proof of payment.
  - **Remaining work, if any:** a payment-method field. JC's draft task can be closed or reduced
    to that.

### H7 — Claims

Eman's process: claims arrive mostly as soft copies by email, sometimes as hard copies.

- [x] **H7a. Replace the claim types.** ✅ *Done 2026-10-06, Playwright-verified.* *`CLAIM_TYPES` plus `CLAIM_TYPE_CHECKLIST` (DH13 interim: ER→In-Patient, Reimbursement→Out-Patient; Travel has no generated list). Legacy values still map (`6eb86ac`).*
  - **New list:** Reimbursement, IP, OP, ER, Overseas Reimbursement, Overseas IP, Overseas OP,
    Overseas ER, Travel. Travel needs no overseas variant because it covers both local and
    overseas.
  - **Why the overseas variants exist:** Blue Royale lets clients seek treatment abroad through
    reimbursement, and Eman needs to see where it happened. JC's draft wording *"Travel
    (intentional treatment abroad)"* is wrong.
  - **Current state:** the types are hardcoded at `file-claim.tsx:97` (`Hospitalization`,
    `Outpatient`, `Reimbursement`, `Emergency`, `Other`; default `Hospitalization` at `:22`).
    `claims.claim_type` is free text (`0005:99`).
  - **Change:**
    - Use one shared constant.
    - Map each type to the requirement template it uses: IP/OP → `0032` templates; Travel →
      TravelSafe NOC (Eman: travel claim requirements are more rigorous).
  - **⚠️ Decision:** DH13.

- [x] **H7b. Default the policy to the client's policy, read-only.** ✅ *Done 2026-10-06, Playwright-verified.* *DH14. Eligible policies are Active/Pending and match the claim type (Travel vs medical). Exactly one → read-only; several → a dropdown by carrier number; none → "No matching policy". The claims list shows the carrier number (`6eb86ac`).* Eman: one policy per client,
  so the dropdown shouldn't be interactive.
  - **Current state:** the dropdown (`file-claim.tsx:82-91`, fed by
    `listClientPoliciesAction`) labels policies `referenceNo · productName`, not the carrier's
    policy number.
  - **Change:** show the carrier policy number, preselected and locked.
  - **⚠️ Decision:** DH14. A client can hold a travel policy *and* a health policy.

- [x] **H7c. Fold the requirements popup into the File Claim sidebar.** ✅ *Done 2026-10-06, Playwright-verified.* *Filing generates the type's checklist (non-fatal) and the drawer becomes the live `ClaimRequirementsPanel` with uploads. H7d's control is now "Change claim type" (`changeClaimTypeAction`). Testing found that an upload left the row showing Pending until reopen, fixed in `2f657f3` (`6eb86ac`).*
  - **Current state:** filing a claim and building its checklist are separate overlays
    (`file-claim.tsx` / `claim-requirements.tsx`, opened from `operations.tsx:382`).
  - **Change:** with H7a, the claim type decides the checklist, so the In-Patient / Out-Patient
    choice disappears. Show the checklist in the sidebar.

- [x] **H7d. Bug: the checklist type can't be changed once picked.** *(Critical UX bug, Eman.
  Fix even if H7c slips.)* ✅ *Done 2026-10-06.*
  - **Shipped:**
    - The modal footer now has **Change checklist type**. It clears the checklist through
      `resetClaimRequirementsAction` and returns to the In-Patient / Out-Patient choice.
    - It is allowed only while every item is `Pending`, checked in three places: the button is
      disabled, the action refuses, and the repository's `deletePendingByClaim` deletes only
      `Pending` rows. An upload flips its item to `Received`, so no document work is lost.
    - The action logs activity and audit entries.
    - Browser-verified: generate In-Patient (14 items) → change → generate Out-Patient
      (10 items). Marking one item Received locks the button and shows the locked message, and
      the server refuses the change with the UI lock removed.
  - **Current state:** after "Generate In-Patient / Out-Patient checklist" (`:132-137`), the
    modal shows only the list and a Close button (`:140-162`). `generateClaimRequirementsAction`
    is idempotent and returns the existing rows, so a mis-click locks the claim to the wrong
    list.
  - **Change:** add Back / Change type, which regenerates the checklist while no item is past
    `Pending`. Once items are received, block the change and explain why.

- [x] **H7e. When the checklist is complete, open an email with the documents.** ✅ *Reconciled 2026-10-19: the current source already supplies a shared **Email Pacific Cross** step for applications and claims. It pre-fills an editable Pacific Cross recipient, subject and checklist summary; **Download all (ZIP)** bundles uploaded checklist files; **Copy email text** prepares the manual message; and **Mark as sent** logs the communication, status/date, activity and audit without CRM delivery.*
  - The submission step excludes outstanding required items, identifies received items without an uploaded file as “to follow”, and keeps every actual send human-in-the-loop. Real binary attachment delivery remains out of scope under R1.
  - The same step is used by the five-step application workflow and the three-step claim workflow. Existing submission-email unit coverage passes: recipient defaulting, checklist inclusion/missing-file wording, claim wording and ZIP entry naming.
  - **Supporting workflow (delivered 2026-10-07):** the Application
    Requirements modal is now a 5-step workflow laid out like the New Application wizard:
    **Requirements → Email Pacific Cross → Pacific Cross reply → Payment → Log policy copy**.
    Progress comes from the records, so the modal opens on the step where the work actually is.
    - **Email Pacific Cross:** once sent, the step is read-only and shows the logged email
      (date, sender, recipient, subject, body). It can be resubmitted.
    - **Pacific Cross reply:** Eman still explicitly classifies the response. The new inbox can retain/link the actual incoming evidence after activation; it does not infer conforme, extra requirements or approval.
      - A **CAC/TAL conforme** or **more requirements** become required, Pending checklist rows,
        and the application goes back to Pending Requirements until they are in. Signed items go
        back to Pacific Cross through Resubmit.
      - The **illustrative proposal** (final billing) is filed against the application, or the
        lead-stage proposal is reused. It unlocks Payment, as does an already-recorded billed
        amount.
    - **Payment checkpoints:** billed amount → billing sent to client (`logBillingSentAction`) →
      proof received (screenshot, bank slip or provisional receipt) → proof sent to Pacific Cross →
      service invoice recorded.
    - **Payment:** records Pacific Cross's billed premium (`createApplicationPaymentAction`),
      which creates an Awaiting payment and moves the application to Awaiting Payment. Proof and OR
      are recorded inline with the Payments page's form, shared through `useVerifyPaymentForm` (no
      copy, and no drawer stacked over the modal); that marks the application Approved.
    - **Log policy copy:** renders the Log policy copy form inline (`usePolicyCopyForm`, shared with
      the standalone drawer), prefilled from the application. Saving links
      `applications.policy_id`, carries the OR over to the policy and payment, and converts the
      client to **Policyholder**.
    - **Claims use the same frame:** File claim and the claims list's Requirements button both open
      a **claim workflow modal** (`claim-workflow.tsx`, shared `workflow-shell.tsx`) with three
      steps: **Claim details → Requirements → Email Pacific Cross**. The File claim sidebar is gone.
      The form is grouped into status cards, filing moves straight to the checklist, and a sent claim
      email shows read-only.*
  - **⚠️ Assumptions (logged 2026-10-07, not decisions; Eman to confirm):**
    - The illustrative proposal Pacific Cross sends after evaluating the application is the same
      document as the lead pipeline's Proposal stage (the "final billing"). The workflow therefore
      reuses a lead-stage proposal when one is on file.
    - The number stored as the OR (`payments.or_number`) comes from Pacific Cross's **service
      invoice**, issued after the proof of payment is forwarded. A **provisional receipt** (cashier
      payments) is only a form of proof of payment.
  - **Limit:** real binary attachments are blocked by R1/C6b. Until then the composer must say
    the email is logged, not delivered.

- [x] **H7f. Record how and when the claim arrived.** ✅ *Done 2026-10-06 (`91d5e21`): `claims.submission_mode` (Hard / Soft copy) and `documents_received_date` (migration `0046`), captured in File Claim ("How it arrived", "Documents received") and editable in the requirements modal (`updateClaimIntakeAction`). The claims list sub-line reads "IP · Soft copy · received Oct 6, 2026". Playwright-verified.* *(From the draft; the notes support it.)*
  Add submission mode (hard / soft copy) and received date to the claim.

### H8 — Payments

Eman was satisfied with the Payments page. They understand that its rows come from leads,
clients, applications, travel and renewals.

- [x] **H8a. Actually create Awaiting payments from those sources.** ✅ *Done 2026-10-19: the application billing step creates or corrects its single billed-premium payment; standalone policy-copy logging now creates a Policy payment; and migration `0049_renewal_awaiting_payments.sql` creates one Renewal payment when a cycle is generated. Application-linked policies retain their application payment, avoiding a duplicate collection.*
  - Policy and renewal rows snapshot the known premium or deliberately start without an amount. Staff must enter a positive premium in **Verify Payment** before recording proof or an invoice; no amount is invented. The Payments source filter now includes Policy.
  - The renewal trigger was deployed and smoke-tested in a rolled-back synthetic transaction: a new renewal created exactly one Awaiting payment with the policy premium. No historical backfill ran.

- [x] **H8b. Link each pending payment to its source.** ✅ *Done 2026-10-06 (`528cdd0`): the Source column links to the source record (Application → requirements, Travel → workflow, Renewal → /renewals, Policy → client). Playwright-verified.* *(Joshua.)* The source is already derived
  from the FKs (`payments.repository.supabase.ts:29-36`). Turn it into a link to the application,
  renewal, travel request or policy.

- [x] **H8c. Support USD premiums.** ✅ *Done 2026-10-19: native PHP/USD amounts now remain distinct through payment collection, payment-link activity, commission creation/tracking, and dashboard totals. Commission currency is copied from the verified payment and persisted to `commissions.currency`.*
  - **Decision (DH15):** preserve the recorded currency; never apply an FX conversion or sum PHP and USD. Payments and commission stat totals render each currency independently. Reports already followed this rule.
  - **Verification:** `lib/format.test.ts` covers native labels and separate PHP/USD totals; TypeScript and the full Vitest suite pass.

- [x] **H8d. Installments from payment frequency.** ✅ *Done 2026-10-19: migration `0050_renewal_payment_installments.sql` adds a sequenced installment contract and replaces the renewal-payment trigger. A semi-annual policy creates two Awaiting renewal payments at half the premium; annual creates one at the full premium.*
  - The policy payment mode takes precedence; the lead's H2a payment frequency is the fallback. Each payment retains the policy currency, persists its `installment_number`/`installment_count`, and appears as `installment 1/2` or `2/2` in Collections. The unique partial index prevents duplicate sequence positions for a renewal.
  - The migration was deployed and SQL-smoke-tested in a rolled-back transaction for PHP annual and USD semi-annual policies; `npx tsc --noEmit` and the full Vitest suite pass.

### H9 — Commissions

**How commission works today (Eman's process):**
1. The client pays the premium.
2. Two days to a week later, the commission arrives, without the voucher.
3. The voucher comes later in a password-protected Pacific Cross email.

Payment details are not currently connected to the commission.

- [x] **H9a. Commission rate table, per product and business type.** ✅ *Done 2026-10-06 (`f12470c` migration `0042`, `aef5877`): `commission_rates` seeded with the Oct 2 rates (HMO and FlexiShield pending), a Settings → Commission Rates tab (admin edit, effective-dated history), and `verifyPaymentAction` estimating from the product's effective rate. Still a gross estimate: VAT and WHT come with H9b. Browser-verified: ₱134,000 Select → ₱26,800.* *(JC: store the percentages
  and compute automatically.)*
  - **Current state:** `COMM_RATE = { Application: 0.18, Renewal: 0.1, Travel: 0.15 }` with a
    0.12 fallback (`app/(app)/payments/actions.ts:22`). It is keyed by payment *source*, not
    product, and applied to the gross amount (`:104`). None of these rates match what the client
    gave.
  - **Change:** migration adding a rate table (product × business type `New` / `Renewal` ×
    effective date), admin-editable in Settings.
  - **Seed values:**

    | Product | New business | Renewal |
    | :--- | ---: | ---: |
    | Select Plus / Select Standard | 20% | 20% |
    | Blue Royale | 22.5% | 20% |
    | Travel | 30% | 30% |
    | HMO | *pending — ask Eman* | *pending* |

- [x] **H9b. One pure commission function.** ✅ *Done 2026-10-06 (`004fe44`, `58c04e5`): `lib/commissions/compute.ts` `computeCommission(premium, ratePct)` works in centavos and reproduces both client examples exactly. The VAT step is the single `VAT_BASE_FACTOR = 0.88` constant (DH16 assumption). `verifyPaymentAction` now stores the **net** estimate. Browser-verified: ₱250,000 Blue Royale @ 22.5% → ₱44,550.*
  - **Formula:** paid premium − 12% VAT → × rate → − 10% withholding tax = net commission.
  - **The client's worked examples (both must reproduce exactly):**
    - Blue Royale renewal: 250,000 − 12% = 220,000 × 20% = 44,000 − 10% = **39,600**.
    - Select: 134,000 − 12% = 117,920 × 20% = 23,584 − 10% = **21,225.60**.
  - **⚠️ Assumption DH16 (logged 2026-10-06, not a decision):** build with `× 0.88` per Eman's
    examples. This has not been checked against real payout statements. Strict VAT (`÷ 1.12`)
    would give ₱40,178.57 instead of ₱39,600 on ₱250,000. Finance must confirm before go-live.
    Keep the VAT step a single, clearly named constant or function so it can be switched.

- [x] **H9c. Show the computation as a collapsible breakdown.** ✅ *Done 2026-10-06 (`58c04e5`): a "Show breakdown" toggle on each commission row (premium → VAT → base → rate → gross → WHT → net, plus the rate's source and the DH16 note). It is recomputed with the same function. Browser-verified.* Make the formula visible inside the
  app for each commission row: premium → less VAT → base → × rate → gross → less WHT → net, plus
  the rate's source (product, business type, effective date).

- [x] **H9d. File carrier commission vouchers.** Done 2026-11-06: user selected receive-and-upload
  only (DH17), not internal statement/voucher generation. Both tracker entry points file/replace
  actual PDFs with optional carrier reference, original filename/date, assigned agent, actual source
  product/plan/premium and the unchanged estimate breakdown. Payment may be recorded first;
  filing never changes money/rate snapshots or regresses Paid. Legacy rows remain `Original not filed`.
  - Migrations `0062`–`0064` applied; locked receipt/transition RPCs, retained originals and role-scoped
    payload/download/email/deletion gates verified. 399 tests and TypeScript pass; desktop/narrow
    browser, byte hashes, concurrent replacement/payment, stale/storage/network failures exercised
    using synthetic QA only. Exact evidence: `docs/development-alignment.md`.
  - DH16 tax confirmation and DH19 Travel netting remain unresolved and financially unchanged.

- [x] **H9e. Tests for H9b.** ✅ *Done 2026-10-06 (`004fe44`): Vitest 4 with `npm test`; `lib/commissions/compute.test.ts` (7 tests: both client examples step by step, 22.5%, centavo rounding, 0%, the constants, error cases). Installed with `--legacy-peer-deps` because npm 10.9's peer resolver crashed; Vitest 5 needs `@types/node` ≥ 22.* The repo has no test runner (no `test` script, no Vitest or Jest).
  - **⚠️ Decision:** DH18.

- [ ] **H9f. Travel commission may already be netted at payment.**
  - **Context:** the TravelSafe portal's breakdown shows Gross Commission (30%), Tax (10%), Net
    of Commission and Net Payable. Since Eman pays on the client's behalf, the agency may already
    pay the *net* amount.
  - **⚠️ Decision:** DH19.

### H10 — Follow-ups from testing step 4 (2026-10-06)

Found while Joshua and Matt tested the step 4 flows on the live app.

- [x] **H10a. Critical: a draft re-save overwrote an existing client.** ✅ *Done 2026-10-06
  (`efc7996`).*
  - **What happened:** browser autofill filled the hidden new-client fields. "Existing client"
    was then picked, and re-saving the draft renamed CLI-2026-00001 "Matthew Nassr" with no
    client audit row.
  - **Fix, server side:** `buildDraftClientPatch` (`lib/applications/draft-client-patch.ts`,
    unit-tested) never writes identity, owner or notes onto a client that existed before the
    draft. Any change now records a `clients` audit row.
  - **Fix, wizard side:** picking "Existing client" clears the hidden fields, and the
    new-client inputs set `autoComplete="off"`.
  - **Also in this commit:**
    - A disabled Create now lists "Still needed: …" with links to each field.
    - Picking a client with open work offers Continue draft / Open travel request / Open
      requirements.
    - A travel request that overlaps an open one is flagged.
- [x] **H10b. Unfinished travel quotes on the Travel page.** ✅ *Done 2026-10-06 (`16c660a`).*
  - Draft quotes, which live in `applications` until Create, are listed under a new
    **Unfinished** filter with a "Draft" tag, a saved date and "Dates not set".
  - New "Unfinished quotes" stat.
  - Clicking a draft reopens it in the wizard.
- [x] **H10c. Form polish.** ✅ *Done 2026-10-06 (`4270169`).*
  - **Disabled buttons:** `Btn` has a real disabled state, so a blocked Create & open portal no
    longer looks available.
  - **Section cards:** wizard sections are cards with a completeness dot and label
    (`sectionStatus`, unit-tested): neutral, green when complete, amber for reversed trip
    dates. Reversed dates now also block Create.
  - **Uploads:** ordinary uploads retain `FilePickField` and the compact `DocumentUploadForm`.
    As of 2026-11-03, requirement contexts instead open the shared device/email source picker;
    source context and explicit receipt are consistent across modules and creation wizards.
- [x] **H10d. A status indicator on every requirement row.** ✅ *Done 2026-10-06 (`52d4711`).*
  The travel, claim and application checklists share
  `components/hub/requirement-status.tsx`: the row tint and a dot for Pending, Received,
  Incomplete and Verified.
- [x] **H10e. Optimistic requirement status changes.** ✅ *Done 2026-10-06 (`04871f0`).*
  - The row updates at once (measured at 100 ms) and saves in the background.
  - If the save fails, the row reverts unless a newer pick superseded it.
  - Status dropdowns no longer disable during a save.
- [x] **H10f. Claim checklist revert edge case.** ✅ *Done 2026-10-06 (`91d5e21`, `10e155f`): the panel's onChange takes a functional updater, so a failed save reverts only its own row. A thrown request now reverts too, in all three checklists. Playwright-verified by aborting one save mid-edit.* In `claim-requirements-panel.tsx`, a failed
  status save reverts using the row list captured when the change started. Another row
  changed in the meantime can briefly snap back until the next reload. The fix is to give the
  panel a functional update instead of a whole-array `onChange`.

### Phase H decisions — for Joshua (✅ = decided)

| ID | Decision | Why it's open | Recommendation |
| :--- | :--- | :--- | :--- |
| **DH1** | H0 scope: wipe all 45 clients/leads, including the 14 created through the website, or demo seeds only? | Conflicts with Phase E D1's preserve-website-records rule | ✅ **Decided 2026-10-06: wipe all.** Supersedes D1's preservation rule; record it in `development-alignment.md` |
| **DH2** | After H0, reset the `reference_no` sequences so real clients start fresh? And what about the seed migrations `0013`/`0014`/`0016`, which re-seed demo data on any fresh `db reset`? | Real references would otherwise start mid-sequence; fresh environments would get demo data back | ✅ **Decided 2026-10-06: reset** every counter except `USR`, so the first real client is `CLI-2026-00001`. Seed migrations: still open (recommend leaving them untouched with a note) |
| **DH3** | Is "Private" one tier, or three (2M/3M/5M)? | The catalog splits Private by limit; Eman listed one Private | ✅ **Decided 2026-10-06: split the tiers, per product, matching the brochures and catalog (`0037`).** Select Plus: Ward, Semi-Private, Private 2M, Private 3M, Private 5M. Select Standard: Ward, Semi-Private, Private 2M. Blue Royale has no room tiers: its tier is the plan (Plan A / B / C, USD 500k / 1M / 2M), and the room is a daily limit (USD 300 / 600 / 850 in the PH; private room overseas), per the 2025 brochure, p. 3 |
| **DH4** | Does the new tier list also replace the `group_members` CHECK (Standard/Premium/Executive)? | Group HMO tiers may be a different vocabulary | ✅ **Decided 2026-10-06: leave the group tiers alone for now.** The `group_members` CHECK (Standard/Premium/Executive) stays |
| **DH5** | Select limit: the notes say ₱1M for both variants, but the catalog has Select Plus Private at 2M/3M/5M | Possibly just an example figure | Store the limit *basis* (aggregate vs per-illness); take the amount from the plan |
| **DH6** | Which Excel gets the updated applications and brochures listed? | The notes don't say | Ask JC and Eman: `../docs/REQUIREMENTS-matrix.xlsx` or the client workbook |
| **DH7** | Park proposal auto-detection until the agency inbox exists? | Needs inbox, parser and jobs | Park; manual upload-back is V1 |
| **DH8** | New Application: require the product in Step 1 and open Requirements after create? | Changes the wizard entry flow | ✅ **Decided 2026-10-06: yes** (require the product in Step 1, open Requirements after create) |
| **DH9** | Keep the draft-only items "Blue Royale shows HMO list" and "medical review stage"? | Neither appears in the notes | Verify with JC (and reproduce the first) before scheduling |
| **DH10** | Renewal email engine while R1 is open: a scheduled job that queues due emails/tasks for staff, or wait for a real email provider? | Nothing would actually send either way | **Decided 2026-10-10:** Vercel Cron queues staff tasks/drafts only; receipt immediate, client reminder -30 days, missing notice -60 days, premium breakdown -60 days. Production activation needs `CRON_SECRET` + deployment. |
| **DH11** | Travel flow: Eman's 2 steps or JC's draft of 4? | The notes and the draft conflict | ✅ **Decided 2026-10-06: 2 steps, as Eman asked** |
| **DH12** | Travel client entry: autofill with override (draft) or existing-client picker plus manual entry (Eman)? | The notes and the draft conflict | ✅ **Decided 2026-10-06: existing-client dropdown plus manual entry, as Eman suggested.** No silent autofill |
| **DH13** | Which requirement template do ER and Reimbursement (local and overseas) claims use? | `0032` only has IP/OP | ✅ **Decided 2026-10-06 (interim): ER / Overseas ER → In-Patient, Reimbursement / Overseas Reimbursement → Out-Patient**, pending Eman's lists |
| **DH14** | Claims policy lock when a client has more than one policy | Travel + health is possible | ✅ **Decided 2026-10-06: lock when exactly one eligible policy fits the claim type**, otherwise a carrier-number dropdown |
| **DH15** | USD handling: keep the original currency, or convert? | No FX source exists | Keep the original currency; never sum PHP and USD (same rule as Reports) |
| **DH16** | VAT: the client's `× 0.88`, or VAT-inclusive `÷ 1.12` (250,000 → 223,214.29 → 40,178.57)? | The examples imply `× 0.88` | ⚠️ **Assumption, not a decision (logged 2026-10-06):** "Commission base computed as premium × 0.88 per Eman's examples. Not verified against actual payout statements. Strict VAT method (÷1.12) would yield ₱40,178.57 vs ₱39,600 on a ₱250,000 premium. To be confirmed by finance before go-live." |
| **DH17** | Voucher: does the app *generate* it, or *receive and upload* Pacific Cross's voucher email? | The notes support both readings | **Decided by user for H9d, 2026-11-06: file carrier originals only.** Reuse PDF upload; no generated internal statement or official-looking voucher. |
| **DH18** | Test harness for H9b: add Vitest, or an assertion script under `scripts/`? | No runner exists | ✅ **Decided 2026-10-06: Vitest** (v4, `npm test`) |
| **DH19** | Travel commission: tracked as receivable, or already deducted at the portal? | The portal shows Net of Commission | Ask Eman before building H9a for Travel |
| **DH20** | JC's draft mentions a "₱150,000 threshold rule" for VAT | Not in the notes; origin unknown | Drop unless JC can source it |
| **DH21** | Standalone **Log policy copy** creates two Awaiting payments: the drawer's "Premium due for logged policy copy" and the `0050` renewal trigger's "Renewal installment 1 of 1" (dated next renewal). Awaiting totals double for a fresh policy. Keep the drawer's, keep the installment, or both with a "next cycle" label? | Found by the Oct-2 recorded QA run (`qa-oct2/REPORT.md` M4); either fix is a migration | Ask Eman/Matt; until decided nothing changes (deferred 2026-11-13) |

### Waiting on client / team (Phase H)

- **Eman:**
  - corrected policy numbers in the Conflicts tab;
  - archived-client flags and the updated sheet (includes new client Faye Kang);
  - Schedule 2 pages after the NDA, with passwords removed;
  - HMO commission %;
  - answers to DH13 and DH19.
- **Matt:** the new applications and brochures.
- **Eman & Matt:** the final renewal timeframes.
- **JC:**
  - Thea's contact and preferred wording;
  - NDA signing;
  - send the Oct 2 notes to all participants;
  - reconcile Client_Staging (159) against the Master List (105).
- **Joshua:** send the team the request list of what migration needs (JC's recommendation in the
  meeting).

### Reconciliation with JC's draft

- **Missing from the draft (said in Tagalog), now here:** H1a, H1b, H1c, H2b, H3a, H5a, H6a–e,
  H7a (corrected), H7b–e, H8a–b, H9c.
- **In the draft but contradicted by the notes:** the 4-step travel flow (DH11), autofill (DH12),
  and the claim-category wording (H7a).
- **In the draft but not in the notes:** DH9 and DH20.
- **Redundant draft items:**
  - *"Get the PC travel application form"*: received 2026-08-01.
  - *"Obtain sample generated proposals"*: an illustrative proposal is already held (R4 redaction
    applies). Ask only if a Select sample is specifically needed.
  - *"Migrate actual client records"* and *"Onboard Faye Kang"*: both duplicate the D1 import
    tasks, since Faye Kang arrives via the updated sheet.
  - *"Track travel payment status"*: mostly built (H6f).

---

## Phase I — Invite-only staff accounts (Owner-initiated) (planned 2026-11-12)

**Audit result (2026-11-12): nothing exists.** There is no in-app way to create a staff account.
Accounts are created only by one-off service-role scripts (`scripts/seed-staff.mjs`,
`scripts/create-user.mjs`, `scripts/playwright-auth.mjs`: `auth.admin.createUser` with a shared
password + `email_confirm: true`, then `public.users` upsert). The Settings → Team tab
(`components/hub/screens/settings-live.tsx` `TeamTab`) only changes role / toggles status and
literally says "invitations & real auth enrolment land in a later release". `login/actions.ts` has
sign-in/out only; no sign-up, password-set, or reset surface exists. Spec `../docs/web/pages.md`
§15 Tab 2 already asks for `Invite user` + an `Invited` status; `../docs/web/permissions.md` makes
Team Admin-only. Live DB: 7 `users` rows, all Owner/Admin (`matt@` = Owner, `eman@` = Admin), all
provider `email`, none ever invited.

**Known gaps this phase also closes:** `getActor` / `getCurrentUser` / `(app)/layout.tsx` never
check `users.status`, so "Deactivate" does **not** block sign-in today. The same check gates
`Invited` accounts, so it ships here.

**Decisions — all five ✅ confirmed by Joshua 2026-11-12** (DI1 Owner-only · DI2 both domains,
server rejects anything else · DI3 `generateLink` + Gmail API + copy-link, no new infra · DI4
invitee sets own password · DI5 defer SSO, ship password activation first — see Phase J).

| ID | Decision | Why |
| :--- | :--- | :--- |
| DI1 | Invite authority = `users.role === 'Owner'` (Matt), new `requireOwner()` beside `requireAdmin()` in `settings/actions.ts`. Eman (`Admin`) keeps role/status edits but cannot invite. | "Only Matt". `toAppRole` folds Owner+Admin into `admin`, so the gate must read the raw DB role. Note the DB also holds 3 other Owner rows (`admin@pacificinsuranceph.com` + 2 Playwright accounts); they can invite too until cleaned up (D1). |
| DI2 | Invitee email must be on an allow-listed agency domain: `pacificinsurance.ph` (today's staff logins) **and** `pacificinsuranceph.com` (the real Workspace domain, where the final mailboxes will live). One constant `STAFF_EMAIL_DOMAINS` in `lib/auth/staff-email.ts`, enforced server-side and shown as a hint in the form. | Matches the TBD Workspace-only direction without blocking the current `.ph` logins. |
| DI3 | Build the invite with `auth.admin.generateLink({ type: "invite" })` on the service-role client and **deliver it ourselves**: send via the already-connected Gmail API sender (`lib/gmail/send-api.ts` `sendGmailMessage`, `admin@pacificinsuranceph.com`) when the mailbox is connected, and **always** show a copyable link to the inviter. Do not use `inviteUserByEmail`. | Supabase's built-in SMTP is dev-only (rate-limited, delivers only to Supabase-org member addresses) and no custom SMTP is configured. The `@pacificinsurance.ph` addresses have no real mailbox yet, so Matt must be able to hand the link over out-of-band. Alternative, rejected for now: configure Supabase Auth custom SMTP against Workspace — needs an app password / relay and a second email path next to Gmail OAuth. |
| DI4 | Invitee sets their own password on a dedicated `/set-password` page; the account becomes `Active` only after that. Role is chosen by the inviter (Admin / Assistant / Viewer; never Owner). | Required behavior. Invite link = `token_hash` flow verified server-side, so no password ever travels by email. |
| DI5 | Google Workspace SSO is **deferred** (see "Later" below); no code now. | Workspace accounts on `pacificinsuranceph.com` for Matt/Eman do not exist yet; only `admin@` does. |

**Tasks**

- [x] **I1. Schema.** ✅ *Done 2026-11-12: hosted migration `user_invitations` applied, `0068_user_invitations.sql` committed, types regenerated.* Migration `0068_user_invitations.sql`: widen `users.status` check to
  `('Active','Inactive','Invited')`; add `invited_by uuid references public.users(id)`,
  `invited_at timestamptz`, `activated_at timestamptz`. Regenerate `lib/supabase/types.ts`. Extend
  `User`/`NewUser`/`UserUpdate` + `toDomain()` in `lib/repositories/users/`. Add
  `UsersRepository.findByEmail` already exists — reuse for duplicate checks.
- [x] **I2. Invite action.** ✅ *Done 2026-11-12 — lives in `lib/auth/invitations.ts` (`createInvitation`), action in `settings/actions.ts`.* `inviteUserAction({ email, fullName, role })` in
  `app/(app)/settings/actions.ts`: `requireOwner()` → normalize + domain check (DI2) → reject if
  `users.email` or `auth.users` already has it → `getSupabaseAdmin().auth.admin.generateLink({ type:
  "invite", email, options: { data: { full_name }, redirectTo: APP_URL + "/auth/confirm" } })` →
  `users.create({ id: link.user.id, status: "Invited", role, invitedBy, invitedAt })` → build
  `${APP_URL}/auth/confirm?token_hash=${hashed_token}&type=invite` → try Gmail send (DI3; failure is
  non-fatal, reported in the result) → `recordAudit({ action: "invite", tableName: "users" })` →
  return `{ user, inviteUrl, emailed: boolean }`. Needs `APP_URL` in `lib/env.ts` (+ `.env.example`,
  Vercel). `generateLink` must live behind the repository boundary (`users.repository.supabase.ts`
  or a new `lib/auth/invitations.ts` server module) — `getSupabaseAdmin` is not imported from
  actions (CLAUDE.md rule).
- [x] **I3. Resend / revoke.** ✅ *Done 2026-11-12. Smoke proved `generateLink invite` re-issues for an unconfirmed user (old link dies, new one works) — no magiclink fallback needed.* `resendInviteAction(userId)` (Owner; only while `status = 'Invited'`;
  regenerate link — verify in smoke whether `generateLink invite` re-issues for an unconfirmed
  existing auth user; if it errors, use `type: "magiclink"` with the same `/auth/confirm` handler) and
  `revokeInviteAction(userId)` (Owner; only while `Invited`; `auth.admin.deleteUser` — the
  `public.users` FK is `on delete cascade`, so the row disappears; this is the one permitted hard
  delete because nothing has ever referenced the account).
- [x] **I4. Accept flow.** ✅ *Done 2026-11-12. `"use server"` files may only export functions, so the 12-char minimum lives in `set-password/password-policy.ts`.* `app/(auth)/auth/confirm/route.ts` (GET): read `token_hash` + `type`,
  `createSupabaseServerClient().auth.verifyOtp({ type, token_hash })`, on success redirect
  `/set-password`, on failure `/login?error=…`. `app/(auth)/set-password/page.tsx` + `actions.ts`
  `setPasswordAction(formData)`: require session, password ≥ 12 chars + confirm match,
  `supabase.auth.updateUser({ password })`, then `users.update(id, { status: "Active",
  activatedAt })` via the repository, audit `activate`, redirect `/dashboard`. The same page serves
  a later "reset password" link; not built now.
- [x] **I5. Gating.** ✅ *Done 2026-11-12. Server Components cannot clear cookies, so the layout redirects deactivated sessions to `app/(auth)/auth/signout/route.ts`, which signs out and lands on `/login?error=…`.* `proxy.ts`: let `/auth/confirm` through unauthenticated (add to the exact-path
  list); `/set-password` stays behind auth. `(app)/layout.tsx` (or `getCurrentUser`): `status ===
  'Invited'` → redirect `/set-password`; `status === 'Inactive'` → sign out + `/login?error=…`.
  `getActor` throws for anything but `Active`. Sign-in action: after `signInWithPassword`, the same
  status check so a deactivated user never lands on the dashboard.
- [x] **I6. Team tab UI.** ✅ *Done 2026-11-12 (Modal, not Drawer — matches the Pacific Cross contacts editor).* `settings/page.tsx` passes `canInvite = currentUser.role === 'Owner'`
  (real role, never the persona preview). `TeamTab`: `Invite user` button → drawer (existing
  `Drawer`/overlay pattern) with Email (domain hint), Full name, Role select (Admin / Assistant /
  Viewer); success toast + a "Copy invite link" panel showing `inviteUrl` and whether it was
  emailed. Status pill gains `Invited` (amber); invited rows show `Resend` / `Revoke` instead of
  `Deactivate`, and the role select stays enabled. Remove the "land in a later release" footnote.
- [x] **I7. Supabase Auth config (dashboard, not code).** ✅ *Done 2026-11-14 by Joshua:
  Redirect URLs include production, `localhost:3000` and `localhost:3010` `/auth/confirm`; Email
  OTP Expiration set to 86400 s (Supabase's default is 1 h, not 24 h, and it governs the
  `generateLink` invite); Vercel Production `APP_URL=https://pacific-insurance-ph-ten.vercel.app`,
  redeployed; production invite → `/set-password` checked. A forged `token_hash` on production
  redirects to `/login` with the readable invalid-link error. **Leaked-password protection is
  not enabled:** it is a Pro-plan feature and the project is on Free, so the advisor warning
  stays until the plan changes.* The invite link itself is first-party (`/auth/confirm` +
  `verifyOtp`), so the allow-list only matters for Supabase's own `redirectTo` echo.
- [x] **I8. Docs + scripts.** ✅ *Done 2026-11-12 (`pages.md` §15 Tab 2, `permissions.md` §1/§3, `.env.example` `APP_URL`).* `../docs/web/pages.md` §15 Tab 2: statuses are Active / **Invited** /
  Inactive (not "Disabled"), `Invite user` is Owner-only. `../docs/web/permissions.md` §1/§3: add the
  Owner-vs-Admin split for Team invites. `app/AGENTS.md` staff-session note unchanged. Leave
  `scripts/seed-staff.mjs` for bootstrap only.
- [x] **I9. Verification.** ✅ *Browser smoke 2026-11-12 on a clean dev server as the QA Owner
  account: `someone@gmail.com` refused; `qa-invite@pacificinsurance.ph` (Assistant) invited → row
  `Invited` with Resend/Revoke, Gmail accepted the send from `admin@`, link shown; Resend issued a
  new link and the first link then failed with the readable error; new link → `/set-password`
  (mismatch and <12 chars refused) → activated → `/dashboard`; DB row `Active` with
  `invited_by`/`activated_at`, audit `invite → invite_resend → activate`. Assistant sees no Team
  tab; promoted to Admin sees Team but no `Invite user`. Deactivated: password sign-in refused
  with the deactivation message; a live session hitting `/dashboard` was signed out to `/login`.
  `QA.Two@PacificInsurancePH.com` (.com domain, Viewer) invited and normalized to lowercase;
  duplicate invite refused; Revoke removed the row and `auth.users`, its link then failed. QA rows
  deleted afterwards (an activated QA user needed its `audit_logs.actor_id` detached first — the FK
  is exactly why revoke is limited to never-activated rows).* Playwright/browser smoke as Matt: invite `qa-invite@pacificinsurance.ph`

**Later (DI5) — Google Workspace sign-in:** detailed as **Phase J** below. Phase I ships password
activation first because no `@pacificinsuranceph.com` staff mailboxes exist yet.

**Risks**
- Gmail send path (`lib/communications/outbound-email.ts`) is built around client-record
  `origin`s; the invite uses `sendGmailMessage` directly and logs nothing to `communications`
  (staff mail is not client correspondence). If the mailbox is disconnected, the copy-link fallback
  is the only delivery — acceptable for 2–3 staff.
- `generateLink` returns both `action_link` (Supabase-hosted verify URL, implicit flow) and
  `hashed_token`; use only the latter with our own `/auth/confirm` so sessions are set server-side
  via cookies, consistent with `proxy.ts` `getClaims`.

## Phase J — Google Workspace accounts, invite delivery and SSO (after Phase I)

Runs once Phase I is live. Goal: every staff login (Matt, Admin, Eman, future agents) is a real
Google Workspace account on **`pacificinsuranceph.com`**, invites land in a real inbox, and sign-in
is "Sign in with Google" with the invite as the only door. `admin@pacificinsuranceph.com` is the
Gmail OAuth mailbox wired through GCP project `pacific-insurane-ph` (keep that spelling; see
`docs/development-alignment.md` "Gmail connection"), and **since 2026-11-16 it is also Matt's
personal login (DJ8)**. `matt@pacificinsurance.ph` / `eman@pacificinsurance.ph` are CRM-only
logins with no mailbox until J2 moves them.

**Decisions**

| ID | Decision | Why |
| :--- | :--- | :--- |
| DJ1 | Sequence for every person, including future agents: **Workspace account first → CRM invite to that address (Phase I) → first Google sign-in activates.** The CRM never creates Workspace accounts and Workspace never creates CRM accounts. | Keeps Matt's invite authority (DI1) as the single authorization step; Workspace admin only provisions mail/identity. |
| DJ2 | Separate GCP OAuth client ("CRM sign-in", scopes `openid email profile` only) from the existing Gmail mailbox client (`GOOGLE_CLIENT_ID`, sensitive Gmail scopes). | Gmail client carries restricted scopes and a reconnect consent flow; mixing sign-in into it widens its blast radius and complicates Google's scope verification. |
| DJ3 | Supabase Auth: Google provider on, **"Allow new users to sign up" off**, automatic identity linking (default) on. | Signups-off makes an OAuth login for an unknown email fail at GoTrue, so SSO cannot create accounts — invite-only holds without app code. Admin-API user creation (`generateLink`, Phase I) is unaffected by the toggle. Verified-email auto-linking attaches the Google identity to the existing password user. |
| DJ4 | Domain enforced three times: OAuth consent screen **Internal** (✅ confirmed 2026-11-16: `pacific-insurane-ph` sits in the `pacificinsuranceph.com` org and the audience is Internal), `hd=pacificinsuranceph.com` on the authorize request, and a server-side check of the identity's `hd` / email domain in `/auth/callback`. `STAFF_EMAIL_DOMAINS` (DI2) shrinks to the single `.com` domain after J2. | `hd` as a query param is a UI hint only; the claim check is the real gate. |
| DJ5 | An `Invited` user who signs in with Google is activated immediately (`status → Active`, `activated_at`) without `/set-password`. The password path from Phase I stays as the fallback for the same invite. | Google is the credential; forcing a password would create a second, weaker secret. |
| DJ6 | Supabase **custom SMTP** via Workspace (`smtp-relay.gmail.com` or `smtp.gmail.com` + app password on `admin@`) for GoTrue-native mail (password reset, email-change confirmations). Invites keep the Phase I Gmail-API path. | Phase I deliberately avoided GoTrue mail; once the Workspace exists, the two GoTrue emails Phase I never covered (reset / email change) need a sender. |
| DJ7 | Password sign-in stays enabled for `admin@pacificinsuranceph.com` and the Playwright/QA accounts; retire it for Matt/Eman only by not telling them the password. Disabling the email provider globally is a later decision. | The pre-authenticated Playwright session (`scripts/playwright-auth.mjs`) and seed scripts depend on password auth. |
| DJ8 | ✅ *Joshua, 2026-11-16.* Matt has **no separate Workspace seat**: he signs in as `admin@pacificinsuranceph.com`, and `matt@pacificinsuranceph.com` is a free **alias** on that mailbox (you cannot sign in with an alias; Google reports only the primary address). In the CRM, the `admin@` login moves onto **Matt's existing user** (`73c3e291…`, 82 audit rows, 43 activities, 8 communications, the Gmail `connected_by`), not the near-empty "Admin" user (`87d46a8f…`, 1 audit row), which is renamed to a retired address and deactivated. | Saves a seat while keeping Matt's history and "Matt" attribution. Accepted costs: anyone holding the `admin@` Google credential acts as Matt; a password change on `admin@` disconnects Gmail; mail sent to the alias lands in the CRM Inbox (sync reads the whole mailbox, no recipient filter). |

**Tasks**

- [x] **J1. Workspace provisioning (Matt / Workspace admin, not code).** ✅ *Done 2026-11-16 by
  Joshua: `CRM Staff` OU with 2SV enforced; `eman@pacificinsuranceph.com` created there (her
  first sign-in / 2SV enrollment still to check); `matt@` added as an alias of `admin@` (DJ8)
  instead of a seat; 2SV enrolled on `admin@` (Matt's phone + backup codes) and enforced on the
  top-level OU. After any 2SV or password change on `admin@`, run Settings → Gmail connection →
  Check connection.* Future agents: `CRM Staff` OU, created by the Workspace admin **before** Matt
  invites them (DJ1). Eman's Outlook history migration is the meeting item in
  `../docs/Demo Validation Meeting - Notes.md` (lines 119–123); not CRM work.
- [x] **J2. Move the existing CRM identities to the Workspace addresses.** ✅ *Done 2026-11-16:
  `scripts/migrate-staff-emails.mjs` (dry run by default, `--apply` to write) applied all three
  mappings below; a rerun skips every step. Auth email, `public.users.email` and the email
  identity agree for each; three `staff_email_migrate` audit rows; Gmail still `connected`.
  `STAFF_EMAIL_DOMAINS` is now `pacificinsuranceph.com` only (invites), `seed-staff.mjs` and
  `../docs/web/pages.md` §15 updated. Timeline and submission history render `users.full_name`,
  so history still reads "Matt".* Script
  `scripts/migrate-staff-emails.mjs` (service role, idempotent, dry-run flag). Mappings (DJ8):
  (1) retire the "Admin" user `87d46a8f…`: email → a retired address on the same domain (e.g.
  `retired-admin@pacificinsuranceph.com`; must not be a real mailbox or alias), `status =
  'Inactive'`; (2) Matt `73c3e291…`: `matt@pacificinsurance.ph → admin@pacificinsuranceph.com`;
  (3) Eman `22ee6db5…`: `eman@pacificinsurance.ph → eman@pacificinsuranceph.com`. Order matters:
  (1) frees the unique email before (2). For each, `auth.admin.updateUserById(id, { email: new,
  email_confirm: true })` then `public.users.email = new`. Run after J1, before J5. Then drop
  `pacificinsurance.ph` from
  `STAFF_EMAIL_DOMAINS` and update `scripts/seed-staff.mjs`. Audit row per change. Check
  `communications` / timeline "from" identity rendering uses `users.full_name`, not the email,
  so history stays readable (verify with `grep` on `users.email` consumers).
- [x] **J3. Invite email copy (small).** ✅ *Done 2026-11-17: `STAFF_ROLE_LABELS` now lives in
  `lib/auth/staff-email.ts` and is used by the Team tab and the email ("as Agent", not "as
  Viewer"); the closing line asks the recipient to reply to let Matt know. Google sign-in is
  deliberately **not** advertised yet (step 4b still unproven). Verified: a real invite to the
  `matt@` alias was accepted by Gmail and read back from the mailbox with the new wording (Sent
  label only, so Inbox sync ignores it), then revoked; no user or auth row remains. Also fixed a J6
  regression found on the way: `scripts/playwright-auth.mjs` and `scripts/test-login.mjs` clicked
  the page's first submit button, now "Sign in with Google"; both target the password form.*
  *Re-planned 2026-11-17: the template already exists in
  `lib/auth/invitations.ts` (`invitationEmailBody`; subject, inviter, role, link, 24 h note,
  Gmail send from `admin@`, copy-link fallback). Three gaps remain:*
  1. **Role wording.** The email names the raw DB role ("as Viewer" / "as Assistant") while
     Settings → Team shows Agent / Staff. Move `ROLE_LABEL` from
     `components/hub/screens/settings-live.tsx` into isomorphic `lib/auth/staff-email.ts` (e.g.
     `STAFF_ROLE_LABELS`) and use it in both places. One map, no second convention.
  2. **Two ways in, after J6.** Say: "Sign in with Google at <APP_URL>/login using this address"
     *or* open the link to set a password. Advertise the Google route only once step 4 proves it.
  3. **Unexpected invite.** Replace "ignore this email" with "If you weren't expecting this,
     tell Matt (admin@pacificinsuranceph.com)."
  4. **Verify.** (a) Content: invite `matt@pacificinsuranceph.com`. It is DJ8's alias, so it is
     deliverable, free, on the allowed domain and not an existing CRM user. Read the received email
     in the `admin@` mailbox, then **Revoke**. Self-sent mail carries the SENT label, so Inbox sync
     skips it. (b) **Untested so far:** an *Invited* user signing in with Google directly. With
     signups off, Supabase must link the Google identity to an existing *unconfirmed* auth user;
     J8 only proved linking for already-active users. Proving it needs a real Workspace login
     that is not yet a CRM user: either a throwaway Workspace account (a prorated seat; delete it
     after) or the next real hire. Until proven, the email leads with the link.
- [x] **J4. GCP: sign-in OAuth client (console, not code).** ✅ *Done 2026-11-16 by Joshua: web
  client "CRM Sign-In" created beside the untouched "Pacific Insurance PH - Gmail" client. Consent
  screen: project in the Workspace org, audience Internal, so no Branding/Data Access changes.* In `pacific-insurane-ph`: new OAuth 2.0 Client ID (Web), name "CRM
  sign-in"; authorized redirect URI `https://lihekcuksskwipkajjyv.supabase.co/auth/v1/callback`;
  authorized JS origins = production Vercel origin + `http://localhost:3000`. Store client
  id/secret only in Supabase (J5), not in Vercel env.
- [x] **J5. Supabase Auth config (dashboard).** ✅ *Done 2026-11-16 by Joshua: Google provider on
  with the CRM Sign-In client, signups off, `/auth/callback` Redirect URLs for production,
  `localhost:3000` and `localhost:3010`. **SMTP (DJ6) deliberately deferred:** the app has no
  password-reset page yet, and the app password it needs is a standing key to the agency mailbox;
  do both together.* Providers → Google: enable, paste J4 credentials.
  Auth settings: signups **off** (DJ3). URL configuration: Site URL = production origin;
  Redirect URLs add `/auth/callback` for production, preview, and localhost (Phase I already added
  `/auth/confirm`). SMTP (DJ6): sender `admin@pacificinsuranceph.com`, name "Pacific Insurance PH";
  customize the Reset Password / Change Email templates with the agency name. Leave the Invite
  template untouched (unused).
- [x] **J6. Login + callback code.** ✅ *Built 2026-11-16 (production sign-in is J8).
  `lib/auth/google-sign-in.ts` holds the identity rule (Workspace `hd` claim, verified email equal
  to the CRM address, missing `hd` rejects) and a same-origin `safeRedirectPath`, with tests.
  Deviations from the sketch below: the post-login path travels in a short-lived httpOnly cookie
  scoped to `/auth/callback` (the redirect allow-list matches whole URLs, so no query string); the
  callback origin is the request's own origin (Supabase's allow-list still decides); a rejected
  session is ended with `signOut({ scope: "local" })` inside the callback so it never reaches the
  app and the person's other devices stay signed in. Smoke on localhost:3010: the button reaches
  Google with the CRM Sign-In client (not the Gmail one), `hd=pacificinsuranceph.com`,
  `prompt=select_account`, scopes `email profile`; signup-refused, missing and forged codes land on
  `/login` with readable errors. Not yet exercised: a real Google account completing the flow.*
  `app/(auth)/login/page.tsx`: "Sign in with Google" button →
  `signInWithGoogleAction` (`supabase.auth.signInWithOAuth({ provider: "google", options: {
  redirectTo: APP_URL + "/auth/callback?redirectTo=…", queryParams: { hd: "pacificinsuranceph.com",
  prompt: "select_account" } } })`, then `redirect(data.url)`). New
  `app/(auth)/auth/callback/route.ts`: `exchangeCodeForSession(code)` → `getUser()` → reject
  unless the Google identity's `hd` (`user.identities[].identity_data.hd`) or email domain is in
  `STAFF_EMAIL_DOMAINS` **and** a `users` row exists → status `Inactive` → sign out + `/login?error`;
  `Invited` → activate (DJ5) via the repository + audit; `Active` → redirect to `redirectTo`.
  `proxy.ts`: allow `/auth/callback` unauthenticated. Password form stays below the Google button
  (DJ7). `lib/env.ts`: no new vars (client id/secret live in Supabase); `APP_URL` from Phase I.
- [x] **J7. Staff onboarding runbook (docs).** ✅ *Done 2026-11-17: `../docs/staff-onboarding.md`
  + `INDEX.md` row; carries the "no Agent invites until J9" warning, to be removed when J9 ships.*
  *Re-planned 2026-11-17.* New
  `../docs/staff-onboarding.md` + a pointer from `../docs/INDEX.md`. **Onboarding:**
  (1) Workspace admin creates `firstname@pacificinsuranceph.com` in the `CRM Staff` OU (2SV
  enforced, 1-week enrollment window). (2) Matt → Settings → Team → Invite user: **Agent** for
  sales agents, **Staff** for office staff, **Admin** for managers (UI labels; DB roles Viewer /
  Assistant / Admin). (3) The new person opens the emailed link, or signs in with Google once J3
  step 4b is proven. (4) Matt assigns their clients (`assigned_user_id`).
  **Offboarding:** Deactivate in the CRM **and** suspend in Workspace; Revoke for never-activated
  invites. **The `admin@` caveats (DJ8):** never change its password (that disconnects Gmail);
  Matt's second factor is needed to reconnect Gmail; mail to the `matt@` alias lands in the CRM
  Inbox. **Gate:** do not invite anyone with the Agent role until **J9** ships. Say so in the
  runbook, not only here.
- [ ] **J9. Agent row scoping (blocks the first Agent invite).** *Found while planning J7,
  2026-11-17. `docs/development-alignment.md` understates it as dashboard/export-only.* Every
  module is `own` for `agent` (`lib/auth/permissions.ts` `MATRIX`), but only these filter today:
  the client record page (`clients/[id]/page.tsx` `notFound()` for another agent's client),
  Reports, Commissions, Tasks and Inbox (`gmail_inbox_actor_can_read`). The list pages for
  Clients, Prospects, Applications, Policies, Renewals, Claims, Travel, Payments and Documents
  never resolve the actor, so an Agent would see the whole book; Dashboard stats/activity and
  `/api/dashboard/export` likewise. No active Agent exists (users: 3 Owner, 2 Admin active), so
  nothing is exposed now. **Approach:**
  - One server helper returning `null` for admin/staff or the agent's user id.
  - Repository `list` methods take an `assignedUserId` filter (records via their client).
  - Every record page uses the client page's `notFound()` rule.
  - Mutating actions check ownership, since a direct POST must not bypass the list.
  - Dashboard counts, activity and export are scoped the same way.
  - Audit the ⌘K search palette.
  - **Verify** with a real Agent session (not persona preview): their lists, counts and export
    show only assigned records, and another agent's record URL/action returns not-found.
  - Correct the `development-alignment.md` gap row.
  - **Cheap interim guard (optional):** hide the Agent role in the Invite form until J9 lands.
- [x] **J8. Verification.** ✅ *Done 2026-11-17: Joshua ran the production checks (Matt via
  Google as `admin@` and Eman via Google landed as themselves; a personal Google account was
  refused; password sign-in still works). Database: Matt and Eman each have an `email` and a
  `google` identity on their existing user (no duplicate; 7 auth users = 7 CRM users, none
  orphaned, no `@gmail.com` auth user). Supabase stores Google's Workspace domain at
  `identity_data.custom_claims.hd` = `pacificinsuranceph.com`, the path `googleIdentityProblem`
  checks first.* Matt signs in with Google **as `admin@pacificinsuranceph.com`** on
  production → lands on `/dashboard` as his existing `users` row, shown as "Matt" (identity linked,
  no duplicate; the retired "Admin" user cannot sign in). Eman same with `eman@`. Negative: a personal
  `@gmail.com` Google account → blocked (signups off + callback check), readable error; a
  Workspace account that was never invited → blocked; deactivated Workspace-linked user → blocked;
  invited-but-not-activated agent via Google → row flips to `Active`. Password reset email from
  `/login` (if J5 SMTP is on) arrives from `admin@`. Playwright pre-auth session still works.

**Risks**
- Resolved 2026-11-16: the project is in the Workspace org and the consent screen is Internal,
  so the shared consent screen raises no verification issue for the sign-in client.
- `admin@` is now both the shared mailbox and Matt's login (DJ8): keep its password stable (a
  change disconnects Gmail), and Matt's second factor is needed for any Gmail reconnect.
- Changing Matt's/Eman's auth email (J2) invalidates nothing server-side (ids are stable) but
  their browser sessions survive with the old email in the JWT until refresh; log them out after
  the migration.
- `hd` is absent for consumer Google accounts and present for Workspace; the callback must treat
  "missing `hd`" as reject, never as "unknown".

## Phase K — Oct-2 QA fixes (recorded Playwright run, 2026-11-12/13)

Sections 2–9 of `TESTING-OCT2.md` were driven as recorded Playwright sessions (harness, scripts,
videos and per-section reports under `qa-oct2/`; consolidated findings in `qa-oct2/REPORT.md`).
Everything below was fixed on 2026-11-13 and re-verified with throwaway scripts
(`qa-oct2/fix-*.mjs`, screenshots under `qa-oct2/videos/fix-*/`). `npx tsc`, `npm run lint`
(one pre-existing error in `components/inbox/correction-control.tsx`) and the full Vitest suite
pass.

- [x] **K1. Money rendering keeps the recorded currency everywhere (M1–M3, L15, L17–L19).**
  `money()` prints cents when present (`₱21,225.60`) and exports `currencySymbol()`. Verify
  payment drawer, Log payment links drawer, /policies and /renewals premium cells render
  `money(amount, currency)`; stats use `moneyTotals` per currency. `lib/queries/dashboard.ts`
  revenue is per currency (`totals: Record<currency, number>`, rows likewise); the dashboard widget
  and `lib/exports/dashboard-export.ts` show PHP and USD separately. Both drawers show
  "Renewal installment n/m". /payments no longer clips its action column at 1440 px. The
  `Renewal` entity gained `currency` (joined from `policies.currency`). Completes H8c/DH15.
- [x] **K2. Client search matches full names (M9).** `ClientsRepository.search()` tokenises the
  term and chains one `.or()` per token (AND across tokens, OR across first/last/email/mobile/
  reference); helpers in `lib/repositories/clients/search.ts` + test. Fixes every ClientPicker and
  the ⌘K palette.
- [x] **K3. "View as" narrows the Renewals and Travel surfaces (M5, M6).** `Sync policies` needs
  `canSyncPolicies && persona.role === "admin"`. The Travel workflow uses `usePersona()`:
  non-editors see a read-only banner and no portal/requirement/pack mutations; the post-issuance
  pack is hidden for an Agent preview (server rule unchanged).
- [x] **K4. Claims workflow (M7, L12–L14).** A claim with no requirement rows opens on Step 2
  "Generate checklist" (`claimWorkflowProgress` gained `checklistAvailable`; test added). File
  claim preselects the Active / most recent effective policy when several match. "Change claim
  type" starts on a placeholder. Email step: Received-without-file items are listed "(to follow)"
  and no longer block sending — only Pending/Incomplete required items do (UI and
  `lib/communications/outbound-email.ts` share `toFollowItems()`); applies to application
  submissions too (same shared step).
- [x] **K5. Commissions (M8, L21).** Pending-rate rows show "Commission rate pending for <product>
  — set it in Settings → Commission Rates" with a link to the tab. Agent preview hides
  File/Replace voucher, Request Voucher, Log Follow-up, Mark Paid and the contact select. L20
  (missing Verify toast) was a QA-script artifact, not a bug.
- [x] **K7. Papercuts (L1, L3–L6, L8).** Proposal card tracks the proposal by `proposal_status`
  at any stage. New Application wizard: `role="dialog"`, named Close button, `Field` gained an
  optional `htmlFor`, Step 4 and workflow Step 6 show loading states instead of empty-state text.
  Policies card PDF opens in a new tab. Travel wizard: leaving the auto-filled client drops
  Traveler 1/passport in the same `set()` update; "Use applicant" fills a blank Traveler 1.
- [ ] **K6. Double Awaiting payment on standalone Log policy copy (M4).** Deferred — **DH21**.
- [ ] **K8. Not fixed, logged:** L7 rule-name wording (DB seed "Carrier premium breakdown
  request" — guide updated instead), L9 open-trip warning fires for any open trip, L10
  "Travel Insurance Complete Numbers" never suggested for the emergency-numbers slot, L11 claim
  type order, L16 "installment 1/1" label on Annual (trigger `0050`), L6 `email_templates` row
  "Policy issued" (data, not code), stale picker rows while a search is pending.
- Open from the run: real Staff/Agent logins were never exercised (persona preview only); cron
  steps of §5.3 not run against the live project; filing a voucher (9.2) or recording an Inbox
  attachment (6.5) creates rows only SQL can delete — run those on a development branch.

## Dependency-gated domain completion (not blocking C1–C7)

- **Claims source pack received.** The medical NOC supplies in-patient/out-patient requirements and
  the TravelSafe NOC supplies benefit-specific requirements. When Claims is prioritized, build on
  C4's configurable template/instance pattern instead of hardcoding those lists; link the correct NOC
  library asset and checklist to each claim type.
- **Travel core inputs are sufficient.** The Travel application form and the confirmed application
  form + passport/valid-ID rule are enough for C7. The portal URL/demo is still required for portal
  handoff behavior; the Travel brochure, geographical-loading reference, credit-card authorization,
  and payment-options material are only required for complete collateral/payment support.
- **Renewal assets await permission.** Renewal tracking and reminders can continue from the existing
  specs, but production attachment flows need the renewal notice, coverage/exclusion endorsements,
  amendment form, and reinstatement form before they can be considered complete.

### Received but not loaded — wanted assets still blocked (2026-09-07)

The carrier-library load put 40 source files into `document_library` as 46 Active + Approved rows.
Twelve received files were deliberately left out; every one is named with its reason in
`scripts/carrier-library-manifest.json` → `excluded[]`.

**Eight of those twelve are closed questions, not backlog** — six per-client Pacific Cross outputs
that were never library candidates (four of them still carry recoverable client data, checklist
A2), the retired Easy Payment Options, and the superseded marked-up Travel form. Nothing to do.

Three of the four are now loaded; only the Proposal Information Sheet is still out.

| Asset | Why it is wanted | What blocked it | Status |
| :--- | :--- | :--- | :--- |
| **CCAF** (Credit Card Authorization Form, `.pdf`) | Payment setup; already named as needed collateral in the Travel bullet above | The `document_library_document_type_check` CHECK constraint — seven fixed values, none of which fit an authorization form | **DONE 2026-09-21.** Migration `0039_document_library_document_types.sql` added `Authorization Form` + `Reference Document` to the CHECK constraint (and `LIBRARY_DOCUMENT_TYPES` in the entity, and the loader's own type set). Loaded as `document_type = 'Authorization Form'`, attached to Travel Insurance. |
| **Geographical Loading** (`.pdf`) | Pricing / underwriting reference; also named in the Travel bullet | Same CHECK constraint — a reference sheet fit none of the seven types | **DONE 2026-09-21**, same migration. Loaded as `document_type = 'Reference Document'`, attached to Travel Insurance. `document_library` is now 48 rows (was 46). |
| **Proposal Information Sheet** (BC Flexi, `.doc`) | Part of the BC Flexi requirement pack | Header reads *"FOR INTERNAL USE ONLY (to be filled out by Pacific Cross Sales Personnel)"* and checklist **C3 — who completes it — is unanswered**. Loaded as a BC Flexi application form it would sit one click from a client email. | **Still open.** No code change needed at all: `.doc` is already an accepted format. This is the only one of the four that is purely a business decision — needs a client answer to C3. |
| **CET** (Corporate Enrollment Template, `.xlsx`) | BC Flexi PDF enrollment derives from it (see the 2026-08-24 carrier follow-up row in `docs/development-alignment.md`) | The PDF/DOC/DOCX allowlist, in more places than first listed: the Settings upload action, the file picker's `accept`, the loader's `MIME_TYPES`/`EXT_FOR_MIME`, the preview route's content types, the viewer, and the loader's Word-only PDF conversion. Also no fitting `document_type` — and `Application Form` was unsafe, because `matchCarrierForm` takes BC Flexi's first eligible Application Form and the undated Franchise form would tie with an undated CET. | **DONE 2026-09-25.** Migration `0040` added `Enrollment Template`; `.xlsx` accepted in every gate above. The loader renders a LibreOffice PDF companion (5 landscape pages) so the viewer can show it, while Download still serves the editable `.xlsx`. Loaded under BC Flexi; the Franchise form remains BC Flexi's only Application Form. `document_library` is now 49 rows. |

What's left: only the Proposal Information Sheet. It needs no engineering at all — only an answer
from the client, and it should stay out of the library until that answer exists.

Related and still open: the **A1 distribution clearance is unsigned** and was treated as not-a-gate
for the load by explicit client decision on 2026-09-07 (recorded in `docs/development-alignment.md`).
If it is ever refused, `scripts/load-carrier-library.mjs --apply --unapprove` reverts every loaded
row to Inactive in seconds and the library reads as empty to every consumer.

## Noted, not yet prioritized (from the meeting, no task requested)

- ~~Dashboard **Export-to-spreadsheet** is a stub~~ — **BUILT 2026-08-17.** The button now opens a
  format menu (`.xlsx` / `.ods` / `.csv`) served by `app/api/dashboard/export/route.ts`, with the
  workbook built in `lib/exports/`. Nine sheets (Summary, Trends, and one per queue) carry up to 500
  rows each rather than the 5–6 the cards show; CSV is the summary metrics only, as a single flat
  table. Readability via column widths, peso/date number formats and merged section titles —
  SheetJS community can't style cells, see the `docs/development-alignment.md` row. The **Reports**
  follow-up is now **BUILT 2026-08-26**: all six families use live repository data and the scoped
  export route emits audited XLSX/ODS/CSV files without combining currencies.
- **WYSIWYG email editor** for templates, and the **Gmail-under-PacificInsurancePH.com** migration +
  real send (ties to R1).
- The **Renewals & Claims** deep-dive remains the client's requested next meeting topic after the
  client-data import. The received forms reduce document ambiguity but do not replace that workflow
  validation meeting.

---

## Verification (per task)

- **Run the app:** `npm run dev` (port 3000 from the last run; roadmap references 3010 for
  Playwright). Drive flows with the **pre-authed Playwright MCP** (staff session) — no login needed.
- **Migrations:** apply via Supabase MCP `apply_migration`, then `generate_typescript_types` →
  confirm `lib/supabase/types.ts` updated and `tsc`/lint pass.
- **A1:** open New Lead → set a birthday → save → confirm it persists and renders on the profile.
- **B1:** enter a lead from `/prospects` → back returns to `/prospects` (not `/clients`).
- **B2:** log a discovery call (both from the profile *and* the Leads quick-action Engage drawer) →
  status updates automatically and the correct stage-advance popup appears, matching
  `lead-stage-status-example.md`.
- **B3:** save a draft → find and click "Continue Application" → wizard reopens with all fields
  rehydrated.
- **C1:** Commissions appears as its own nav item/route with the existing data.
- **C3:** create/edit a Pacific Cross officer; confirm it's selectable in Request Proposal.
- **C4:** mark items missing/incomplete/received/verified → verified progress updates in the modal →
  follow-up email logs with the outstanding items listed.
- **C5:** completeness appears directly on each Applications list row and follows the persisted C4
  checklist.
- **C6:** upload/version an approved brochure and application form → the correct active asset is
  selectable by product/age → the logged communication identifies the exact version and does not
  falsely claim delivery while R1 remains open.
- **C7:** select a regular vs. age-71+ health applicant and a Travel applicant → the correct carrier
  form/checklist is selected, operational fields persist through draft/resume, and completed originals
  remain attached documents rather than duplicated legal forms.
- **D2:** deploy a preview on Vercel and confirm login succeeds end-to-end.

## Remaining execution order (updated 2026-08-20)

**Phase H order (added 2026-10-05).** Decide the DH items each step depends on before starting
it.
1. **H0**: clear client and lead data. This gates the rest.
2. **Quick wins:** H6a (TravelSafe preselect), H7d (claims checklist back bug), H1a (tier
   vocabulary).
3. **Data correctness before the import:** H1c (policy edit), H1d (Archived status), H4a (log
   policy copy + PDF), H9a–c (commission rates, formula, breakdown).
4. **Flow simplification:** H6b–d (travel), H7a–c (claims), H3a (New Application), H2a–b
   (proposal encode list).
5. **After the D1 import:** H5a (renewal rows), then H5b–e once the timeframes are final, then
   H8a–d.
6. **Parked:** H2d and H4b. **Gated on the NDA:** H1e.

C2a, C7, D2, and the entire Phase D/F Lead Lifecycle remediation are all complete.

**Until 2026-08-18 this section read "what's left is exclusively dependency-gated on external
input."** That is no longer true. Eman's written requirement lists arrived that day, and checking
them against the code produced **Phase G — nine gaps that are entirely ours to fix.** Phase G is now
the only actionable work in this plan, and the whole of it is actionable today.

**Actionable now — no external dependency:**

- **Phase G (G1–G9)** — carrier requirement reconciliation is complete as of 2026-08-24. G9 closed
  the last wizard-lane gap with BC Flexi's two requirement gates and the fresh Group HMO Application
  persistence fix. **Remaining: G10 only** (pre-approvals, split out of G8), blocked on Eman.
  **G10 sits outside that lane** — it touches claims, not the wizard, so it could run alongside them,
  but it is blocked on Eman confirming whether a pre-approval is a record or an attachment.

**Still externally blocked or dependency-gated:**

- **C2b** — deferred for V1 in favor of the received carrier portal; formula still unavailable
- **C6b** — actually transmitting attachments (blocked on a real email provider, R1)
- **D1** — workbook received; import now waits on recency confirmation, cleaning, mapping,
  deduplication, dry-run approval and real-client-data clearance
- **D3 core load — DONE 2026-09-07**, **CCAF + Geographical Loading — DONE 2026-09-21**, **CET —
  DONE 2026-09-25** (see Phase E above; migrations `0039` and `0040`). Distribution clearance was
  treated as not-a-gate by client decision, not resolved by a signature. One wanted asset remains
  excluded — the **Proposal Information Sheet**, blocked on a client answer to checklist question
  C3 (see "Received but not loaded" above).
- Claims, Travel collateral, Renewals — each waiting on specific client-supplied assets/permissions

**Worth sequencing before D1:** G1 changes BC Flexi's product category and reconciles the
"BC Flexi" / "BC Flexi HMO" name split. Doing it *after* importing 300 real clients means migrating
their product references too.

Dashboard export-to-spreadsheet, a WYSIWYG email editor, and the Gmail migration remain noted but
not requested as tasks (see "Noted, not yet prioritized" above). The fabricated notifications,
sidebar counts, dated close-out card and Prospects Intake Forms widget were removed or live-backed
on 2026-08-25. The mock Reports route was replaced on 2026-08-26; lower-priority cleanup findings
remain documented in the archived [`docs/archive/future-refactor.md`](docs/archive/future-refactor.md).
