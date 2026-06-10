# Docs — Pacific Insurance PH Operations Platform

Source documentation provided by the client, describing what the platform must do. The 26 Word
documents were converted to Markdown and organized by topic below. (The original `.docx` files
live in the client's Google Drive; these Markdown copies are the in-repo reference.)

Read in roughly this order for context: **foundation → data-model → frameworks → modules → workflows**.

## Foundation

Vision, scope, and system-wide architecture.

- [Design Principle: Configurable Insurance Operations System](foundation/design-principle-configurable-operations-system.md)
- [Master System Blueprint (Version 2)](foundation/master-system-blueprint-v2.md)
- [MVP Scope & Phase Roadmap](foundation/mvp-scope-and-phase-roadmap.md)
- [Module Architecture & Navigation Blueprint](foundation/module-architecture-and-navigation-blueprint.md)
- [Terminology Standards](foundation/terminology-standards.md)

## Data Model

- [Data Model / Database Schema](data-model/data-model-database-schema.md) — the core tables (includes a Flexishield/Travel update at the bottom)

## Frameworks

Cross-cutting rules that apply across modules.

- [Activity Timeline & Audit Trail Framework](frameworks/activity-timeline-and-audit-trail-framework.md)
- [Automation Framework & Business Rules](frameworks/automation-framework-and-business-rules.md)
- [Dashboard & KPI Framework](frameworks/dashboard-and-kpi-framework.md)
- [Document Management & File Storage Framework](frameworks/document-management-and-file-storage-framework.md)
- [Reference Numbering & Record Identification Framework](frameworks/reference-numbering-and-record-identification-framework.md)
- [Search, Global Search & Record Linking Framework](frameworks/search-and-record-linking-framework.md)

## Modules

Per-module blueprints and screen inventories.

- [Client Hub Module Blueprint](modules/client-hub-module-blueprint.md)
- [Client Hub Screen Inventory](modules/client-hub-screen-inventory.md)
- [Client Hub Status & Timeline Framework](modules/client-hub-status-and-timeline-framework.md)
- [Prospect Pipeline Module Blueprint](modules/prospect-pipeline-module-blueprint.md)
- [Relationship Events Module](modules/relationship-events-module.md)
- [Travel Insurance Module Requirements](modules/travel-insurance-module-requirements.md)

## Workflows

The eight operational workflows, each with its trigger, status flow, and steps.

- [Workflow 1: New Business Application (Standard)](workflows/workflow-1-new-business-application-standard.md)
- [Workflow 2: New Business Application (Medical Review)](workflows/workflow-2-new-business-application-medical-review.md)
- [Workflow 3: Senior Application (Age 71–100)](workflows/workflow-3-senior-application-age-71-100.md)
- [Workflow 4: Policy Renewal (Standard)](workflows/workflow-4-policy-renewal-standard.md)
- [Workflow 5: Policy Renewal (Amendment)](workflows/workflow-5-policy-renewal-amendment.md)
- [Workflow 6: Policy Reinstatement](workflows/workflow-6-policy-reinstatement.md)
- [Workflow 7: Claims Assistance](workflows/workflow-7-claims-assistance.md)
- [Workflow 8: Travel Insurance Fulfillment V2](workflows/workflow-8-travel-insurance-fulfillment-v2.md)

## Notes

- **Conversion:** Markdown was generated from the client's `.docx` files (headings, lists, and
  inline formatting preserved; the documents contain no tables or images). Each file begins with a
  `> Source:` line naming its original. If anything reads oddly, the client's Google Drive copy is
  authoritative.
- **Editing:** treat these as read-only references to the client's intent. Capture our own
  interpretations/decisions in separate notes rather than editing the client's documents.
- **Confidentiality:** everything under `docs/` is currently tracked by git. If any document
  shouldn't be committed, tell me and I'll add a `.gitignore` rule.
