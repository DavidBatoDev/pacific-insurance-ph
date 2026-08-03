# App Documentation — Implementation Companion

This folder explains how the Pacific Insurance PH product is being implemented. It is not the
canonical source for current business intent.

## Source hierarchy

1. [`../../docs/`](../../docs/INDEX.md) — canonical business intent, UI behavior, workflows, and
   client decisions.
2. This folder — current implementation status, technical mappings, and engineering decisions.
3. Application code and Supabase migrations — implementation truth. Differences from the
   canonical specification must remain visible in the alignment register.

The files under `foundation/`, `data-model/`, `frameworks/`, `modules/`, and `workflows/` are a
dated June 2026 baseline converted from 26 client Word documents. Keep them as historical,
read-only references. They may contain older architecture or terminology, including a separate
Prospect model, that has since been superseded by the canonical sibling documentation.

## Read first

- [Development Alignment Register](development-alignment.md) — maps canonical concepts to the
  current schema and records intentional adapters, known code gaps, and superseded assumptions.
- [Build Roadmap](build-roadmap.md) — current implementation status and near-term engineering
  priorities.
- [Canonical Documentation Index](../../docs/INDEX.md) — what the product should do.

## Historical baseline

### Foundation

- [Design Principle](foundation/design-principle-configurable-operations-system.md)
- [Master System Blueprint](foundation/master-system-blueprint-v2.md)
- [MVP Scope & Phase Roadmap](foundation/mvp-scope-and-phase-roadmap.md)
- [Module Architecture & Navigation](foundation/module-architecture-and-navigation-blueprint.md)
- [Terminology Standards](foundation/terminology-standards.md)

### Data model and frameworks

- [Baseline Database Schema](data-model/data-model-database-schema.md)
- [Activity Timeline & Audit Trail](frameworks/activity-timeline-and-audit-trail-framework.md)
- [Automation & Business Rules](frameworks/automation-framework-and-business-rules.md)
- [Dashboard & KPI Framework](frameworks/dashboard-and-kpi-framework.md)
- [Document Storage Framework](frameworks/document-management-and-file-storage-framework.md)
- [Reference Numbering](frameworks/reference-numbering-and-record-identification-framework.md)
- [Search & Record Linking](frameworks/search-and-record-linking-framework.md)

### Module and workflow baselines

- `modules/` contains the original Client Hub, Prospect Pipeline, relationship, and travel
  blueprints.
- `workflows/` contains the original eight operational workflows.

These baseline files are useful for background details that have not yet been revisited. When
they conflict with `../../docs/web/`, follow the canonical sibling spec and update the alignment
register.

## Confidentiality

Carrier-supplied applications, brochures, forms, and email exports stay in
`../../docs/attachments/`. Do not copy them into the application repository or ingest them into
the Carrier Library until they have been redacted and approved.
