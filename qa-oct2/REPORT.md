# TESTING-OCT2 — recorded Playwright run, sections 2–9

Run 2026-11-12/13, local dev server (`npm run dev -- --port 3010`, commit `859bbd2`, branch
`phase-i-staff-invites`) against the **live** Supabase project, signed in as
`playwright-staff@prodigitality.net` (DB role Owner → app role admin). Staff/Agent checks used the
**View as** persona switcher only (no Staff/Agent credentials available).

Per-section scripts: `qa-oct2/0N-*.mjs`; shared harness `qa-oct2/lib.mjs`; summaries
`qa-oct2/reports/0N-*-SUMMARY.md`; per-check logs `qa-oct2/reports/N.N-*.md`; videos
`qa-oct2/videos/<N.N-feature>/<N.N-feature>.webm` (+ screenshots, `popup-*.webm` for portal
pop-ups).

## Fix status (2026-11-13, Phase K in `TO-BE-UPDATE-PLAN.md`)

| Status | Bugs | Proof |
| :--- | :--- | :--- |
| Fixed | M1, M2, M3, L15, L17, L18, L19 | `videos/fix-money/`, `reports/` via `fix-money.mjs` |
| Fixed | M9 | `videos/fix-search/` (`fix-search.mjs`) |
| Fixed | M5, M6 | `videos/fix-persona/` (`fix-persona.mjs`) |
| Fixed | M7, L12, L13, L14 | `videos/fix-claims/` (`fix-claims.mjs`) |
| Fixed | M8, L21 | `videos/fix-commissions/` (`fix-commissions.mjs`) |
| Fixed | L1, L3, L4, L5, L6 (link), L8 | `videos/fix-papercuts/` (`fix-papercuts.mjs`) |
| Not a bug | L20 — the 9.1 script stopped polling once the commission row existed, before the action resolved and the toast rendered (toast measured at 14.6 s after click) | `videos/fix-commissions/L20-toast.png` |
| Deferred | M4 → **DH21** (needs Eman/Matt) | — |
| Logged only | L2, L7 (guide wording updated), L9, L10, L11, L16, L22, L6 template name (DB row) | — |

## Results

| § | Feature | Result | Video |
| :--- | :--- | :--- | :--- |
| 2.1 | Payment frequency at Generate Proposal | PASS (+1 low bug) | `videos/2.1-payment-frequency/` |
| 2.2 | Details to encode mirror the portal | PASS | `videos/2.2-details-to-encode/` |
| 3.1 | New Application opens the full requirement set | PASS (+1 low bug) | `videos/3.1-new-application-requirements/` |
| 4.1 | Log policy copy and retrieve the PDF | PASS (+1 med bug) | `videos/4.1-log-policy-copy/` |
| 5.1 | Renewals generated from policies | PASS, 1 med bug | `videos/5.1-renewals-from-policies/`, `5.1-staff-persona-evidence/` |
| 5.2 | Notice received date | PASS | `videos/5.2-notice-received/` |
| 5.3 | Configurable email schedule, four emails | PASS (steps 4–5 cron not run) | `videos/5.3-email-schedule/` |
| 6.1 | New travel quote defaults to TravelSafe | PASS | `videos/6.1-default-travelsafe/` |
| 6.2 | Two-step travel flow | PASS | `videos/6.2-two-step-flow/` |
| 6.3 | Existing client or manual entry | PASS, 2 low bugs | `videos/6.3-existing-or-manual/` |
| 6.4 | Requirements uploaded in the travel step | PASS | `videos/6.4-requirements-upload/` |
| 6.5 | Carrier policy, application copy, reference emails | PASS; steps 4 (final Record) partially BLOCKED (synthetic Gmail bytes), step 7 Agent persona bug | `videos/6.5-carrier-pack-references/` |
| 6.6 | Travel payment method | PASS | `videos/6.6-payment-method/` |
| 7.1 | New claim types | PASS, 1 med bug (legacy claim) | `videos/7.1-claim-types/` |
| 7.2 | Policy defaults to the client's policy | PASS (+1 low) | `videos/7.2-policy-defaults/` |
| 7.3 | Requirements in the claim workflow; change type | PASS | `videos/7.3-requirements-workflow/` |
| 7.4 | Email Pacific Cross with the documents | PASS (+1 low UX) — Send not clicked | `videos/7.4-email-pacific-cross/`, `7.4b-send-controls/` |
| 7.5 | How and when the claim arrived | PASS | `videos/7.5-claim-intake/` |
| 8.1 | Pending payments from sources, linked back | PASS | `videos/8.1-payment-sources/` |
| 8.2 | USD premiums | **FAIL** — 5 places still render USD as ₱ / sum into ₱ | `videos/8.2-usd-premiums/` |
| 8.3 | Semi-annual installments | PASS (+2 low) | `videos/8.3-installments/` |
| 9.1 | Commission rates, net formula, breakdown | PASS, 1 med bug (pending-rate text) | `videos/9.1-commission-rates/` |
| 9.2 | File the commission voucher | PASS (+ low notes) | `videos/9.2-commission-voucher/` |

