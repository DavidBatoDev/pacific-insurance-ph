-- The September carrier-library load filed the Travel Application Form, Travel Brochure 2024,
-- Credit Card Authorization Form and Geographical Loading under the legacy "Travel Insurance"
-- product version, which 0037 deactivated in favour of TravelSafe. Carrier-form matching and
-- email-attachment eligibility resolve by the request's TravelSafe product version, so every
-- Travel request was stamped "Unavailable" and the workflow warned that no approved Travel
-- application form exists. Re-file those library rows under the TravelSafe version.
update public.document_library d
set product_version_id = travelsafe.id
from public.product_versions legacy
join public.products legacy_product on legacy_product.id = legacy.product_id,
  (select id from public.product_versions where source_key = 'travelsafe-2023-10-15') travelsafe
where d.product_version_id = legacy.id
  and legacy_product.name = 'Travel Insurance'
  and legacy_product.source_key is null;

-- Requests created while the form was unreachable get the form that was in effect on their
-- creation date, exactly as the wizard would have assigned it.
update public.travel_requests t
set carrier_form_library_id = form.id,
    carrier_form_match_status = 'Matched'
from public.document_library form
where t.carrier_form_match_status = 'Unavailable'
  and t.carrier_form_library_id is null
  and form.product_version_id = t.product_version_id
  and form.document_type = 'Application Form'
  and form.variant is null
  and form.age_band = 'All Ages'
  and form.status = 'Active'
  and form.approval_status = 'Approved'
  and (form.effective_date is null or form.effective_date <= t.created_at::date)
  and (form.expiry_date is null or form.expiry_date >= t.created_at::date);
