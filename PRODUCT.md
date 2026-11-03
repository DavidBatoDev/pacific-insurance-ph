# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — Eman Bondoc, Staff (Broker).** The daily operator. Works from a desktop browser
all day during office hours; mobile is incidental, not a work surface. She runs the whole
pipeline: leads, applications, policies, renewals, claims, travel, documents, tasks,
relationship events, templates. View-only on Products; cannot manage team, billing, or
payment channels; cannot hard-delete.

**Matt Nassr, Admin (Owner).** Full access — all records, settings, user and product
management, billing, payment channels. Uses the system less continuously than Eman.

**Future sales agents, Agent role.** Own records only — the leads, clients, and applications
where they are the assigned agent. No admin surfaces, no cross-agent visibility. Not yet
staffed; the permission model already accounts for them.

This is an internal operations tool for staff. It is not a client-facing portal, and no
end-customer ever logs in.

## Product Purpose

A centralized operations platform for a two-person insurance brokerage in the Philippines,
covering leads, clients, policies, applications, renewals, claims, documents, communications,
tasks, relationships, and Pacific Cross interactions in one place.

Success is Eman getting through a working day without dropping a lead, a renewal, or a
required document — and without leaving the tool to reconstruct where something stands.

## Positioning

The platform is designed around Matt and Eman's business processes, **not** Pacific Cross's
internal systems. Pacific Cross is modeled as an external partner whose products, forms,
contacts, pricing, and requirements are expected to change; the system must absorb those
changes through configuration rather than software redevelopment. A generic CRM cannot
truthfully claim this, and neither could a carrier-supplied tool.

## Operating Context

- **Desktop, sustained sessions.** The real usage scene is a browser open all day on a
  desktop or laptop. Design for long-session scanning, not for glanceable mobile snippets.
- **Moderate volume — low hundreds of active records.** Queues regularly hold more than fits
  on one screen, so prioritization and scanning matter; but this is not a thousands-of-rows
  dataset where raw density wins over clarity.
- **New business starts from referrals** and personal or business networks, then moves into
  informal discovery discussions before any form is submitted.
- **The two-axis lead model is central.** Lead Stage and Lead Status are separate axes, with a
  proposal micro-status tracked alongside. Canonical definitions live in
  `../docs/lead-stage-status.md` and `../docs/lead-stage-status-example.md`; any change to lead
  advancement or status must match them.
- **Per-product carrier requirements** (Select, Blue Royale, FlexiShield, BC Flexi, Travel,
  plus claims and pre-approvals) drive document checklists, including which party prepares a
  document and whose signature it needs. Sourced from the carrier's own written lists in
  `../docs/REQUIREMENTS.md`.

## Capabilities and Constraints

**Modules in the product:** Dashboard, Lead Lifecycle (Board / List / Forecast), Clients,
Contact Profile, Group Accounts, Applications (6-step wizard), Policies, Renewals, Claims,
Travel, Payments, Commissions, Documents, Tasks, Relationship Management, Reports, Products,
Email Templates, Settings, global search and an overlay/modal architecture.

**Terminology is fixed** and other docs assume it: Lead → Applicant → Client → Policyholder →
Renewal / Lost. The UI standardizes on **Lead**; "Prospect" is a deprecated alias retained only
as the `prospects` route key.

**Constraints that future work must preserve:**

- **Outbound email does not send.** Logging an email, message, brochure, or payment
  instruction writes a `communications` row only — there is no SMTP or Gmail integration yet.
  A logged action is not delivered and must not trigger delivery-dependent statuses.
- **All actions stay human-in-the-loop and are logged.** Nothing advances a lead or notifies a
  client autonomously.
- **Delete is Admin-only.** Staff and Agent use soft states — deactivate, mark-lost — never
  hard delete. Historical data is always preserved.
- **Configuration over custom development.** Products, contacts, documents, templates, and
  relationship events are meant to be configurable rather than hard-coded.
- Next.js App Router + TypeScript, Tailwind, shadcn/ui, Supabase (Postgres / Auth / Storage).
  Data access goes through the repository layer in `lib/repositories/`. Migrations are
  hand-written SQL in `supabase/migrations/`.
- Where implementation diverges from the canonical business spec, the difference is recorded
  in `docs/development-alignment.md` rather than silently rewriting the requirement.

## Brand Commitments

No external brand constrains this product. There is no company logo, brand palette, or
carrier-imposed identity to honor — confirmed 2026-08-28.

The incumbent implementation is therefore the de-facto identity and the thing refinement work
preserves: **Hanken Grotesk** (sans, via `--font-sans`) and **JetBrains Mono** (`--font-mono`),
over a token-based light/dark palette defined in `app/globals.css` and exposed through
`@theme inline`. Semantic tone helpers live in `components/hub/tone.ts` and the shared
primitives in `components/hub/primitives.tsx`.

Because nothing external is binding, this look may be refined — but it should be treated as a
real design system with an owner, not as scaffolding to be discarded.

## Evidence on Hand

- **`../docs/`** — the client's own notes and spec repo, authoritative for business intent:
  `REQUIREMENTS.md` (per-product carrier document lists), `web/pages.md`, `web/data-model.md`,
  `web/lead-workflow.md`, `web/contact-profile.md`, `web/modals.md`,
  `web/new-application-wizard.md`, `web/permissions.md`, `People-Terms.md`.
- **Primary source transcripts** — `Discovery Call-Transcript.md`, the discovery meeting notes,
  and `Demo Validation Meeting - Notes.md` / `- Transcript.md` from the 2026-07-23 demo. Quote
  from these rather than paraphrasing from memory.
- **`docs/`** (in-repo) — the build blueprint and `development-alignment.md` register.
- **`TESTING.md`** — a manual verification guide for recent shipped work.

**Absences future work must not fabricate:** there are no testimonials, no case studies, no
customer logos, no press, no published pricing, and no benchmarks. Real client and policy data
is private operational data, not marketing evidence. Nothing in this product should present
invented figures, named customers, or carrier endorsements.

## Product Principles

1. **The carrier is external and mutable.** Never hard-code Pacific Cross's products, forms,
   contacts, or requirements as if they were permanent facts of the system.
2. **Two people, whole business.** Every screen serves an operator who is personally
   accountable for every record. Nothing may quietly go missing between screens.
3. **Human-in-the-loop, always logged.** The system proposes and records; a person decides.
   Automation that acts on a client's behalf is out of character for this product.
4. **Soft states over deletion.** History is an asset. Records retire, they do not vanish.
5. **Truth lives in the spec repo.** When code and the client's spec disagree, the gap gets
   recorded, not papered over.

## Accessibility & Inclusion

No product-specific accessibility requirement or known user need was established
(confirmed 2026-08-28). No formal standard is claimed; ordinary good practice applies.
