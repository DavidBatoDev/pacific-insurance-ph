-- Group Accounts (design group.jsx / group-account-page.md): company-level
-- records for Group HMO with a member roster. One row per company; members
-- optionally link to a unified contact record.

create table if not exists public.group_accounts (
  id                      uuid primary key default gen_random_uuid(),
  reference_no            text unique,
  name                    text not null,
  product_version_id      uuid references public.product_versions (id),
  policy_id               uuid references public.policies (id) on delete set null,
  billing_cycle           text not null default 'Annual'
                            check (billing_cycle in ('Monthly','Quarterly','Semi-Annual','Annual')),
  premium_amount          numeric,
  status                  text not null default 'Onboarding'
                            check (status in ('Onboarding','Active','Lapsing','Lapsed')),
  primary_contact_id      uuid references public.clients (id) on delete set null,
  assigned_user_id        uuid references public.users (id),
  effective_date          date,
  expiry_date             date,
  address                 text,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
alter table public.group_accounts enable row level security;
create trigger trg_group_accounts_updated before update on public.group_accounts
  for each row execute function public.set_updated_at();
create trigger trg_group_accounts_ref before insert on public.group_accounts
  for each row execute function public.assign_reference_no('GRP');

create table if not exists public.group_members (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.group_accounts (id) on delete cascade,
  client_id     uuid references public.clients (id) on delete set null,
  full_name     text not null,
  relationship  text not null default 'Employee'
                  check (relationship in ('Principal','Employee','Dependent')),
  coverage_tier text not null default 'Standard'
                  check (coverage_tier in ('Standard','Premium','Executive')),
  ecard_status  text not null default 'Pending' check (ecard_status in ('Pending','Issued')),
  join_date     date,
  status        text not null default 'Pending' check (status in ('Active','Pending','Lapsed')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.group_members enable row level security;
create trigger trg_group_members_updated before update on public.group_members
  for each row execute function public.set_updated_at();
create index if not exists idx_group_members_group on public.group_members (group_id);

-- Seed demo groups (idempotent by name) + primary-contact clients.
insert into public.clients (first_name, last_name, email, client_type, lifecycle_stage, status)
select * from (values
  ('Regina','Ateneo','regina.ateneo@group.demo','Corporate Contact','Client','Active'),
  ('Hector','Salazar','hector.salazar@group.demo','Corporate Contact','Client','Active'),
  ('Camille','Herrera','camille.herrera@group.demo','Corporate Contact','Client','Active')
) as v(first_name,last_name,email,client_type,lifecycle_stage,status)
where not exists (select 1 from public.clients c where c.email = v.email);

insert into public.group_accounts
  (name, product_version_id, billing_cycle, premium_amount, status, primary_contact_id, effective_date, expiry_date, address)
select v.name,
       (select pv.id from public.product_versions pv join public.products p on p.id = pv.product_id where p.name = v.product limit 1),
       v.cycle, v.premium, v.status,
       (select id from public.clients where email = v.contact_email),
       v.eff, v.exp, v.address
from (values
  ('Meridian Tech Solutions','BC Flexi','Quarterly',1860000::numeric,'Active','regina.ateneo@group.demo', date '2025-10-01', current_date + 82, 'BGC, Taguig City'),
  ('Isla Grande Resorts','BC Flexi','Annual',1120000::numeric,'Onboarding','hector.salazar@group.demo', current_date - 30, current_date + 220, 'Cebu City'),
  ('Craft & Co. Manila','Select','Monthly',640000::numeric,'Lapsing','camille.herrera@group.demo', date '2024-07-21', current_date + 10, 'Makati City')
) as v(name, product, cycle, premium, status, contact_email, eff, exp, address)
where not exists (select 1 from public.group_accounts g where g.name = v.name);

insert into public.group_members (group_id, client_id, full_name, relationship, coverage_tier, ecard_status, join_date, status)
select g.id,
       case when v.contact_email is not null then (select id from public.clients where email = v.contact_email) else null end,
       v.full_name, v.relationship, v.tier, v.ecard, v.join_date, v.status
from (values
  ('Meridian Tech Solutions','Regina Ateneo','Principal','Executive','Issued', date '2025-10-01','Active','regina.ateneo@group.demo'),
  ('Meridian Tech Solutions','Paulo Mendoza','Employee','Premium','Issued', date '2025-10-01','Active',null),
  ('Meridian Tech Solutions','Celine Mendoza','Dependent','Standard','Issued', date '2025-10-01','Active',null),
  ('Meridian Tech Solutions','Arturo Villanueva','Employee','Premium','Issued', date '2025-10-01','Active',null),
  ('Meridian Tech Solutions','Beatriz Cordova','Employee','Executive','Issued', date '2025-10-01','Active',null),
  ('Meridian Tech Solutions','Enzo Fuentes','Employee','Standard','Issued', date '2025-10-01','Active',null),
  ('Meridian Tech Solutions','Marisol Fuentes','Dependent','Standard','Pending', current_date - 20,'Pending',null),
  ('Meridian Tech Solutions','Aurora Del Rosario','Employee','Standard','Pending', current_date - 10,'Pending',null),
  ('Isla Grande Resorts','Hector Salazar','Principal','Executive','Issued', current_date - 30,'Active','hector.salazar@group.demo'),
  ('Isla Grande Resorts','Nadia Ocampo','Employee','Premium','Pending', current_date - 25,'Pending',null),
  ('Isla Grande Resorts','Vince Trinidad','Employee','Standard','Pending', current_date - 25,'Active',null),
  ('Craft & Co. Manila','Camille Herrera','Principal','Premium','Issued', date '2024-07-21','Active','camille.herrera@group.demo'),
  ('Craft & Co. Manila','Gabriel Reyes','Employee','Standard','Issued', date '2024-07-21','Active',null)
) as v(group_name, full_name, relationship, tier, ecard, join_date, status, contact_email)
join public.group_accounts g on g.name = v.group_name
where not exists (
  select 1 from public.group_members m where m.group_id = g.id and m.full_name = v.full_name
);
