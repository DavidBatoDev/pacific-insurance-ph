# Manual web test guide

Manual checks are grouped by feature/date. Start with the current picker section below;
the October application, claim and renewal checks are preserved afterward as history.
Run commands from the `app/` repository, not the parent workspace.

The new instructions are based on the current implementation and the recorded verification in
[Development Alignment](docs/development-alignment.md). They are not a claim that every scenario
was rerun while updating this document.

## November 4: real Gmail sending and replies

Prerequisites: schema through `0059`, a connected `admin@pacificinsuranceph.com` with the send
grant (Settings shows the recorded grant; **Check connection** verifies it live), and real Admin,
Staff and Agent sessions. **Only ever address QA mail to admin@pacificinsuranceph.com**; check the
final To in the review before pressing Send. Use a clearly labeled QA client and, for carrier
steps, a QA external contact with that same address (never the real Pacific Cross contacts).

1. Every individual email (contact composer/Engage drawer, missing application/claim documents,
   billing, Pacific Cross submission, proposal request, proposal delivery, renewal draft, wizard
   post-create review, Inbox Reply) shows the editor, then **Review email** with the final From,
   To, subject, body and real attachment names/sizes. Nothing is sent until the final Send button.
   Editing after review invalidates it. Double clicks never send twice.
2. Accepted shows `Sent — accepted by Gmail. Delivery and reading are not confirmed.` and the
   workflow change (first-touch Attempted, proposal Sent, submission status/date, renewal draft
   Sent + task Completed, activity/audit) happens only then. Not sent/Outcome unknown change
   nothing. Unknown never offers resend: **Check status** reads Gmail; an empty search stays unknown.
3. Attachments are the stored originals (PDF, Excel, …). Same-named files become `name (2).ext`.
   A changed/replaced/foreign file fails before Gmail. Submission attaches every checklist file
   with the numbered ZIP names; a required item without a file blocks sending by name.
4. Reply works only for linked correspondence (Admin sees “Link this correspondence before
   replying” otherwise); recipient and subject are locked; the reply lands in the same Gmail thread.
   Typing a reply survives the Inbox freshness banner and **Refresh inbox**.
5. Agents see the restriction message and cannot prepare/send/check even by direct POST.
   Campaigns and bulk payment links remain logged only.

Recorded verification (2026-11-04, local dev server against the production project): 345 unit
tests (transport against a local HTTP simulator incl. dropped responses; MIME parsed back with
`mailparser`; service races/uncertainty; controller recovery), type-check and lint. SQL: rollback
transition tests (repeat rules, unknown→failed rejected, late acceptance after deactivation,
renewal binding/queue/dismiss guards, thread-target suggestion and ambiguity), eight concurrent
claims → one token, eight concurrent same-intent prepares → one communication, changed payload →
conflict, browser roles denied on table/RPC. Live Gmail, all to admin@pacificinsuranceph.com:
contact email (PDFs + native .xlsx, duplicate names), proposal delivery, application missing
documents, application submission, billing, claim missing documents, claim submission, proposal
request, renewal draft, wizard post-create email, Inbox reply, and a real dispatch whose answer was
discarded then reconciled to accepted without a second send. Attachment SHA-256/name/type of the
fetched Gmail copies matched the originals; no Cc/Bcc; the reply kept thread, In-Reply-To,
References and subject; a double-clicked Send produced exactly one Gmail copy. Agent/inactive
direct POSTs and cross-client documents/record pairings were rejected. Not exercised: Travel
portal path of the wizard, commission voucher/renewal-notice Engage shortcuts, a real external
sender's reply, and a production deployment.

QA fixtures kept because sent evidence references them (restrictive FKs): client
`QA GMAIL OUTBOUND Synthetic Fixture` (CLI-2026-00008) with its applications, claim, policy
`QA-SYNTHETIC-001`/renewal, synthetic documents, the linked QA inbox fixture, two now-Inactive QA
external contacts and two now-Inactive QA staff accounts. QA emails remain in the mailbox.

## November 3: non-disruptive Inbox freshness

Prerequisites: schema through `0058` and the matching web build. Use real active accounts,
not the persona switcher, and disposable correspondence/client requirements.

1. Keep a message selected with unsaved linking/filing choices or an attachment picker open.
   A newly authorized message should show **Inbox updates available** within the next visible,
   online check (30 seconds), without replacing the page or changing any selection.
2. Choose **Refresh inbox**. The button shows **Refreshing…** while pending; page 1 displays
   newer correspondence while retaining the selected message and local workspace filters.
   A selected message whose access was revoked must return the server's not-found view.
3. Hide the tab or go offline: checks pause. Returning visible/online checks immediately.
   Failed checks preserve known updates and show the unchanged-view warning; success clears it.
   Expired/inactive access stops checks and offers **Sign in again**.
4. Release an older email to an assigned client even with more than 100 newer messages.
   Staff and that client's Agent get a notice; an Agent assigned elsewhere must not.
5. Confirm `/api/inbox/freshness` returns only a 32-character lowercase revision, private/no-store,
   nosniff; anonymous/inactive sessions get 401 JSON, not login HTML. Sibling routes stay gated.

Automated/terminal verification: 14 deterministic controller cases, real scoped SQL rollback
checks and authenticated HTTP checks passed. Owner-side visual/keyboard/dialog-state acceptance
is not exercised by terminal checks; steps 1–3 still require that manual acceptance.

## November 3: shared requirement attachment picker

Prerequisites: schema through `0057`, the matching application build, real Admin/Staff/Agent
sessions, and isolated QA clients/records. Email choices require correspondence already released
to the selected client; an email-address match alone is not authorization. Use harmless sample
files and do not attach them to live client requirements.

1. Open a requirement in an Application, Claim or Travel workflow. `Choose file` opens
   `Upload from device` / authorized `From email attachments`, with the destination visible.
2. Upload a PDF/image and an Excel workbook. Confirm receipt only after `Use for this requirement`.
   The selected row becomes Received; an existing Verified row stays Verified. Other rows and
   business statuses must not change. A file over 1 MB must work through direct signed Storage
   upload; the limit is 25 MB. Ordinary non-checklist document upload still works separately.
3. Select a previously filed email original. Inspect sender/date/source record and existing
   uses. Reuse for another record of the same client requires acknowledgement, leaves the first
   filing intact, and creates no second inbound-email communication.
