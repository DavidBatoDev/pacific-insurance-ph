-- Medical Notification of Claim page-4 requirement templates.
--
-- Transcribed from the "Claims Reimbursement Checklist" on page 4 of Pacific
-- Cross's medical Notification of Claim (docs/attachments/applications/NOC.pdf),
-- which is the first fully-specified conditional requirement set we have for
-- claims. Consumed by generateClaimRequirementsAction, which snapshots one of
-- these into claim_requirements per claim.
--
-- The page's basic requirements are seeded as required; its conditional branches
-- (surgical procedure, private duty nurse, maternity, accident, death, overseas,
-- optical) are seeded optional for staff to toggle on, matching how the health
-- branch already treats TAL/CAC.
--
-- Travel claims are deliberately absent: the TravelSafe NOC carries its
-- requirements inside the form itself, so there is no discrete list to template.
--
-- PROVENANCE: these rows were first inserted by scripts/g8-seed-claim-templates.mjs
-- during G8's implementation, because that work ran in a parallel worktree that was
-- barred from adding migration files while three workers shared one database. This
-- migration is that seed restated in the project's normal form, generated from the
-- live rows so it matches them exactly. Idempotent on template_name / document_name
-- (the same guard 0024 uses), so it is a no-op against the database it was written
-- from and correct against a fresh one. The script is retained as the transcription
-- record; this file is the source of truth.

insert into public.required_document_templates (template_name, description, status)
select 'Medical NOC — In-Patient Claim', 'Claims Reimbursement Checklist, in-patient column (Pacific Cross medical Notification of Claim, page 4).', 'Active'
where not exists (
  select 1 from public.required_document_templates where template_name = 'Medical NOC — In-Patient Claim'
);

insert into public.required_document_items (requirement_template_id, document_name, is_required, applies_to, notes, sort_order)
select t.id, item.document_name, item.is_required, item.applies_to, item.notes, item.sort_order
from public.required_document_templates t
cross join (
  values
    ('Duly-accomplished Notification of Claim (NOC) form', true, null::text, null::text, 10),
    ('Original official receipt(s) of all payments made', true, null::text, null::text, 20),
    ('Drug prescription from the attending physician', true, null::text, null::text, 30),
    ('Admitting medical history', true, null::text, 'Includes detailed history of present illness; family, personal and past medical history.'::text, 40),
    ('Discharge summary report', true, null::text, 'Includes patient''s course in wards, diagnostic tests requested and medications given.'::text, 50),
    ('Statement of Account', true, null::text, 'Summarized and itemized.'::text, 60),
    ('Supporting charge slips of statement of account', true, 'Where the hospital has no itemized Statement of Account'::text, null::text, 70),
    ('Copy of results of laboratory, X-ray, other diagnostic exams and therapeutic services', true, null::text, null::text, 80),
    ('Operative Report and Histopathology Report', false, 'If a surgical procedure was done'::text, 'Operative report describes the surgical procedure; histopathology report covers the nature, extent and stage of illness.'::text, 90),
    ('Referral letter/slip from the attending physician', false, 'If a Private Duty Nurse was deemed necessary'::text, null::text, 100),
    ('Copy of Registered Death Certificate', false, 'In the event of death of the member'::text, null::text, 110),
    ('Copy of police report', false, 'For injury as a result of an accident, or where applicable in the event of death'::text, null::text, 120),
    ('Incident report', false, 'For injury as a result of an accident'::text, null::text, 130),
    ('Proof of overseas stay', false, 'For overseas claims'::text, 'E.g. airline ticket of the actual flight taken, boarding pass, immigration stamps in the passport, or proof of entry and exit where immigration stamps are not applicable.'::text, 140)
) as item(document_name, is_required, applies_to, notes, sort_order)
where t.template_name = 'Medical NOC — In-Patient Claim'
  and not exists (
    select 1 from public.required_document_items i
    where i.requirement_template_id = t.id and i.document_name = item.document_name
  );

insert into public.required_document_templates (template_name, description, status)
select 'Medical NOC — Out-Patient Claim', 'Claims Reimbursement Checklist, out-patient column (Pacific Cross medical Notification of Claim, page 4).', 'Active'
where not exists (
  select 1 from public.required_document_templates where template_name = 'Medical NOC — Out-Patient Claim'
);

insert into public.required_document_items (requirement_template_id, document_name, is_required, applies_to, notes, sort_order)
select t.id, item.document_name, item.is_required, item.applies_to, item.notes, item.sort_order
from public.required_document_templates t
cross join (
  values
    ('Duly-accomplished Notification of Claim (NOC) form', true, null::text, null::text, 10),
    ('Original official receipt(s) of all payments made', true, null::text, 'With itemized summary of charges.'::text, 20),
    ('Copy of the drug prescription from the attending physician', false, 'If applicable'::text, null::text, 30),
    ('Copy of request for laboratory, X-ray, other diagnostic exams and therapeutic services', false, 'If applicable'::text, null::text, 40),
    ('Copy of results of laboratory, X-ray, other diagnostic exams and therapeutic services', false, 'If applicable'::text, null::text, 50),
    ('Operative Report and Histopathology Report', false, 'If an out-patient operation was done'::text, 'Operative report describes the surgical procedure; histopathology report covers the nature, extent and stage of illness.'::text, 60),
    ('Copy of police report', false, 'For injury as a result of an accident'::text, null::text, 70),
    ('Incident report', false, 'For injury as a result of an accident'::text, null::text, 80),
    ('Proof of overseas stay', false, 'For overseas claims'::text, 'E.g. airline ticket, boarding pass, or immigration stamps in the passport.'::text, 90),
    ('Prescription from Ophthalmologist or Optometrist', false, 'For optical claims'::text, 'Required quantity must be indicated if claiming for disposable contact lenses.'::text, 100)
) as item(document_name, is_required, applies_to, notes, sort_order)
where t.template_name = 'Medical NOC — Out-Patient Claim'
  and not exists (
    select 1 from public.required_document_items i
    where i.requirement_template_id = t.id and i.document_name = item.document_name
  );
