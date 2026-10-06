-- 0045: re-point the BC Flexi enrolment checklist at the active catalog version.
--
-- 0035 attached "BC Flexi HMO group enrolment" (17 items, two phases) to the "BC Flexi 2026"
-- product version. 0037's carrier rate catalog then deactivated that version and made the
-- quote-only version (source_key bc-flexi-quote-only-2026-08-24) the active one, but the template
-- stayed on the old row. Since then a BC Flexi application's requirement snapshot fell back to the
-- 5-item "Standard new-business baseline", while the wizard preview showed a hardcoded 17-item list.
-- Found while testing Phase H H3a, which makes the preview read the template.

update public.required_document_templates t
set product_version_id = active.id
from public.product_versions active
where t.template_name = 'BC Flexi HMO group enrolment'
  and active.source_key = 'bc-flexi-quote-only-2026-08-24'
  and active.status = 'Active'
  and t.product_version_id is distinct from active.id;
