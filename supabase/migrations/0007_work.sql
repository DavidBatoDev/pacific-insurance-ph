-- 0007 work — tasks, communications, relationship management, referrals.

create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  reference_no     text unique,
  title            text not null,
  task_type        text check (task_type in (
                     'Follow-Up','Missing Document','Renewal Reminder','Claim Follow-Up',
                     'Payment Follow-Up','Commission Follow-Up','Relationship Activity')),
  client_id        uuid references public.clients (id) on delete cascade,
  policy_id        uuid references public.policies (id) on delete set null,
  application_id   uuid references public.applications (id) on delete set null,
  renewal_id       uuid references public.renewals (id) on delete set null,
  claim_id         uuid references public.claims (id) on delete set null,
  assigned_user_id uuid references public.users (id),
  due_date         date,
  priority         text default 'Normal' check (priority in ('Low','Normal','High','Urgent')),
  status           text not null default 'Open' check (status in ('Open','In Progress','Completed','Cancelled')),
  completed_date   date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.tasks enable row level security;
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger trg_tasks_ref before insert on public.tasks
  for each row execute function public.assign_reference_no('TSK');
create index on public.tasks (assigned_user_id);
create index on public.tasks (status);
create index on public.tasks (due_date);

create table public.communications (
  id                uuid primary key default gen_random_uuid(),
  reference_no      text unique,
  client_id         uuid references public.clients (id) on delete cascade,
  policy_id         uuid references public.policies (id) on delete set null,
  application_id    uuid references public.applications (id) on delete set null,
  renewal_id        uuid references public.renewals (id) on delete set null,
  claim_id          uuid references public.claims (id) on delete set null,
  travel_request_id uuid references public.travel_requests (id) on delete set null,
  direction         text check (direction in ('Inbound','Outbound')),
  channel           text check (channel in (
                      'Gmail','Phone','Viber','WhatsApp','iMessage','In-Person','SMS','Other')),
  subject           text,
  summary           text,
  occurred_at       timestamptz not null default now(),
  related_user_id   uuid references public.users (id),
  external_contact_id uuid references public.external_contacts (id),
  email_thread_id   text,
  delivery_status   text,            -- outbound messaging: queued / sent / delivered / failed
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.communications enable row level security;
create trigger trg_communications_updated before update on public.communications
  for each row execute function public.set_updated_at();
create trigger trg_communications_ref before insert on public.communications
  for each row execute function public.assign_reference_no('COM');
create index on public.communications (client_id);
create index on public.communications (channel);

create table public.relationship_event_types (
  id             uuid primary key default gen_random_uuid(),
  event_name     text not null,
  description    text,
  trigger_type   text,
  default_timing text,
  default_action text,
  status         text not null default 'Active' check (status in ('Active','Inactive')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.relationship_event_types enable row level security;
create trigger trg_relationship_event_types_updated before update on public.relationship_event_types
  for each row execute function public.set_updated_at();

create table public.relationship_activities (
  id                uuid primary key default gen_random_uuid(),
  reference_no      text unique,
  client_id         uuid not null references public.clients (id) on delete cascade,
  policy_id         uuid references public.policies (id) on delete set null,
  event_type_id     uuid references public.relationship_event_types (id),
  activity_date     date,
  action_type       text check (action_type in ('Email','Call','Gift','Card','Reminder','Manual Follow-Up')),
  assigned_user_id  uuid references public.users (id),
  status            text not null default 'Planned' check (status in ('Planned','Completed','Cancelled')),
  cost              numeric,
  vendor_contact_id uuid references public.external_contacts (id),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.relationship_activities enable row level security;
create trigger trg_relationship_activities_updated before update on public.relationship_activities
  for each row execute function public.set_updated_at();
create trigger trg_relationship_activities_ref before insert on public.relationship_activities
  for each row execute function public.assign_reference_no('REL');
create index on public.relationship_activities (client_id);

create table public.referrals (
  id                    uuid primary key default gen_random_uuid(),
  referring_client_id   uuid references public.clients (id) on delete set null,
  referred_person_name  text,
  referred_person_contact text,
  referral_date         date,
  status                text not null default 'New' check (status in (
                          'New','Contacted','In Progress','Converted','Not Converted')),
  converted_client_id   uuid references public.clients (id) on delete set null,
  thank_you_activity_id uuid references public.relationship_activities (id) on delete set null,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.referrals enable row level security;
create trigger trg_referrals_updated before update on public.referrals
  for each row execute function public.set_updated_at();
