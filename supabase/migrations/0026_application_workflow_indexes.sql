-- Cover C7 foreign keys used for carrier-form, traveler, and requirement lookups.

create index application_carrier_forms_dependent_fk_idx
  on public.application_carrier_forms (dependent_id);
create index application_carrier_forms_library_fk_idx
  on public.application_carrier_forms (document_library_id);
create index travelers_plan_option_fk_idx
  on public.travelers (plan_option_id);
create index travel_request_requirements_item_fk_idx
  on public.travel_request_requirements (required_document_item_id);
create index application_requirements_item_fk_idx
  on public.application_requirements (required_document_item_id);
