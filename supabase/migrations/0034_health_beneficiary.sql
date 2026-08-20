-- Beneficiary person, per insured person, on the health branch.
--
-- Pacific Cross's requirement lists for Select, Blue Royale and FlexiShield all
-- read "Valid IDs of the Principal Insured and Beneficiary" (Eman, 2026-08-18).
-- The health branch had no beneficiary at all: `WizardMember` carried only the
-- insured person, so there was nobody for that ID requirement to attach to.
-- See TO-BE-UPDATE-PLAN.md Phase G, item G4.
--
-- PER PERSON, not per application. The FlexiShield application form (print
-- edition, 2024-09) carries two separate beneficiary blocks: one under the
-- principal, headed "Relationship to Principal Applicant", and another under
-- each dependent, headed "Relationship to Dependent". Both blocks include a
-- GOV'T ISSUED CARD field, which is what the carrier's ID requirement refers to.
--
-- Column names mirror `travelers` (0025:76-79) exactly, so the health and travel
-- branches describe a beneficiary with one vocabulary rather than two.
--
-- Only the four fields the workflow needs -- enough to identify the person and
-- hang the valid-ID requirement on them. The form also asks their place of
-- birth, sex, nationality, address and ID number; those stay on the carrier's
-- form, per C7's rule that we do not re-key every field of an authoritative
-- document.

alter table public.applications
  add column beneficiary_name      text,
  add column beneficiary_birthdate date,
  add column beneficiary_relation  text,
  add column beneficiary_contact   text;

alter table public.application_dependents
  add column beneficiary_name      text,
  add column beneficiary_birthdate date,
  add column beneficiary_relation  text,
  add column beneficiary_contact   text;

comment on column public.applications.beneficiary_name is
  'Principal applicant''s nominated beneficiary. Drives the "Valid government-issued ID — beneficiary" requirement; null means none nominated and no ID is asked for.';
comment on column public.application_dependents.beneficiary_relation is
  'Relationship to the DEPENDENT, not to the principal — the carrier form asks it that way for each dependent''s own beneficiary block.';
