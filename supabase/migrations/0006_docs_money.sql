-- 0006 documents, document library, external coverage, payments, commissions.

create table public.documents (
  id                uuid primary key default gen_random_uuid(),
  reference_no      text unique,
  client_id         uuid references public.clients (id) on delete cascade,
  policy_id         uuid references public.policies (id) on delete set null,
  application_id    uuid references public.applications (id) on delete set null,
  claim_id          uuid references public.claims (id) on delete set null,
  renewal_id        uuid references public.renewals (id) on delete set null,
  travel_request_id uuid references public.travel_requests (id) on delete set null,
  document_type     text,
  name              text not null,
  file_path         text,                  -- Supabase Storage object path
  version           integer not null default 1,
  visibility        text not null default 'Internal Only' check (visibility in (
                      'Internal Only','Staff Only','Client Visible')),
  status            text not null default 'Uploaded' check (status in (
                      'Draft','Uploaded','Under Review','Approved','Archived','Replaced')),
  uploaded_by       uuid references public.users (id),
  uploaded_at       timestamptz not null default now(),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.documents enable row level security;
create trigger trg_documents_updated before update on public.documents
  for each row execute function public.set_updated_at();
create trigger trg_documents_ref before insert on public.documents
  for each row execute function public.assign_reference_no('DOC');
create index on public.documents (client_id);
create index on public.documents (policy_id);
create index on public.documents (application_id);
create index on public.documents (claim_id);
create index on public.documents (renewal_id);

create table public.document_library (
  id                 uuid primary key default gen_random_uuid(),
  product_version_id uuid references public.product_versions (id) on delete set null,
  document_name      text not null,
  document_type      text check (document_type in (
                       'Brochure','Application Form','Attestation Letter','Medical Questionnaire',
                       'Renewal Form','Claim Form','Email Template Attachment')),
  file_path          text,
  effective_date     date,
  expiry_date        date,
  status             text not null default 'Active' check (status in ('Active','Inactive')),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.document_library enable row level security;
create trigger trg_document_library_updated before update on public.document_library
  for each row execute function public.set_updated_at();

-- First-layer HMO / external insurance (required for FlexiShield).
create table public.external_coverage (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references public.clients (id) on delete cascade,
  policy_id             uuid references public.policies (id) on delete set null,
  coverage_type         text check (coverage_type in (
                          'HMO','Corporate HMO','Employer Health Plan','Other Insurance','Unknown')),
  provider_name         text,
  plan_name             text,
  maximum_benefit_limit numeric,
  currency              text default 'PHP',
  effective_date        date,
  expiry_date           date,
  status                text not null default 'Active' check (status in ('Active','Inactive')),
  proof_document_id     uuid references public.documents (id) on delete set null,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.external_coverage enable row level security;
create trigger trg_external_coverage_updated before update on public.external_coverage
  for each row execute function public.set_updated_at();
create index on public.external_coverage (client_id);

-- FlexiShield policies link to their first-layer coverage record.
alter table public.policies
  add column first_layer_coverage_id uuid references public.external_coverage (id) on delete set null;

create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  reference_no      text unique,
  client_id         uuid references public.clients (id) on delete set null,
  policy_id         uuid references public.policies (id) on delete set null,
  application_id    uuid references public.applications (id) on delete set null,
  renewal_id        uuid references public.renewals (id) on delete set null,
  travel_request_id uuid references public.travel_requests (id) on delete set null,
  amount            numeric,
  currency          text default 'PHP',
  payment_method    text,
  payment_date      date,
  proof_document_id uuid references public.documents (id) on delete set null,
  sent_to_pacific_cross      boolean not null default false,
  sent_to_pacific_cross_date date,
  or_number         text,
  or_received_date  date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.payments enable row level security;
create trigger trg_payments_updated before update on public.payments
  for each row execute function public.set_updated_at();
create trigger trg_payments_ref before insert on public.payments
  for each row execute function public.assign_reference_no('PAY');
create index on public.payments (client_id);
create index on public.payments (policy_id);

create table public.commissions (
  id                 uuid primary key default gen_random_uuid(),
  policy_id          uuid references public.policies (id) on delete set null,
  client_id          uuid references public.clients (id) on delete set null,
  payment_id         uuid references public.payments (id) on delete set null,
  or_number          text,
  voucher_status     text not null default 'Not Started' check (voucher_status in (
                       'Not Started','Waiting for OR','Voucher Pending','Received','Issue / Follow-Up Required')),
  amount             numeric,
  currency           text default 'PHP',
  pacific_cross_contact_id uuid references public.external_contacts (id),
  follow_up_date     date,
  received_date      date,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.commissions enable row level security;
create trigger trg_commissions_updated before update on public.commissions
  for each row execute function public.set_updated_at();
