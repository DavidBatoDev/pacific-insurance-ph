-- 0005 operations — policies, applications, renewals, claims, travel, dependents, workflow instances.

create table public.policies (
  id                 uuid primary key default gen_random_uuid(),
  reference_no       text unique,
  client_id          uuid not null references public.clients (id) on delete restrict,
  product_id         uuid references public.products (id),
  product_version_id uuid references public.product_versions (id),
  plan_option_id     uuid references public.plan_options (id),
  policy_number      text,                       -- Pacific Cross policy number (distinct from POL- ref)
  status             text not null default 'Pending' check (status in (
                       'Pending','Active','Expired','Renewed','Cancelled','Lapsed')),
  effective_date     date,
  expiry_date        date,
  renewal_date       date,
  currency           text default 'PHP',
  premium_amount     numeric,
  payment_mode       text check (payment_mode in ('Annual','Semi-Annual')),
  assigned_user_id   uuid references public.users (id),
  pacific_cross_contact_id uuid references public.external_contacts (id),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.policies enable row level security;
create trigger trg_policies_updated before update on public.policies
  for each row execute function public.set_updated_at();
create trigger trg_policies_ref before insert on public.policies
  for each row execute function public.assign_reference_no('POL');
create index on public.policies (client_id);
create index on public.policies (status);
create index on public.policies (expiry_date);

create table public.applications (
  id                 uuid primary key default gen_random_uuid(),
  reference_no       text unique,
  client_id          uuid not null references public.clients (id) on delete restrict,
  policy_id          uuid references public.policies (id) on delete set null,
  product_version_id uuid references public.product_versions (id),
  plan_option_id     uuid references public.plan_options (id),
  application_type   text not null default 'Standard' check (application_type in (
                       'Standard','Medical Evaluation','Senior Application','Travel Insurance','Group Application')),
  status             text not null default 'Lead',   -- workflow-driven, free text
  assigned_user_id   uuid references public.users (id),
  pacific_cross_contact_id uuid references public.external_contacts (id),
  date_started            date,
  date_submitted          date,
  proposal_received_date  date,
  proposal_sent_date      date,
  payment_received_date   date,
  payment_proof_sent_date date,
  policy_issued_date      date,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.applications enable row level security;
create trigger trg_applications_updated before update on public.applications
  for each row execute function public.set_updated_at();
create trigger trg_applications_ref before insert on public.applications
  for each row execute function public.assign_reference_no('APP');
create index on public.applications (client_id);
create index on public.applications (status);

create table public.renewals (
  id                     uuid primary key default gen_random_uuid(),
  reference_no           text unique,
  policy_id              uuid not null references public.policies (id) on delete cascade,
  client_id              uuid not null references public.clients (id) on delete restrict,
  renewal_notice_date    date,
  policy_expiry_date     date,
  renewal_due_date       date,
  grace_period_end_date  date,
  status                 text not null default 'Upcoming' check (status in (
                           'Upcoming','Notice Received','Reminder Sent','Awaiting Payment','Paid',
                           'Renewed','Grace Period','Reinstatement Required','Lapsed')),
  early_payment_flag     boolean not null default false,
  renewal_payment_date   date,
  renewal_completed_date date,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
alter table public.renewals enable row level security;
create trigger trg_renewals_updated before update on public.renewals
  for each row execute function public.set_updated_at();
create trigger trg_renewals_ref before insert on public.renewals
  for each row execute function public.assign_reference_no('REN');
create index on public.renewals (policy_id);
create index on public.renewals (client_id);
create index on public.renewals (status);
create index on public.renewals (renewal_due_date);

create table public.claims (
  id                 uuid primary key default gen_random_uuid(),
  reference_no       text unique,
  client_id          uuid not null references public.clients (id) on delete restrict,
  policy_id          uuid references public.policies (id) on delete set null,
  claim_type         text,
  incident_date      date,
  claim_submitted_date date,
  pacific_cross_contact_id uuid references public.external_contacts (id),
  status             text not null default 'Draft' check (status in (
                       'Draft','Documents Pending','Submitted','Pending Review','Compliance Required',
                       'Approved','Rejected','Credited','Closed')),
  compliance_required boolean not null default false,
  compliance_due_date date,
  outcome            text,
  amount_claimed     numeric,
  amount_approved    numeric,
  currency           text default 'PHP',
  -- FlexiShield / second-layer product-specific fields (nullable)
  first_layer_exhausted       boolean,
  hmo_mbl_amount              numeric,
  remaining_eligible_expenses numeric,
  flexishield_payable_amount  numeric,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.claims enable row level security;
create trigger trg_claims_updated before update on public.claims
  for each row execute function public.set_updated_at();
create trigger trg_claims_ref before insert on public.claims
  for each row execute function public.assign_reference_no('CLM');
create index on public.claims (client_id);
create index on public.claims (policy_id);
create index on public.claims (status);

create table public.travel_requests (
  id                  uuid primary key default gen_random_uuid(),
  reference_no        text unique,
  client_id           uuid not null references public.clients (id) on delete restrict,
  product_version_id  uuid references public.product_versions (id),
  plan_option_id      uuid references public.plan_options (id),
  destination         text,
  departure_date      date,
  return_date         date,
  traveler_count      integer default 1,
  status              text not null default 'Travel Request Created',  -- workflow-driven
  quoted_premium      numeric,
  currency            text default 'PHP',
  payment_destination text,
  assigned_user_id    uuid references public.users (id),
  policy_number       text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.travel_requests enable row level security;
create trigger trg_travel_requests_updated before update on public.travel_requests
  for each row execute function public.set_updated_at();
create trigger trg_travel_requests_ref before insert on public.travel_requests
  for each row execute function public.assign_reference_no('TRV');
create index on public.travel_requests (client_id);
create index on public.travel_requests (status);

create table public.dependents (
  id                uuid primary key default gen_random_uuid(),
  primary_client_id uuid not null references public.clients (id) on delete cascade,
  policy_id         uuid references public.policies (id) on delete set null,
  full_name         text not null,
  relationship      text,
  date_of_birth     date,
  gender            text,
  email             text,
  mobile_number     text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.dependents enable row level security;
create trigger trg_dependents_updated before update on public.dependents
  for each row execute function public.set_updated_at();
create index on public.dependents (primary_client_id);

create table public.workflow_instances (
  id                   uuid primary key default gen_random_uuid(),
  workflow_template_id uuid not null references public.workflow_templates (id),
  client_id            uuid references public.clients (id) on delete cascade,
  policy_id            uuid references public.policies (id) on delete cascade,
  application_id       uuid references public.applications (id) on delete cascade,
  claim_id             uuid references public.claims (id) on delete cascade,
  renewal_id           uuid references public.renewals (id) on delete cascade,
  current_step_id      uuid references public.workflow_steps (id),
  current_status       text,
  assigned_user_id     uuid references public.users (id),
  start_date           date default current_date,
  completed_date       date,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.workflow_instances enable row level security;
create trigger trg_workflow_instances_updated before update on public.workflow_instances
  for each row execute function public.set_updated_at();
create index on public.workflow_instances (application_id);
create index on public.workflow_instances (policy_id);
create index on public.workflow_instances (claim_id);
create index on public.workflow_instances (renewal_id);
