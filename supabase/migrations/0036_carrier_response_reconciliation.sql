-- Reconcile Eman's 2026-08-24 carrier follow-up without storing shared credentials.
--
-- Proposal generation and Travel fulfillment use different Pacific Cross sites. The original
-- integration row represented only the proposal generator, so give it an explicit provider key and
-- add a separately configurable Travel portal row.

insert into public.integration_settings (provider, portal_url)
select 'pacific_cross_proposal', coalesce(portal_url, 'https://quotation.pacificcross.com.ph/')
from public.integration_settings
where provider = 'pacific_cross'
on conflict (provider) do update
set portal_url = coalesce(public.integration_settings.portal_url, excluded.portal_url);

delete from public.integration_settings where provider = 'pacific_cross';

insert into public.integration_settings (provider, portal_url)
values ('pacific_cross_travel', 'https://mytravelportal.pacificcross.com.ph/Tppprod/User.aspx/Logon')
on conflict (provider) do update
set portal_url = coalesce(public.integration_settings.portal_url, excluded.portal_url);

-- The PDF Enrollment List is not a separate missing template: Pacific Cross wants the completed
-- CET submitted again as a signed PDF at final-document stage. The Secretary's Certificate is
-- produced by the client, not requested from Pacific Cross.
with corrections(document_name, notes) as (
  values
    ('Duly accomplished and signed Enrollment List in PDF',
     'Same completed CET data submitted as a duly signed PDF during final-document submission; no separate carrier template.'::text),
    ('Notarized Secretary''s Certificate',
     'Client-supplied KYC document; signed by the Corporate Secretary and notarized. No Pacific Cross template.'::text)
)
update public.required_document_items item
set notes = corrections.notes
from corrections
join public.required_document_templates template
  on template.template_name = 'BC Flexi HMO group enrolment'
where item.requirement_template_id = template.id
  and item.document_name = corrections.document_name;

-- Snapshot rows are normally immutable, but these are operational instructions rather than a
-- changed requirement or status. Correct pending/active BC Flexi snapshots so staff do not keep
-- asking Pacific Cross for documents the client or CET workflow supplies.
update public.application_requirements snapshot
set notes = source.notes
from public.required_document_items source
join public.required_document_templates template
  on template.id = source.requirement_template_id
where template.template_name = 'BC Flexi HMO group enrolment'
  and snapshot.required_document_item_id = source.id
  and source.document_name in (
    'Duly accomplished and signed Enrollment List in PDF',
    'Notarized Secretary''s Certificate'
  );