## Bugs & errors (consolidated)

### Medium

| # | § | Bug | Evidence / code |
| :--- | :--- | :--- | :--- |
| M1 | 8.2 | USD payment rendered as pesos in the **Verify payment** drawer (`₱1,200`, label "Premium amount (₱)") | `components/.../verify-payment.tsx:94,170`; `videos/8.2-usd-premiums/82-verify-drawer-usd.png` |
| M2 | 8.2 | **Dashboard revenue widget** adds USD into the peso total (₱3,099,724 → ₱3,100,924 after a US$1,200 payment); no `US$` shown | `lib/queries/dashboard.ts:114-144`, `dashboard.tsx:176,202`; `82-dashboard.png` |
| M3 | 8.2 | **Log payment links** drawer lists the USD payment as `₱1,200` and sums it in pesos | `payment-links.tsx:188,210,236`; `82-payment-links.png` |
| M4 | 4.1 / 8.1 | Logging a standalone policy copy creates **two** Awaiting payments for the same premium: "Premium due for logged policy copy" plus the renewal automation's "Renewal installment 1 of 1" (due next year). Awaiting totals double. Possibly by design, needs a decision. | DB: PAY-2026-00045/46 for POL-2026-00034 |
| M5 | 5.1 | **Sync policies** button still rendered under View as → Staff (server action still admin-only). `canSyncPolicies` comes from the real role and ignores the persona, unlike Settings/Tasks. | `app/(app)/renewals/page.tsx` → `operations.tsx:308`; `videos/5.1-staff-persona-evidence/` |
| M6 | 6.5 | View as → Agent does not narrow the **Travel workflow** (uploads, Record/Change/Unlink stay, no read-only text). Same root cause as M5 (`canFilePostIssuance`, `travel/actions.ts:147`). Real Agent login untested. | `videos/6.5-carrier-pack-references/agent-workflow.png` |
| M7 | 7.1 | A claim with **no checklist rows** (legacy `Hospitalization` claim) opens the workflow on Step 3 "Email Pacific Cross" with Requirements ticked done, instead of Step 2 "Generate checklist" (`outstanding === 0` treated as complete). | `lib/claims/workflow.ts`, `claim-workflow.tsx:96-98`; `videos/7.1-claim-types/7.1-legacy-workflow-opened.png` |
| M8 | 9.1 | Product with a **pending commission rate** (FlexiShield) shows only `—` on the commission row; the "Commission rate pending … set it in Settings → Commission Rates" text exists only in the follow-up task's notes (not shown on /tasks cards either). | `videos/9.1-commission-rates/9.1-flexishield-pending.png` |
| M9 | 3.1 / 5.1 / 6.3 | **Client picker / search never matches a full name** ("QA OCT2 Applicant" → no results; first name, last name or email alone works). Seen in New Application, Log policy copy, Travel existing-client picker; likely ⌘K palette too. | `lib/repositories/clients/clients.repository.supabase.ts:204-206` (ORs the whole term against each column) |

### Low / papercuts

