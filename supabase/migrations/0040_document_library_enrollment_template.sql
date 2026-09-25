-- The Corporate Enrollment Template (CET) is BC Flexi's member-list spreadsheet: a
-- company fills in one row per employee and dependent and returns it for group
-- enrollment. It fits none of the existing document types.
--
-- 'Application Form' was the obvious candidate and is deliberately not used:
-- matchCarrierForm (app/(app)/applications/wizard-actions.ts) attaches the first
-- eligible BC Flexi 'Application Form' as the carrier form. The Franchise form has
-- no effective date, so an undated CET under the same type would tie with it and
-- could be attached in its place.
alter table public.document_library
  drop constraint document_library_document_type_check;

alter table public.document_library
  add constraint document_library_document_type_check check (document_type in (
    'Brochure', 'Application Form', 'Attestation Letter', 'Medical Questionnaire',
    'Renewal Form', 'Claim Form', 'Email Template Attachment',
    'Authorization Form', 'Reference Document', 'Enrollment Template'
  ));
