-- Reconcile application and Travel workflows with the versioned carrier forms.

alter table public.applications
  add column coverage_type text check (coverage_type in ('Individual', 'Family')),
  add column desired_start_date date,
  add column preferred_payment_mode text,
  add column estimated_premium numeric check (estimated_premium is null or estimated_premium >= 0),
  add column remote_sale boolean not null default false,
  add column pre_existing_status text check (pre_existing_status in ('Yes', 'No', 'Unknown')),
  add column medical_notes text;

create table public.application_dependents (
  application_id       uuid not null references public.applications (id) on delete cascade,
  dependent_id         uuid not null references public.dependents (id) on delete restrict,
  pre_existing_status  text check (pre_existing_status in ('Yes', 'No', 'Unknown')),
  medical_notes        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (application_id, dependent_id)
);
alter table public.application_dependents enable row level security;
create trigger trg_application_dependents_updated before update on public.application_dependents
  for each row execute function public.set_updated_at();
create index application_dependents_dependent_idx on public.application_dependents (dependent_id);

create table public.application_carrier_forms (
  id                    uuid primary key default gen_random_uuid(),
  application_id        uuid not null references public.applications (id) on delete cascade,
  dependent_id          uuid references public.dependents (id) on delete restrict,
  person_name_snapshot  text not null,
  form_variant          text,
  age_band              text not null check (age_band in ('0-70', '71-100', 'All Ages')),
  document_library_id   uuid references public.document_library (id) on delete set null,
  match_status          text not null check (match_status in ('Matched', 'Unavailable')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.application_carrier_forms enable row level security;
create trigger trg_application_carrier_forms_updated before update on public.application_carrier_forms
  for each row execute function public.set_updated_at();
create unique index application_carrier_forms_principal_idx
  on public.application_carrier_forms (application_id) where dependent_id is null;
create unique index application_carrier_forms_dependent_idx
  on public.application_carrier_forms (application_id, dependent_id) where dependent_id is not null;

alter table public.travel_requests
  add column travel_purpose text,
  add column itinerary text,
  add column applicant_is_traveler boolean not null default true,
  add column payment_channel_id uuid references public.payment_channels (id) on delete set null,
  add column payment_instruction_logged_at timestamptz,
  add column payment_acknowledgement_logged_at timestamptz,
  add column portal_payment_status text not null default 'Not Yet'
    check (portal_payment_status in ('Not Yet', 'Prepaid')),
  add column portal_payment_reference text,
  add column portal_payment_amount numeric check (portal_payment_amount is null or portal_payment_amount >= 0),
  add column portal_processing_status text not null default 'Not Started'
    check (portal_processing_status in ('Not Started', 'Processing', 'Issued', 'Failed')),
  add column carrier_form_library_id uuid references public.document_library (id) on delete set null,
  add column carrier_form_age_band text not null default 'All Ages'
    check (carrier_form_age_band in ('0-70', '71-100', 'All Ages')),
  add column carrier_form_match_status text not null default 'Unavailable'
    check (carrier_form_match_status in ('Matched', 'Unavailable'));

create table public.travelers (
  id                    uuid primary key default gen_random_uuid(),
  travel_request_id     uuid not null references public.travel_requests (id) on delete cascade,
  full_name             text not null,
  date_of_birth         date,
  nationality           text,
  gender                text,
  contact_number        text,
  id_type               text,
  id_number             text,
  plan_option_id        uuid references public.plan_options (id) on delete set null,
  beneficiary_name      text,
  beneficiary_birthdate date,
  beneficiary_relation  text,
  beneficiary_contact   text,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.travelers enable row level security;
create trigger trg_travelers_updated before update on public.travelers
  for each row execute function public.set_updated_at();
create index travelers_request_idx on public.travelers (travel_request_id, sort_order);

create table public.travel_request_requirements (
  id                          uuid primary key default gen_random_uuid(),
  travel_request_id           uuid not null references public.travel_requests (id) on delete cascade,
  required_document_item_id   uuid references public.required_document_items (id) on delete set null,
  document_name               text not null,
  applies_to                  text,
  notes                       text,
  is_required                 boolean not null default true,
  status                      text not null default 'Pending'
                              check (status in ('Pending', 'Received', 'Incomplete', 'Verified')),
  sort_order                  integer not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
alter table public.travel_request_requirements enable row level security;
create trigger trg_travel_request_requirements_updated before update on public.travel_request_requirements
  for each row execute function public.set_updated_at();
create index travel_request_requirements_request_idx
  on public.travel_request_requirements (travel_request_id, status, sort_order);

alter table public.documents
  add column source_library_document_id uuid references public.document_library (id) on delete set null,
  add column application_requirement_id uuid references public.application_requirements (id) on delete set null,
  add column travel_requirement_id uuid references public.travel_request_requirements (id) on delete set null,
  add constraint documents_one_requirement_check check (
    application_requirement_id is null or travel_requirement_id is null
  );
create index documents_source_library_idx on public.documents (source_library_document_id);
create index documents_application_requirement_idx on public.documents (application_requirement_id);
create index documents_travel_requirement_idx on public.documents (travel_requirement_id);