| # | § | Bug |
| :--- | :--- | :--- |
| L1 | 2.1 | Proposal tracking card on a lead **past** the Proposal stage (e.g. Product Selected) only offers "Open Pacific Cross portal" with footnote "Proposal actions are available once this lead reaches the Proposal stage", although Generate Proposal is offered at every stage (`proposal-card.tsx:116-126,219-223`). |
| L2 | 2.1 | Generate Proposal modal: saved frequency prefills asynchronously — select reads "Select…" for 1–4 s. |
| L3 | 3.1 | Application wizard portal has no `role="dialog"`/`aria-label`; close "×" has no accessible name; `Field` labels lack `htmlFor` (post-create dialog does have them). |
| L4 | 3.1 | While the BC Flexi template preview loads, Step 4 reads "Select a product in Step 1 to generate the checklist." (no loading state). |
| L5 | 4.1 | Workflow Step 6 transiently shows "Still needed: Select variant, matching active plan" + disabled button while product options load; no loading indicator. |
| L6 | 4.1 | Email template still named **"Policy issued"** in the profile's Send Email picker (wording). `PDF` link on the Policies card has no `target`, so it navigates the profile tab away. |
| L7 | 5.3 | Rule named "Carrier premium breakdown **request**" vs checklist "Carrier premium breakdown". Draft modal has Save/Dismiss/Review→Send but no separate **Log** action (doc drift after Gmail sending). |
| L8 | 6.3 | Switching Existing → New client keeps the previous client's auto-filled Traveler 1 row + passport; "Use applicant" adds the new person as Traveler 2. |
| L9 | 6.3 | Open-trip warning fires for any open trip, not only overlapping dates (overlap wording only in the create toast). |
| L10 | 6.5 | "Travel Insurance Complete Numbers.pdf" is never suggested for the emergency-numbers slot (pattern wants "emergency"). |
| L11 | 7.1 | Claim type option order differs from the guide (UI: IP, OP, ER, Reimbursement, Overseas…, Travel). Set is identical. |
| L12 | 7.2 | With several matching policies the dropdown defaults to "None / not linked" ("Unlinked policy" header) — easy to file unlinked. |
| L13 | 7.1 | Legacy claim's "New claim type" picker defaults to IP, so Change claim type is enabled with nothing chosen. |
| L14 | 7.4 | Items marked Received without a file are listed "(to follow)" in the email body while a red alert says "Upload each file on the checklist before sending" and Review submission is disabled — contradictory. |
| L15 | 8.2 | /policies premium cell + "Premium under management", /renewals premium + "Awaiting payment" stat show USD as ₱ (`operations.tsx:208`, `:317,346`). |
| L16 | 8.3 | Annual renewal payments labelled "installment 1/1" (trigger `0050_…sql:42-57`, `payments-live.tsx:104`). |
| L17 | 8.3 | Verify / payment-links drawers give no installment context (two identical ₱5,000 rows). |
| L18 | 8.x | /payments table clips the last column at 1440×900 ("Verify Pay…"), card is `overflow-hidden`. |
| L19 | 9.1 | `money()` drops trailing zero: `₱21,225.6`, `− ₱2,358.4` (`lib/format.ts`, no `minimumFractionDigits`). |
| L20 | 9.x | Verify Payment success toast "Payment verified · invoice recorded" never observed (8 verifications); drawer closes silently. |
| L21 | 9.2 | View as Agent on Commissions masks amounts but keeps File/Replace voucher, Request Voucher, Mark Paid (preview only). Filing a voucher moves `voucher_status` Pending → Received although modal copy says it "does not record a commission payment". Paid shows a date, "Original filed" shows a timestamp. |
| L22 | 1.4 (pre-existing note) | "Show archived" checkbox unstyled — already noted in the guide. |

### Environment notes (not app bugs)

- Single dev server under 8 parallel browsers: route compiles stalled 20–150 s; server actions
  5–60 s. Scripts use 60–150 s waits/polling. Early aborted runs left extra `QA OCT2 …` records.
- One React hydration-mismatch console error (`caret-color: transparent` on the topbar search)
  seen once in 3.1 — attribute not in source; likely a Playwright screenshot artifact.
- One 503 console error in 6.5 from previewing a synthetic Gmail-only attachment part.
- No other console/page errors in any completed run.

## Not exercised

- 5.3 steps 4–5 (early-payer no-reminder, carrier request dismissal, `/api/cron/renewals`) —
  cron deliberately not called against the live DB.
- 6.5 step 4 final **Record from Inbox** on a trip-level email: the synthetic message has no
  Gmail bytes, so the record call fails at download (everything up to it verified).
- 7.4 **Send** and every real email send.
- Real Staff / Agent logins (persona switcher only).

## Test data — cleaned up 2026-11-13

Everything created had client `first_name = "QA OCT2"`. `qa-oct2/cleanup.mjs --apply` removed
36 of 39 QA clients with their applications, policies, renewals, claims, trips, payments,
commissions, documents (+42 storage objects), tasks, drafts and timeline rows. Reference counters
(CLI/POL/APP/…) were advanced and are **not** reset.

The last 3 clients were protected by the append-only guards `immutable_commission_voucher_original`
(migration 0062; vouchers filed in 9.2 → clients `9c224106…`, `7f4dc155…`) and
`immutable_requirement_attachment_source` / `immutable_gmail_inbox_filing` (migration 0057; synthetic
Inbox filing seeded in 6.5 → client `e1f093bb…`, trip TRV-2026-00023). With the user's approval
they were removed by one SQL transaction (Supabase MCP) that disabled those three triggers, dropped
the four `documents`↔`commissions` voucher FKs (all `ON DELETE RESTRICT`, which cannot be deferred),
deleted the QA-scoped rows, re-added the FKs (validated) and re-enabled the triggers. Result:
0 QA clients left, 3 triggers enabled, 4 FKs restored; their 8 storage objects removed.

Four orphan payments `PAY-2026-00018…21` ("Renewal installment 1 of 1", all FKs set null by the
earlier deletes) were deleted separately. Final counts equal the pre-run baseline: clients 2,
policies 1, applications 1, renewals 1, claims 1, travel_requests 1, payments 2, commissions 1,
commission_rates 10; `renewal_email_rules` offsets 0 / −30 / −60 / −60.

Note for future runs: filing a commission voucher or recording an Inbox attachment creates rows
that only SQL can remove — avoid those two steps on the live project, or run them against a
development branch.

Settings changed and restored: `renewal_email_rules.client_reminder.offset_days` −30→−31→−30;
`commission_rates` rows `87bbc393-…`, `f5c4978f-…`, `92275ab6-…` (FlexiShield 15%) inserted via
UI and deleted via DB — table back to the 10 seeded rows. Persona reset to Admin.
