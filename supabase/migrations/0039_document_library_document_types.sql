-- CCAF (Credit Card Authorization Form) and Geographical Loading are received Travel
-- collateral that no existing document_type fits: the CHECK constraint only allows
-- Brochure, Application Form, Attestation Letter, Medical Questionnaire, Renewal Form,
-- Claim Form and Email Template Attachment. Widen it with two values rather than forcing
-- either file into a type it isn't: 'Authorization Form' for CCAF, and 'Reference Document'
-- as a reusable bucket for pricing/underwriting reference sheets like Geographical Loading.
--
-- The product row -- not this constraint -- is still the source of truth for anything
-- product-specific; this only widens what document_type may hold.
alter table public.document_library
  drop constraint document_library_document_type_check;

alter table public.document_library
  add constraint document_library_document_type_check check (document_type in (
    'Brochure', 'Application Form', 'Attestation Letter', 'Medical Questionnaire',
    'Renewal Form', 'Claim Form', 'Email Template Attachment',
    'Authorization Form', 'Reference Document'
  ));
