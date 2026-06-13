-- 0002 identity — staff users, external (Pacific Cross) contacts, and clients.

-- Staff users; id mirrors auth.users so Supabase Auth drives login.
create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  reference_no  text unique,
  full_name     text not null,
  email         text not null unique,
  role          text not null default 'Assistant'
                  check (role in ('Owner','Admin','Assistant','Viewer')),
  status        text not null default 'Active'
                  check (status in ('Active','Inactive')),
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.users enable row level security;
create trigger trg_users_updated before update on public.users
  for each row execute function public.set_updated_at();
create trigger trg_users_ref before insert on public.users
  for each row execute function public.assign_reference_no('USR');

-- External contacts: Pacific Cross reps, vendors. History preserved via replacement_contact_id.
create table public.external_contacts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  organization text,
  role         text,
  contact_type text check (contact_type in (
                 'Pacific Cross Territory Sales Manager','Claims Contact',
                 'Commission Contact','Travel Contact','Vendor','Other')),
  department   text,
  email        text,
  phone        text,
  status       text not null default 'Active' check (status in ('Active','Inactive')),
  effective_date date,
  end_date       date,
  replacement_contact_id uuid references public.external_contacts (id),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.external_contacts enable row level security;
create trigger trg_external_contacts_updated before update on public.external_contacts
  for each row execute function public.set_updated_at();

-- Clients: prospects, active clients, former clients.
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  reference_no  text unique,
  first_name    text not null,
  last_name     text not null,
  date_of_birth date,
  email         text,
  mobile_number text,
  address       text,
  preferred_channel text check (preferred_channel in (
                  'Gmail','Phone','Viber','WhatsApp','iMessage','In-Person','Other')),
  client_type   text not null default 'Prospect' check (client_type in (
                  'Prospect','Individual Client','Family Client','Corporate Contact','Former Client')),
  vip_status    boolean not null default false,
  lead_source   text,
  assigned_user_id uuid references public.users (id),
  status        text not null default 'Active',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.clients enable row level security;
create trigger trg_clients_updated before update on public.clients
  for each row execute function public.set_updated_at();
create trigger trg_clients_ref before insert on public.clients
  for each row execute function public.assign_reference_no('CLI');
create index on public.clients (assigned_user_id);
create index on public.clients (last_name, first_name);
