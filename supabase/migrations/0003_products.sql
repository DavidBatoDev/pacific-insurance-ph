-- 0003 products — configurable Pacific Cross product catalog.

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text check (category in (
                'Primary Medical','Group Medical','Second-Layer Medical','Travel Insurance','Other')),
  provider    text default 'Pacific Cross',
  description text,
  status      text not null default 'Active' check (status in ('Active','Inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.products enable row level security;
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_versions (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  version_name   text not null,
  effective_date date,
  expiry_date    date,
  status         text not null default 'Active' check (status in ('Active','Inactive')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.product_versions enable row level security;
create trigger trg_product_versions_updated before update on public.product_versions
  for each row execute function public.set_updated_at();
create index on public.product_versions (product_id);

create table public.plan_options (
  id                   uuid primary key default gen_random_uuid(),
  product_version_id   uuid not null references public.product_versions (id) on delete cascade,
  plan_name            text not null,
  plan_family          text,
  coverage_tier        text,
  coverage_currency    text default 'PHP',
  maximum_coverage     numeric,
  coverage_description text,
  deductible_range     text,
  status               text not null default 'Active' check (status in ('Active','Inactive')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.plan_options enable row level security;
create trigger trg_plan_options_updated before update on public.plan_options
  for each row execute function public.set_updated_at();
create index on public.plan_options (product_version_id);

create table public.add_ons (
  id                 uuid primary key default gen_random_uuid(),
  product_version_id uuid references public.product_versions (id) on delete cascade,
  plan_option_id     uuid references public.plan_options (id) on delete cascade,
  name               text not null,
  description        text,
  eligibility_rule   text,
  premium_rule       text,
  status             text not null default 'Active' check (status in ('Active','Inactive')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.add_ons enable row level security;
create trigger trg_add_ons_updated before update on public.add_ons
  for each row execute function public.set_updated_at();

create table public.discount_rules (
  id                 uuid primary key default gen_random_uuid(),
  product_version_id uuid references public.product_versions (id) on delete cascade,
  plan_option_id     uuid references public.plan_options (id) on delete cascade,
  name               text not null,
  discount_type      text,
  discount_value     numeric,
  eligibility_rule   text,
  applies_to         text,
  status             text not null default 'Active' check (status in ('Active','Inactive')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.discount_rules enable row level security;
create trigger trg_discount_rules_updated before update on public.discount_rules
  for each row execute function public.set_updated_at();

create table public.premium_tables (
  id                 uuid primary key default gen_random_uuid(),
  product_version_id uuid not null references public.product_versions (id) on delete cascade,
  plan_option_id     uuid references public.plan_options (id) on delete cascade,
  age_band           text,
  currency           text default 'PHP',
  base_premium       numeric,
  payment_mode       text check (payment_mode in ('Annual','Semi-Annual')),
  effective_date     date,
  status             text not null default 'Active' check (status in ('Active','Inactive')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.premium_tables enable row level security;
create trigger trg_premium_tables_updated before update on public.premium_tables
  for each row execute function public.set_updated_at();
create index on public.premium_tables (product_version_id, plan_option_id);
