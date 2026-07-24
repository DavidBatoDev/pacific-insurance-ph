-- 0020: Configurable external portal links for agency integrations.

create table if not exists public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  portal_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.integration_settings enable row level security;

drop trigger if exists set_integration_settings_updated_at on public.integration_settings;
create trigger set_integration_settings_updated_at
  before update on public.integration_settings
  for each row execute function public.set_updated_at();

-- Keep the row available for admin configuration without guessing a live portal URL.
insert into public.integration_settings (provider)
values ('pacific_cross')
on conflict (provider) do nothing;
