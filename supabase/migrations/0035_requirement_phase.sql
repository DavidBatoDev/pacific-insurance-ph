-- Two-phase requirement checklists, and BC Flexi's own template.
--
-- Pacific Cross's BC Flexi requirement list is two sequential gates, not one
-- list (Eman, 2026-08-18):
--
--   FOR PROPOSAL                  4 items -- PIS, CET, Franchise Form, Utilization Report
--   ONCE THE GROUP AGREES        13 items -- COR, AOI, GIS, the KYC alphalists, and six
--                                            signed/notarised corporate forms
--
-- `application_requirements` was flat, so a group would have been shown all 17
-- at once, including the 13 that are meaningless before they have accepted a
-- proposal. Concretely that meant a completeness column stuck at 0/17 and a
-- "missing documents" email asking the client for paperwork they cannot yet
-- produce. See TO-BE-UPDATE-PLAN.md Phase G, item G9.
--
-- Null phase means "applies throughout", which is every pre-existing row and
-- every non-phased template.
--
-- THE GATE REUSES `is_required` rather than adding new status machinery.
-- Post-agreement items are seeded not-required, so they are visible as
-- forthcoming but excluded from the outstanding count and from the client
-- email. Activating the phase flips them. That is the same lever the health
-- branch already uses for TAL/CAC and G8 uses for the conditional NOC items.
--
-- NOTE ON THE UNIQUE CONSTRAINT the plan flagged as a blocker:
-- `unique (application_id, required_document_item_id)` (0024:16) is NOT relaxed.
-- It only bites if one template item must be snapshotted under two phases, and
-- no BC Flexi item appears in both -- each of the 17 belongs to exactly one
-- gate. Leaving the constraint intact keeps the duplicate protection it exists
-- for; revisit only if a genuinely repeating item turns up.

alter table public.required_document_items
  add column phase text check (phase is null or phase in ('For proposal', 'Once the group agrees'));

alter table public.application_requirements
  add column phase text check (phase is null or phase in ('For proposal', 'Once the group agrees'));

comment on column public.application_requirements.phase is
  'Which gate this item belongs to. Null = applies throughout. Post-agreement items are seeded is_required=false so they do not count as outstanding until the phase is activated.';

-- BC Flexi's own template. Product-specific, so `snapshotApplicationRequirements`
-- finds it by product_version_id and never falls back to the generic baseline --
-- which is what a BC Flexi group application was getting until now.
insert into public.required_document_templates (template_name, product_version_id, description, status)
select 'BC Flexi HMO group enrolment',
       (select pv.id from public.product_versions pv
          join public.products p on p.id = pv.product_id
         where p.name = 'BC Flexi' order by pv.created_at limit 1),
       'Pacific Cross BC Flexi group HMO requirements, in two gates: for proposal, then once the group agrees to the proposal.',
       'Active'
where not exists (
  select 1 from public.required_document_templates where template_name = 'BC Flexi HMO group enrolment'
);

insert into public.required_document_items (requirement_template_id, document_name, is_required, applies_to, notes, sort_order, phase)
select t.id, item.document_name, item.is_required, item.applies_to, item.notes, item.sort_order, item.phase
from public.required_document_templates t
cross join (
  values
    -- Gate 1: needed before Pacific Cross will issue a proposal.
    ('Proposal Information Sheet (PIS)', true, null::text, 'Filled out by Pacific Cross sales personnel; marked FOR INTERNAL USE ONLY, so it is not sent to the client.'::text, 10, 'For proposal'::text),
    ('Corporate Enrollment Template (CET)', true, null::text, 'One row per member; the app captures the ~19 CET fields per member.'::text, 20, 'For proposal'),
    ('Franchise Application Form', false, 'Only if the group has no previous HMO'::text, null::text, 30, 'For proposal'),
    ('Utilization Report from the previous HMO', false, 'Only if the group has a previous HMO'::text, 'Client-supplied, with run date and covering period.'::text, 40, 'For proposal'),
    -- Gate 2: only once the group has accepted the proposal. Seeded not-required
    -- so they stay off the outstanding count until the phase is activated.
    ('SEC/BSP-issued Certificate of Registration (COR)', false, null::text, null::text, 110, 'Once the group agrees'),
    ('Articles of Incorporation (AOI)', false, null::text, null::text, 120, 'Once the group agrees'),
    ('Latest General Information Sheet (GIS)', false, null::text, null::text, 130, 'Once the group agrees'),
    ('SSS Alphalist', false, 'KYC member checking'::text, null::text, 140, 'Once the group agrees'),
    ('BIR Alphalist', false, 'KYC member checking'::text, null::text, 150, 'Once the group agrees'),
    ('PhilHealth list', false, 'KYC member checking'::text, null::text, 160, 'Once the group agrees'),
    ('HR Certification', false, 'KYC member checking'::text, null::text, 170, 'Once the group agrees'),
    ('Corporate Secretary''s Attestation Form + valid ID', false, null::text, 'No template held; request from Pacific Cross.'::text, 180, 'Once the group agrees'),
    ('Authorized Representative''s Attestation Form + valid ID', false, null::text, 'No template held; request from Pacific Cross.'::text, 190, 'Once the group agrees'),
    ('Duly accomplished and signed Employer''s Application Form', false, null::text, 'No template held; request from Pacific Cross.'::text, 200, 'Once the group agrees'),
    ('Duly accomplished Enrollment List in Excel', false, null::text, 'Complete details per member.'::text, 210, 'Once the group agrees'),
    ('Duly accomplished and signed Enrollment List in PDF', false, null::text, 'No template held; request from Pacific Cross.'::text, 220, 'Once the group agrees'),
    ('Notarized Secretary''s Certificate', false, 'KYC requirement'::text, 'No template held; request from Pacific Cross.'::text, 230, 'Once the group agrees')
) as item(document_name, is_required, applies_to, notes, sort_order, phase)
where t.template_name = 'BC Flexi HMO group enrolment'
  and not exists (
    select 1 from public.required_document_items i
    where i.requirement_template_id = t.id and i.document_name = item.document_name
  );