4. Preview PDF/JPG/PNG. Download other formats as unchanged originals, never an external viewer.
   Already-stored files remain available without a working Gmail connection. An unavailable
   unfiled provider original must show an error, not a fabricated file or successful receipt.
5. Confirm the same email/requirement twice: no duplicate association/document. As Admin, remove
   one association and verify another record's download and original filing still work.
6. Check real role boundaries: Staff can file released same-client email; Agent can upload to
   owned records but cannot file Gmail attachments. Foreign-client IDs and anonymous preview
   requests must fail server-side. Persona preview does not substitute for these sessions.
7. Create Health, BC Flexi and Travel records with staged selections. A new trip must not inherit
   an older file without explicit selection. Same-name people must retain separate destinations;
   changing client/person/roster/trip clears incompatible choices. Draft saves must not claim
   selected files were saved. Retained draft checklist rows use their actual persisted IDs.
8. Verify Application/Claim submission ZIPs and document downloads contain the attached originals.
   Test keyboard focus, Escape/backdrop closure and preservation of unsaved workflow fields.

Recorded verification: 250 tests, lint with no errors, production build/TypeScript, 18 SQL/Storage
and 17 authenticated HTTP scenarios passed. Visual/keyboard browser checks were **not performed**
in this implementation run, at the owner's request. See
[the evidence and boundaries](docs/development-alignment.md#shared-requirement-attachment-picker-2026-11-03).


## October 7 onward: feature inventory

Coverage is **inclusive of the October 7 batch**, from `8682f38` through `cc6746b`
(`8682f38^..cc6746b`), rather than only changes after the last October 7 documentation commit.

| Commit | What changed | Manual checks below |
| :--- | :--- | :--- |
| `8682f38` | Shared Pacific Cross submission composer, checklist-files ZIP, copied email text and logged submission history | B |
| `9559ac1` | Application billing/payment creation, carrier replies/proposal, linked policy logging and Policyholder conversion | A, C, D |
| `bf5ba22` | Same Verify payment and Log policy copy forms reused inside and outside the application workflow | C, D |
| `aef25a5` | Five-step application workflow modal, derived progress, locked rail and resume | A–D |
| `44d9cff` | Three-step claim workflow modal replacing the separate File claim sidebar | B, E |
| `95078c6` | Recorded workflow decisions and Pacific Cross reply/proposal/service-invoice assumptions; documentation, not another delivery integration | Limits |
| `7ca0236` | Policy-driven renewal creation/date refresh, Admin backfill and separate notice-received date; Blue Royale requirements verification recorded | F, G, J |
| `cc6746b` | Four configurable renewal rules/templates, atomic task/draft queue, staff review and protected daily cron | G–I |

### Setup and safe test data

1. Use an **isolated QA/staging database** with migrations through `0048` and the active product,
   requirement-template and officer-contact data. A local web server can still point at production:
   check `.env.local` before creating records or changing rules.
2. With the Supabase values configured from [.env.example](.env.example), run:

   ```bash
   npm ci
   npm run dev
   ```

   Open `http://localhost:3000` and sign in. If you run on another port, change the URLs below.
3. Have real **Admin**, **Staff** and **Agent** accounts available for role checks. The persona
   preview switch is not a substitute for testing server authorization with separate sessions.
4. Create uniquely named contacts such as `QA OCT7 <run-id>`, with a test email, and record their
   client/application/claim/policy references. Use small, non-sensitive PDFs and a proof-of-payment
   image. Use a separate contact for each application happy path: proposal lookup is client-wide.
5. Use whole-peso amounts, for example `12000`, for the main billing/policy smoke path. See the
   fractional-premium limitation below. Remove passwords from carrier PDFs before uploading them.
6. **No email is delivered by the CRM.** Submission/billing “sent” buttons are manual logs; renewal
   **Log email** is also logging-only. Do not send test packages to real carrier inboxes.
7. **Sync policies**, **Queue due now** and the cron evaluate eligible records across the database,
   not just the row you are viewing. Back up any rule settings you change and restore them after
   testing. Use fresh renewal cycles for independent queue tests: dismissed/logged pairs are not
   automatically re-created.

### A. Five-step application workflow and requirements

**Made:** one modal with **Requirements → Email Pacific Cross → Pacific Cross reply → Payment →
Log policy copy**. Progress is calculated from persisted records, not a manually saved step number.

1. Complete an individual health **New Insurance Application**, not an Inquiry Only/Lead or draft,
   using the QA contact. The workflow opens after creation. Alternatively, go to **Applications →
   Requirements** on that specific row; from the contact's application card use **View requirements**.
2. Confirm the five named steps and “Step N of 5” header. Later steps are locked until their
   prerequisites exist; hovering a locked step explains why. On narrow screens, use the footer
   **Back / Continue** controls; the side rail is hidden below 800 px.
3. In **Requirements**, leave one required item **Pending** or **Incomplete**: **Continue** stays
   disabled. Upload a file to an item: its status becomes **Received** after reload.
4. Mark all required items **Received** or **Verified**. **Continue** now works. The “Verified
   package” percentage counts only **Verified**, so it need not be 100% when every item is Received.
   Optional items do not block progress unless **Count as required** is selected.
5. With a required item outstanding, try **Request missing documents**. It logs a follow-up without
   delivering email. A contact without email gets an actionable error instead of a successful log.
6. Close and reopen the workflow: statuses/files remain. A saved Lead/draft instead uses
   **Continue application** to reopen the creation wizard; it is not a completed checklist.
7. Continue through B–D. Reopen after submission, payment verification and policy logging: the
   workflow resumes from the furthest recorded progress. Reviewing an earlier step must not erase
   later records or silently submit, verify or create a policy.

### B. Shared “Email Pacific Cross” submission, ZIP and history

**Made:** the same composer for application step 2 and claim step 3. Actual button text is
**Mark as sent**, although some planning notes call the action “Mark as submitted”.

1. Finish the required checklist items as in A or E, with at least one real uploaded file. Open
   **Email Pacific Cross**. Application recipients come from **New Business**; claim recipients
   come from **Claims / Claims and Customer Service**. Only Active contacts with email are offered.
2. Confirm the recipient, reference/product or claim details, editable **Subject** and **Message**,
   and the numbered documents list. Required items and optional items with files are included.
3. Inspect **Attachments**. An item marked Received without a stored upload is explicitly shown
   as missing a file / “to follow”; it is not fabricated as an attachment. A paper/manual receipt
   can satisfy checklist status without supplying a downloadable file.
4. Click **Download all (ZIP)** and open the download. It contains the uploaded checklist files,
   with numbered document/original-file names. The archive name includes the record reference and
   client name. With no uploaded files, the download control is disabled.
5. Edit the subject/message, then click **Copy email text**. Paste into a local text editor:
   recipient, edited subject and body must match. Copying or downloading alone creates no
   submitted status or outbound communication.
6. For an actual business submission, staff sends the email and ZIP from their own mailbox.
   **For QA, do not email the carrier**; simulate that external step and click **Mark as sent**.
   Expect a logged communication with the edited copy and selected officer, plus:
   - Application: **Submitted to Pacific Cross** and `date_submitted`.
   - Claim: **Submitted** and `claim_submitted_date`.
   - Both: `communications.delivery_status = logged`, not proof of provider delivery.
7. Reopen: a read-only submission record shows sender, recipient, subject/body and date. Choose
   **Resubmit** and make a second QA log: history gains an earlier-send entry, while the original
   submitted date remains unchanged. Unlike renewal queue retries, an intentional resubmission is
   a new communication.
8. Negative checks on a fresh/unsubmitted record: an outstanding required item, blank subject or
   message, or no valid department contact blocks marking as sent. Signing out and requesting the
   ZIP URL redirects to login. Broken storage-file downloads are a known limitation, not a
   passing “missing files handled gracefully” case.

### C. Application replies, billing and payment verification

**Made:** manual carrier-reply logging, extra checklist requests, billing creation and an inline
version of the existing Verify payment form.

1. After application submission, step 3 **Pacific Cross reply** is available; Payment stays locked
   while the illustrative proposal is absent or required client items remain outstanding.
2. Upload the carrier's **Illustrative proposal (final billing)** PDF. Confirm it is on file and
   opens. It is stored as `Illustrative Proposal`; older proposal documents are marked Replaced.
3. Log **Conforme to sign**, selecting CAC and/or TAL. Existing matching rows become required and
   Pending, or new required rows are added. Log **More requirements** with one item per line and
   check those rows too; new rows are marked **Requested by Pacific Cross**.
4. Confirm an **Inbound** “Pacific Cross reply” entry with the received date. A **Note** reply adds
   history without adding checklist items. Empty conforme selections, requirement text or Note
   cannot be logged as a complete reply.
5. Use **Open the checklist**, upload/update the requested rows to Received/Verified, then resubmit
   if needed. Once a proposal is on file and no required items are outstanding, **Continue**
   unlocks Payment. The current added-requirements status is **Pending Requirements**; see Limits.
6. In **Payment**, enter the **Premium billed by Pacific Cross** and click **Create payment
   request**. Expect one linked payment with status **Awaiting**, visible under Payments, and
   application status **Awaiting Payment**. Blank/zero amounts cannot create a valid request.
7. Correct the amount while Awaiting using **Update amount**: the existing payment/reference is
   updated, not replaced by another payment. Creation does not generate an installment schedule.
8. In **Billing sent to client**, inspect/copy the instructions and **Mark as sent**. It records a
   separate billing communication; nothing is delivered and the payment is not Verified.
9. In the inline Verify form, attach a proof image/PDF, choose the payment method and save
   **Payment status = Received**. Proof persists; payment becomes Received, but the application is
   not Approved and the contact is not converted to Policyholder.
10. Choose **Verified**: **Service invoice no. (OR)** is required. With proof and a QA invoice
    number, click **Verify & record invoice**. Payment becomes **Verified**, application becomes
    **Approved**, and the existing commission/voucher-follow-up flow runs. Step 5 unlocks.
    **The contact must still not become Policyholder from verification alone.**
11. On a second QA application, verify its payment from **Payments → Verify** instead. The same
    proof/invoice requirements and persisted effects apply; reopening its application reaches
    Log policy copy. Missing proof or a missing OR on Verified must block saving.

### D. Application-linked versus standalone Log policy copy

**Made:** the shared policy-copy form closes an application and converts its contact only when
opened from that application's final workflow step.

1. After C, open step 5 **Log policy copy**. The application contact is locked; product/plan,
   premium and payment mode are prefilled. Check them against the carrier copy.
2. Enter a QA Pacific Cross policy number and effective date. With expiry blank, an expiry is
   suggested at one year minus one day; a manually entered expiry must not be overwritten.
   PDF upload is optional, not a mandatory gate.
3. Optionally attach a small Policy Copy PDF, then click **Log policy & convert**. Confirm the
   success summary and **Open client profile** link. The policy appears in Policies.
4. Check persistence: the application links the policy and issued date; the verified payment links
   that same policy; its OR is copied onto the policy; the contact's lifecycle is **Policyholder**.
   An uploaded PDF is available as **Policy Copy** on the contact/policy.
5. Close and reopen: a policy summary replaces the creation form. It must not invite a second
   policy for that same application. All five workflow stages are complete.
6. On a different QA contact still at Applicant, use **Policies → Log policy copy**. The standalone
   form has a client picker and **Log policy copy** button. Saving files a policy but does **not**
   close/link an application or convert the contact to Policyholder. Both policy-creation paths can
   create an eligible renewal; test that separately in F.

### E. Three-step claim workflow

**Made:** **Claim details → Requirements → Email Pacific Cross** in one modal, used both for a new
claim and the existing claim's Requirements action.

1. Go to **Claims → File claim**. Confirm the three steps; later steps are locked before filing.
   Pick a QA claimant and inspect the linked-policy choice, claim type, checklist preview and
   intake fields. Switching claimant must reset the previously selected policy.
2. Record incident date, whole-peso amount, **How it arrived** and **Documents received**. Click
   **File claim**: one claim is saved and the same modal advances to its generated checklist.
   Canceling before filing must not create a claim.
3. Close and reopen via that claim's **Requirements** button. Claimant/type/policy details persist;
   the existing claim's intake fields remain editable in step 1 and survive reload.
4. In step 2, test Pending/Incomplete blocking and Received/Verified progression as in A. Uploads
   change the linked requirement to Received; verified percentage and optional rows stay distinct.
5. On a fresh claim whose rows are all Pending, use **Change claim type** and check that the
   matching checklist replaces the initial one. After any row leaves Pending, type change is
   locked. ER/Reimbursement variants are explicitly interim mappings, not newly approved lists.
6. If filing succeeded but template generation failed, the claim remains saved and a warning plus
   **Generate checklist** appears. Repair the staging template, generate, and reopen: do not file
   another claim to recover. Claim creation/checklist generation are not one atomic transaction.
7. Once required items are Received/Verified, continue to step 3 and run B for a claim. Reopening
   the submitted claim shows the logged submission/history rather than starting another claim.
8. A Travel claim has no generated medical checklist; follow the TravelSafe NOC/manual path.
   This workflow does not add a claim reply, approval, rejection or payout step.

### F. Policy-driven renewal creation, source refresh and Admin backfill

**Made:** one open renewal cycle per eligible policy; renewal date takes precedence over expiry.

1. As Admin, use **Policies → Log policy copy** for a QA health policy with an expiry at least
   120 days ahead. Open **Renewals** and find its policy/client: one Upcoming renewal is created
   automatically, with the policy expiry as its due-date fallback.
2. Open the QA contact's **Policies** card → its **Edit** button. Set **Renewal date** to a different
   future date and save. The existing renewal/reference remains; its due date follows renewal date,
   even when expiry differs. Leave renewal date blank to check the non-Travel expiry fallback.
3. Edit source dates again and use **Renewals → Sync policies** twice. The same open renewal is
   refreshed/unchanged; no duplicate open row is created. Existing receipt/workflow fields remain.
   The counts/toast reflect the whole staging database, not only your QA policy.
4. An Active policy without either source date creates no renewal. A Travel-category policy does
   not use trip expiry as an annual renewal: only an explicit Renewal date makes it eligible.
   An inactive policy must not create a new cycle merely because Sync policies is run.
5. As a real Staff account, **Sync policies** is absent; a replayed Admin sync action must be
   rejected server-side. Simply visiting Renewals must not backfill existing policies.
6. Advanced staging fixture: close a QA cycle as **Paid**, **Renewed** or **Lapsed** in the data
   editor, scoped to its exact ID. Sync the unchanged term: that historical cycle is not recreated.
   Move the policy's renewal date to a new term: a new open cycle may be created without changing
   the closed cycle. There is no new “close cycle” UI in this slice; do not invent one for this test.

### G. Notice receipt, rule settings and timing boundaries

**Made:** a receipt date distinct from outbound notice date, plus four rule/template defaults.
Here **D** means today's **Asia/Manila calendar date**; offsets use calendar days.

| Rule | Default base / offset | Condition |
| :--- | :--- | :--- |
| Client notice receipt | Notice received date / `0` | Queue immediately on a receipt dated today/past |
| Client renewal reminder | Renewal due date / `-30` | Eligible open renewal; early-payer clients skip it |
| Carrier notice request | Renewal due date / `-60` | No notice receipt recorded |
| Carrier premium breakdown request | Renewal due date / `-60` | Every eligible renewal, regardless of premium increase or notice arrival |

1. As Admin, open **Settings → Notifications**. Check all four rule forms, signed offsets, date
   basis, active flag, Email template and fixed client/carrier recipient type. Carrier contacts
   come from the directory; the initial defaults use the existing **Thea Opura** record, not a new
   duplicate. Verify recipients before any real use.
2. Change and **Save rule**, reload, and confirm persistence; restore the original afterward.
   Receipt stays on notice-received date with offset 0. Missing notice stays on renewal due date.
   Only Active Email templates and Active carrier contacts with email are valid selections.
3. Open **Email Templates** and inspect the four new renewal templates. Preview/rendered drafts
   must resolve policy number, renewal/receipt dates, client and recipient names. The older manual
   “Renewal reminder” was not overwritten. A renewal premium is not inferred from last year's
   policy premium; review the current carrier billing instead.
4. Use a fresh QA policy/cycle with no receipt and the defaults restored. Set Renewal date to
   **D+61** and click **Queue due now**: no task/draft for that fixture is due.
5. Move it to **D+60** and queue: only the two carrier rules are due. Move to **D+30** and queue:
   the client reminder also becomes due. Date updates may already invoke the queue transactionally;
   do not count an already-created pair as a duplicate caused by the explicit run.
6. On its Renewals row, click **Mark notice received**. Save today's date. The column persists,
   Upcoming becomes **Notice Received**, and the client receipt task/draft appears immediately,
   without waiting for cron. The pending missing-notice draft is Dismissed and its task Cancelled;
   the premium-breakdown rule is unaffected by receipt.
7. **Edit receipt date** and save the same value: no duplicate activity, audit or task/draft pair.
   Cancel makes no change. Clear the date: save is disabled. Invalid dates must fail calendar
   validation. Changing receipt on a later workflow status must not regress that status.
8. Re-run the queue: at most one stored pair per renewal/rule. Existing pending dates/context may
   refresh, but staff-edited copy and recipient/template snapshots remain; Logged/Dismissed pairs
   stay historical. A fresh cycle, not a repeated run, is needed to queue those rules anew.
9. Advanced staging fixtures, each isolated: disable a rule, mark a carrier contact/template
   inactive, use an inactive policy, mark the client Lost/Archived/do-not-contact, or close the
   renewal as Paid/Renewed/Lapsed. Run the queue: no new ineligible work; pending work is dismissed
   and its open task cancelled. Early payer suppresses the client reminder, not informational
   receipt. Restore shared settings, but use fresh cycles rather than expecting dismissed work
   to resurrect.

### H. Review, edit, log and dismiss renewal drafts

1. Open **Tasks** or the dashboard's **My tasks**. On a generated renewal task click **Open draft**:
   it opens the linked persisted draft without toggling the task checkbox.
2. Check **To email**, **Subject**, **Body** and the no-delivery notice. Edit and **Save draft**,
   close/reopen: edits remain. No communication or renewal-status advancement occurs from saving.
   A missing recipient must be supplied before saving/logging; blank subject/body also block it.
3. In two tabs open the same draft. Save tab A, then save an edit from stale tab B: B gets a
   “draft changed” error and retains its local text. **Reload draft** discards that local edit and
   loads the saved revision; it must not silently overwrite A.
4. With browser network throttling, start a save: action buttons/close are disabled and Escape
   cannot dismiss the pending form. Simulate a dropped request: show an error and keep edits;
   restore connectivity and reload to determine saved state before retrying.
5. Click **Log email** on an eligible draft. It saves the edited copy, records exactly one
   `delivery_status = logged` communication and completes the linked task in one transaction.
   The draft becomes read-only **Logged / View draft**. **Nothing is delivered and the renewal
   does not advance.** A retry of the same committed log must not create another communication.
6. On another draft choose **Dismiss draft**: draft becomes read-only Dismissed, its open task is
   Cancelled, and no email is logged. Re-running the queue must not re-create that pair.
7. On an unlogged draft's task, click only its checkbox: it changes task completion, not email
   logging. It remains separate from the explicit Log email action.
8. Use actual roles: Admin edits/runs rules and reviews drafts; Staff sees read-only Notifications
   with no **Queue due now**, but can review/save/log/dismiss drafts; Agent has no Notifications
   tab/rule payload or Open/View draft controls. Direct replayed Agent read/save/log/dismiss actions
   must also be denied. These renewal-specific checks do not prove global claim/submission ACLs.

### I. Daily cron: local HTTP checks and production boundary

1. On staging/local only, start without a configured `CRON_SECRET` in either the server environment
   or `.env.local`. `curl -i http://localhost:3000/api/cron/renewals` must return **503**, not a
   successful anonymous run or a login-page response.
2. Stop the server. In a server terminal, use this **local-only dummy secret**, never in production:

   ```bash
   CRON_SECRET=qa-local-only-not-for-production npm run dev
   ```

3. In another terminal run:

   ```bash
   curl -i http://localhost:3000/api/cron/renewals
   curl -i -H 'Authorization: Bearer wrong-secret' http://localhost:3000/api/cron/renewals
   curl -i -H 'Authorization: Bearer qa-local-only-not-for-production' http://localhost:3000/api/cron/renewals
   ```

   Expect **401**, **401**, then **200** with `queued`, `refreshed`, `dismissed`, `unchanged`
   counts. Run the authorized request again: unchanged source data must not create duplicate pairs.
4. Without login, request `/api/cron/renewals/not-a-cron`: it must still redirect to login. Only
   the exact cron endpoint bypasses the session proxy; it authenticates its own Bearer secret.
5. Production is a separate release step: configure a strong server-only `CRON_SECRET` in Vercel
   Production, then deploy. [vercel.json](vercel.json) preserves `sin1` and schedules **00:00 UTC /
   08:00 Manila daily**. A committed schedule or successful local curl does not prove deployment.

### J. Blue Royale requirements: verification, not a speculative fix

1. In a fresh health application, choose Blue Royale and inspect the preview and persisted
   checklist: use the health requirements, not BC Flexi's corporate/HMO two-phase list.
2. Compare face-to-face versus remote, beneficiary and pre-existing-condition inputs. Conditional
   health documents should follow the selected answers. TAL/CAC may be combined in preview while
   remaining separate optional stored rows.
3. Switch BC Flexi to Blue Royale before saving: corporate requirements disappear. Save a QA
   draft, resume, complete it, and inspect the resulting Blue Royale checklist.
4. The alleged HMO-list bug was not reproduced in the recorded verification. No new standalone
   “medical review” stage or alternative Blue Royale checklist was added by these commits.

### Limits and findings to keep visible

- No real email delivery, inbox polling/auto-detection or automatic carrier acceptance exists.
  Claims end at submitted; application replies are manual. Renewal automation is only four
  Email draft/task cases, not WhatsApp, installment, payment or missing-document automation.
- Reply logging, the illustrative-proposal document interpretation and OR = service-invoice
  interpretation remain business assumptions pending confirmation; see
  [the alignment register](docs/development-alignment.md#submit-to-pacific-cross-2026-10-07).
- **Known status mismatch:** application replies that add requirements write `Pending Requirements`,
  while other filters/counts use `Missing Requirements`. Check the individual record; do not mark
  a missing filter/count entry as a passing regression test.
- **Proposal scope:** the newest illustrative proposal is looked up by client, not strictly by
  application. Multiple applications for one client need a separate isolation test; do not treat
  another application's proposal satisfying the gate as proof of correct per-application linkage.
- **Fractional policy premium:** the policy-copy form strips decimal separators before saving.
  Whole-peso examples avoid corrupting the happy-path fixture, but centavo preservation is a known
  failing edge to report, not an assertion that monetary precision is supported.
- **ZIP failures:** a missing stored object currently throws a server error, not a friendly
  missing-file recovery. Downloading a ZIP alone is not gated on checklist completeness and does
  not attach a snapshot archive to the communication.
- **Permissions:** claim/submission actions and ZIP currently check login, not a complete
  role/record-ownership ACL. The Admin/Staff/Agent assertions above apply to the renewal additions;
  least-privilege tests for the other workflows must record that gap rather than assume denial.
- Carrier PDFs are not automatically decrypted. ER/Reimbursement checklist mappings are interim,
  and a Travel claim has no generated medical checklist. None of these commits completes a
  claim approval/payout or an installment-notice engine.

### Automated checks, evidence and test-run notes

```bash
npm test
npx next typegen && npx tsc --noEmit
```

Relevant regression suites:
[application workflow](lib/applications/workflow.test.ts),
[claim workflow](lib/claims/workflow.test.ts),
[submission email/ZIP naming](lib/submissions/submission-email.test.ts),
[receipt validation](lib/renewals/notice-receipt.test.ts), and
[template merge](lib/templates/merge.test.ts).
These do not replace the browser, storage, database, role or HTTP checks above.

**Recorded October 10 verification:** 8 files / 58 tests and typecheck passed; actual renewal UI
and role checks, rollback SQL timing/state boundaries, eight concurrent queue calls (3 new pairs,
21 unchanged outcomes), and cron 503/401/200/repeat checks passed. That is historical evidence, not
an assertion that this entire guide or a production deployment was rerun today.

For each new run, record date/environment, commit, role, QA record references, steps exercised,
expected versus actual result and screenshots/errors. Restore edited rule settings and remove
only your owned QA data/files; never clear customer records, reset counters or run broad deletes.

## Earlier manual checks

The remainder is preserved from the pre-October-7 guide. Its old demo names, screenshots, labels
and verification claims are historical; do not assume those seed records still exist. Prefer the
dated checks above where behavior overlaps.


> **Heads-up:** commit `6f6b205`'s message says "add empty-state hints" but its actual diff is
> proposal-button loading states — the real empty-state-hint code lives in merge commit `392951e`
> ("polish-loading-states...") instead. Messages and diffs got swapped somewhere in the merge
> process. Sections below are grouped by what the code *actually* does, not by the (mislabeled)
> commit message.

---

## ✅️ Lead filter menu (`6d08967`)

1. Go to **Prospects** (Board view).
2. Click the new **filter icon** (funnel) next to the view tabs/search.
3. In the popover: check 2+ **Status** boxes (e.g. New, Attempted) — board updates live, showing only matching leads; header count changes to "`X of Y`".
4. Check a **Product interest** box — combines with status (AND logic).
5. Check **Overdue only** — only leads with a past-due follow-up remain.
6. Confirm the filter badge on the funnel icon shows the active-filter count.
7. With filters active, switch to **List** and **Forecast** tabs — confirm the same filtered set carries over (funnel/list/board all reflect it).
8. Click **Clear all** in the popover — everything resets, full lead count returns.
9. Apply filters that match nothing — confirm the "No leads match these filters" empty-state message appears on the board.

---

## ✅️ Advance Lead popup — redesign + info-icon fixes (`6de9322`, `b343b70`)

1. On a lead, trigger an advance suggestion (e.g. log an email/brochure send, or a Reached call, or an inbound message) so the popup opens with a preset.
2. Confirm the popup shows **two identity cards** (avatar, name/ref, separate Stage + Status badges) connected by a **down-arrow**, instead of a one-line sentence.
3. If the suggestion came from an email/brochure send or a call/message, confirm the small **info icon** sits directly **beside the arrow** (not in the header row above it) — hover or click it to reveal the trigger detail (e.g. "Send brochure: <asset name>", "Outcome: Reached", "Channel: SMS") and timestamp.
4. Confirm the tooltip renders **fully visible**, not clipped at the modal's edge, and that opening it does **not** make the modal scroll horizontally.
5. Confirm the icon is comfortably clickable/hoverable (22px target) — not a pixel-hunt.
6. Confirm the **follow-up date** below the diagram is human-phrased ("Tomorrow", "in 3 days", etc.) rather than raw ISO.
7. Open **Adjust details** — confirm the outcome/follow-up summary line under the diagram hides while the editable fields are open (no duplicate info).
8. Verify the **"before" status badge** matches the lead's status *prior to* this event — not the already-updated one (previously the "before" card could show the new status because `updateLeadStatus` writes before the popup opens).

---

## ✅️ Mark Lost moved out of Advance popup, into its own modal (`f1b4c69`)

1. Open the Advance Lead popup on any lead — confirm there's **no "Mark Lost" toggle** in it anymore (it's a pure advance/confirm flow now).
2. Go to a lead's Contact Profile, click the **⋮ menu** — confirm **"Mark Lost"** now appears there, directly above **Delete**, styled in red.
3. Click it — a dedicated **Mark Lost modal** opens (red X icon, optional note field).
4. Submit — confirm the lead moves to lifecycle `Lost`, a toast confirms it, and it's archived from active queues (check it drops off the Prospects board).

---

## ⚠️4. Empty-state hints on Dependents/Timeline/Documents (in `392951e`, despite its "polish-loading-states" message)

1. Open a **freshly created lead** with no dependents, no communications, and no documents.
2. **Dependents card:** confirm it shows *"No dependents added yet."* instead of a bare `0` count.
3. **Documents card:** confirm *"No documents uploaded yet."*
4. **Timeline card:** with zero total activity, confirm the more specific *"No calls logged yet — log the first touch."* (falls back to the generic "Nothing here yet." only when there's history but the current filter tab has nothing).

## Change:

- Hide all input fields, upload file box, etc. and they would be visible only after pressing a button "Add dependents" or "Add Document" or a simple "+" icon at the top right of the container.

---

## ✅️5. Loading states on proposal buttons (in `6f6b205`, despite its "empty-state hints" message)

1. On a lead with `proposalStatus = Requested`, click **Mark Received** — confirm the button disables and its label flips to **"Marking received…"** while the request is in flight.
2. On `Received`, click **Mark Sent** → label flips to **"Marking sent…"**.
3. On `Sent`, click **Record decision** → label flips to **"Recording…"**.
4. Confirm only the clicked button shows the pending label (the others stay normal, since `proposalMarking` tracks which one was clicked).

---

## ✅️6. Board header quick actions — fully removed (`995ddad`, `89ea6da`)

Two rounds: `995ddad` removed the redundant Send Brochure/Send Intake Form buttons; `89ea6da` later
removed the remaining Request Proposal/Generate Proposal/Log Call buttons too, since all three
needed a lead in scope anyway.

1. Go to **Prospects** board header. Confirm it now shows **only "New Lead"** plus the
oard/List/Forecast view toggles and the filter icon — no Send Brochure, Send Intake Form,
equest Proposal, Generate Proposal, or Log Call buttons.
2. Open any lead's Contact Profile — confirm all of those actions are still reachable there:
*Send Brochure/**Send Intake Form** via the composer's template dropdown, and
Generate/Request Proposal* + **Log Call** via the nurture chip row — nothing lost, just
onsolidated onto the profile where a lead is already in scope.
3. Open a lead already in the **Proposal** stage — confirm the board's **Proposal tracking** widget
till shows its own per-lead **Generate Proposal** button where applicable (a different,
lready-lead-scoped call site, untouched by this change).

---

## ✅️7. Unresponsive inference + gated Mark Lost (`ab0d758`)

1. Find (or set up) a lead in status **Attempted** or **Nurturing** with **3 outbound communications logged with no inbound reply and no "Reached" call** in between (e.g. log 3 outbound emails/calls via the composer without any inbound response).
2. Reload the Prospects board / that lead's Contact Profile — confirm the status badge now reads **Unresponsive**, even though nothing was manually set (this is computed live on read, never stored).
3. On that Unresponsive lead's Contact Profile, open the **⋮ menu** — confirm **"Mark Lost" now appears** (it's hidden for any other status).
4. On a **different** lead that is *not* Unresponsive (e.g. still New/Attempted with &lt; 3 unanswered touches, or Connected/Qualified), open ⋮ — confirm **"Mark Lost" is hidden**.
5. Log an **inbound reply** or a **Reached call** on the Unresponsive lead — reload — confirm the status reverts to its real stored value (e.g. back to Attempted) and Mark Lost disappears again from the menu.
6. Sanity check the Advance popup on an Unresponsive lead still opens/works normally (status resolves to the lead's real stored status under the hood, not the literal string "Unresponsive").

---

## ✅️8. Proposal actions scoped to the Proposal stage (`180d9e9`)

Bug this closes: the Contact Profile's Proposal card showed live "Mark Received" / "Mark Sent" /
"Record decision" buttons based only on `proposalStatus`, with no check that the lead was actually
in the `Proposal` stage — so a lead that drifted to a later stage while still carrying a stale
`proposalStatus` (real case: **Carla Mendez**, `Product Selected` stage + `proposalStatus=Requested`)
could have its proposal state advanced out of sequence.

1. Go to **Prospects → List** (or search), open **Carla Mendez**'s Contact Profile
she's at `Product Selected`, not `Proposal`, but still carries a `Requested` proposal status —
he exact case this fix targets).
2. In the **Proposal tracking** card, confirm:
  - The status line still shows: *"Proposal requested — Blue Royale quote."* (informational,
   always visible regardless of stage).
  - The **Open Pacific Cross portal** link still shows (also stage-independent).
  - **No action button** renders (no "Mark Received", no "Generate/Request proposal").
  - A new note appears: *"Proposal actions are available once this lead reaches the **Proposal**
  stage."*
3. Compare against a lead actually **in** the `Proposal` stage (e.g. **Marco Cua** or **Grace Tan**
n the board) — confirm the normal action buttons (Mark Received / Mark Sent / Record decision)
*do** render there, unaffected by this change.
4. Sanity check the two surfaces that were already correct and untouched by this fix: the
/prospects` board-card chip and the **Proposal tracking** board widget — both should still only
ver show Proposal-stage leads, same as before.

---

## ✅️ 9. Convert-wizard prefills date of birth (`48ea43b`)

What this adds: converting a lead to an application now carries the lead's date of birth into the
wizard, instead of dropping it and leaving `f.dob` empty for every single conversion (which broke
any age-band-dependent logic downstream, e.g. carrier-form/age-71+ matching).

**Important UX note before testing:** the wizard's Step 2 "Date of birth" *input field* is
intentionally **hidden** for Convert flows (`lockIdentity` — the identity fields are locked to the
existing client record, not re-collected). So you will **not** see a filled-in DOB box on Step 2 —
that's expected, not a bug. What you're actually verifying is that the value is present
*internally* and flows into age-dependent behavior later in the wizard (Step 3+ for health/travel
products) rather than being silently blank.

1. Pick a lead/client that **has** a date of birth on file (check their Contact Profile → Contact properties → "Date of birth"). Most of the original demo leads don't have one seeded — the QA test records do (e.g. **Diagram Testcase**, DOB Jan 15, 1990).
2. On their Contact Profile, either:
  - Click the primary **Convert to Application** button if the lead is `Product Selected`+ with no
   existing draft, or
  - Open the **⋮ menu → Convert to Application…** → confirm **Convert anyway** on the skip dialog
  if the lead is earlier than `Product Selected`.
3. The wizard opens on Step 1. Confirm Step 2 does **not** show a raw "Date of birth" input (this
s correct — identity is locked for converts).
4. Continue to a **health or travel** product category in Step 1/3, where age-band matching applies (e.g. Select / Blue Royale carrier-form selection, or Travel age-based plan options). Confirm the engage-dependent behavior reflects the lead's real age (computed from their real DOB) rather than behaving as if DOB were blank — e.g. the correct age-band carrier form gets matched, or an age-71+-specific form/questionnaire triggers correctly for an applicant actually over 71.
5. If you want to confirm the raw value directly instead of via downstream behavior, open browser
evTools while the wizard is open and inspect the `NewApplicationWizard` component's `f` state
React DevTools → Components → search "NewApplicationWizard" → hooks → the `WizardForm` state) —
dob` should match the client's real date of birth, not be empty.
6. Cancel out of the wizard (or just navigate away) — **do not** click Create/Save draft unless you
ntend to leave a real draft application behind for this test lead.

---

## ✅️10. Product-dropdown placeholder no longer collides with the "Select" product (`03d8843`)

Bug this closes: every product picker's empty-state placeholder read **"Select…"**, sitting directly
next to the actual product literally named **"Select"** — easy to misread or misclick.

1. Open **New Lead** (Prospects board → New Lead button) and open the **Product interest** dropdown.
onfirm the placeholder now reads **"Choose a product…"**, followed by `Blue Royale`, `Select`,
Travel Insurance`, etc. — clearly distinct from the real "Select" option.
2. Open the **New Application wizard** (New application, top nav) → Step 1 → **Product** dropdown —
ame fix, same "Choose a product…" placeholder.
3. Open **Issue Policy** (wherever it's triggered in Applications/Renewals) → **Product** dropdown —
ame fix.
4. Sanity check other `Select…` dropdowns you encounter (Application type, Source, Plan option,
overage type, Email template) are **unchanged** — they don't have a colliding option value, so
hey were intentionally left alone.

---

## ✅️11. Direct-edit for discovery fields — product interest, budget, family size, coverage tier (`551adb2`)

Bug this closes: these four fields were shown on the Contact Profile's "Contact properties" panel
but could only be **written** by logging a call (Reached outcome). If Eman forgot to capture one at
intake, there was no fix short of faking a phone call.

1. Find a lead missing one of the four fields (Contact Profile → Contact properties will show `—`
or whichever is unset).
2. Open **⋮ menu → Edit** on that lead.
3. Scroll to the new **"Discovery details"** section (below the existing identity fields, above the
ave/Cancel row). Confirm it's prefilled to match whatever's already on the Contact Properties
anel (or blank if unset).
4. Fill in the missing field(s):
  - **Product interest** — dropdown (same product list as New Lead/wizard, with the "Choose a
   product…" placeholder from #10 above).
  - **Budget / est. premium** — number input.
  - **Family size / dependents** — number input.
  - **Coverage tier / room** — dropdown (`Standard / Ward`, `Semi-private room`, `Private room`,
  `Suite / Executive`, same list Log Call uses).
5. Click **Save changes** — confirm it redirects back to the profile (preserving `?from=prospects`
f you came from the board).
6. Confirm the Contact Properties panel now shows the new value(s).
7. If this was the lead's *last* missing discovery field: open the **Advance** popup and confirm the
onfirm button now reads **"Accept suggestion"** rather than being blocked — proving the edit
lows into the existing discovery-gate check with no extra plumbing.

---

## ✅️12. Dashboard export to spreadsheet — .xlsx / .ods / .csv (`d0d8b54`)

Replaces the old stub Export button, which only fired a toast and generated nothing.

**What to expect:** the workbook has **no bold or coloured headers** and no frozen header row —
that's a SheetJS community-edition limitation, not a bug. Readability comes from column widths,
peso/date number formats, merged section titles and separate sheets.

1. Go to the **Dashboard**. Click **Export** in the top-right — a menu opens with three options:
Excel workbook .xlsx*, *OpenDocument .ods*, *Summary CSV .csv*.
2. Pick **Excel workbook**. Confirm a toast says "Preparing export" and a file downloads named
pacific-dashboard-YYYY-MM-DD.xlsx`.
3. Open it. Confirm **nine sheets**: Summary, Trends, Applications, Renewals, Claims, Travel, Tasks,
ouchpoints, Activity.
4. On **Summary**, confirm three labelled blocks separated by blank rows — `ALERTS`, `KEY METRICS`
with Change vs last month + Direction), `REVENUE AWAITING COLLECTION` — and that money reads as
*₱88,000.00**, not a bare number.
5. On **Applications**, confirm dates read as **2026-06-20** (not `20260803` or `06/20/26`), premiums
re peso-formatted, and the header row has an autofilter dropdown. Note it carries the full open
et (up to 500), not just the 5–6 rows the dashboard card shows — that's intended.
6. On **Trends**, confirm six month columns of numbers per KPI. Select the range and insert a chart
o confirm they're real numbers, not text.
7. Repeat step 2 with **OpenDocument .ods** and open it in LibreOffice. Confirm the same ₱ and date
ormatting survives — this is the format most likely to regress, since SheetJS's ODF writer
ilently drops unquoted literals in format strings.
8. Repeat with **Summary CSV**. Confirm it is a *single simple table* — header `Section,Metric,Value`
hen flat rows, no queue data, no merged titles. Open in Excel and confirm `₱` isn't mojibake
a UTF-8 BOM is emitted for exactly this reason).
9. **Failure path:** visit `/dashboard?exportError=1` directly. Confirm an "Export failed" toast
ppears and the URL cleans itself back to `/dashboard`.
10. **Bad input:** visit `/api/dashboard/export?format=pdf`. Confirm a plain-text 400 naming the
three valid formats. Log out and hit the route — confirm it redirects to `/login`.


---

## 15. Dependents and Documents entry forms collapse behind a "+"

Both cards used to render their entry forms unconditionally beneath the list, so a brand-new lead
showed two cards that were almost entirely input controls for records that didn't exist yet. The
forms are now hidden until asked for.

1. Open any lead's Contact Profile. On both the **Dependents** and **Documents** cards, confirm a
   **"+"** sits at the top-right of the card header and **no input fields are visible**.
2. Click the **"+"** on Dependents — the Full name / Relationship / Date-of-birth fields appear and
   the icon rotates 45° into an "×". Click again to hide.
3. Same on Documents — the file picker, name, type and visibility fields appear.
4. **Empty states stay visible in both states.** On a lead with nothing on file, *"No dependents
   added yet."* and *"No documents uploaded yet."* must show whether the form is open or closed —
   they sit above the collapsed region.
5. **File retention (the reason the form is hidden rather than unmounted):** open Documents, choose a
   file, collapse the form, re-expand it — the chosen filename must **still be there**. If it's gone,
   the form is being unmounted and a user could silently lose a selected file.
6. **Add flow:** with the Dependents form open, add one. It appears in the list, the empty-state line
   disappears, **the panel stays open**, and the fields clear — so a spouse and two children can be
   entered in a row without re-opening.

---

## 16. Convert-from-Lead: autofill fix, visible lead details, "Lead" not "client"

Three fixes to the Convert Lead → Application wizard.

> **Note on app type:** it defaults to **"Inquiry Only (Lead)"** on convert — deliberately. That
> derives `status = "Lead"`, so the server's `startsApplication` is false and **Create does not
> convert**: the record gains an application but stays a Lead, moving to `Application Started`.
> Change the type (or Step 6 status) to convert. The separate bug fixed here is that the default
> only applied when the product matched the catalog. See steps 1-2 and 7-8.

1. **Autofill, matched product.** Convert a lead whose product interest IS in the catalog (Blue
   Royale, Select, BC Flexi, FlexiShield, Travel Insurance). Step 1 shows **Application type =
   Inquiry Only (Lead)** and the **product pre-selected**.
2. **Autofill, unmatched product — the bug fix.** Convert a lead whose product interest is NOT a
   catalog product (`Premier Health`, `Family Shield` — 4 leads today). Previously Step 1 opened with
   *neither* app type nor product and no explanation. Now: app type still prefills, and an amber note
   reads *"This lead's product interest is **Premier Health**, which isn't in the product list — pick
   the closest match above."* — and the app type still defaults.
3. **Step 1 says "Lead".** The section is titled **Lead**, shows a "Converting" banner naming the
   lead, and the **New client / Existing client** chooser is gone — for a convert the record is fixed,
   so that control could never do anything. It still appears for every other flow.
4. **Step 2 — Lead details.** A **Lead details** panel sits under the banner, collapsed, with an
   **eye** toggle. Click **Show**: reference no., email, mobile and date of birth appear read-only,
   matching the lead record, plus an **"Edit the lead →"** link to `/clients/<id>/edit`.
   These are exactly the fields the wizard hides for converts (identity is locked to the lead), so
   this is the only place to see them without leaving the wizard.
5. **Step 6 says "Lead".** The first review card is titled **Lead**, not "Client".
6. **Honest banners.** With the default type, Step 1's banner reads *"Stays a Lead — an application
   is created against this record, nothing converts yet."* with a violet **Stays a Lead** pill, and
   Step 6 says *"…stays a Lead (application type is “Inquiry Only (Lead)”)"*. Change the type to
   **New Insurance Application** and both flip to the green **Converting** / *"Lead → Applicant
   conversion"* wording immediately.
7. **Default path — does NOT convert.** Complete the wizard with the default type (Step 1 Source,
   Step 3 Plan option + Coverage, then Create). In the database the contact must stay
   `lifecycle_stage = Lead` with **0** `lead.converted` entries, gain 1 application, move to
   `lead_stage = Application Started`, and carry a timeline entry reading *"Product Selected →
   Application Started (Inquiry Only (Lead) created — still a Lead)"*. That last part matters: before
   this change a completing non-converting save left the lead **completely untouched** — a live
   application attached with no stage move and no timeline entry at all.
8. **Converting path still works.** Same flow but change the app type to **New Insurance
   Application** first. The contact must become `lifecycle_stage = Applicant`,
   `lead_stage = Converted`, with 1 application and 1 `lead.converted` entry.
