# Development Alignment Register

Last reconciled: **2026-08-03**.

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
| Commissions | Standalone `/commissions` route plus Payments sub-tab, both using the shared commissions component/repository | Canonical navigation updated to match the delivered slice. |
| Pacific Cross officers | `external_contacts` repository and Settings interface | Aligned; production recipients still require human verification. |
| Application requirements | Persisted checklist records plus verified-only completeness on the Applications register | Aligned; filters/sorting distinguish Complete, In review, Missing, Draft, and Not initialized. |
| Carrier assets | `document_library` plus communication-version links from migration `0023` | Aligned; library starts empty until assets are redacted and approved. |
| Email and attachment delivery | `communications.delivery_status = logged`; selected document versions are recorded | Deliberate safety boundary: nothing is actually delivered without a provider. |
| Proposal `Sent` | Current composer can log the draft/action | Code gap: advance only after provider confirmation or explicit `Mark externally sent`. |

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

## Reconciliation checklist

When behavior changes, update all three layers deliberately:

1. Confirm the business rule in `../../docs/web/` and lifecycle source files.
2. Update code/migrations and tests.
3. Update this mapping and the build roadmap.
4. Search both repositories for superseded wording and broken links.
5. Commit changes inside each independent repository, never at the parent workspace.
