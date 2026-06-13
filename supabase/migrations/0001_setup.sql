-- 0001 setup — extensions, shared triggers, and the reference-number generator.
-- Applied via the Supabase MCP (apply_migration). Kept here for version control.

create extension if not exists pgcrypto;

-- Maintain updated_at automatically on tables that have the column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Monotonic per-(entity, year) counters backing human-readable reference numbers.
create table public.reference_counters (
  entity  text    not null,
  year    integer not null,
  counter integer not null default 0,
  primary key (entity, year)
);
alter table public.reference_counters enable row level security;

-- next_reference('CLI') -> 'CLI-2026-00001'
create or replace function public.next_reference(prefix text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  y integer := extract(year from now())::integer;
  n integer;
begin
  insert into public.reference_counters as rc (entity, year, counter)
  values (prefix, y, 1)
  on conflict (entity, year)
  do update set counter = rc.counter + 1
  returning rc.counter into n;

  return prefix || '-' || y::text || '-' || lpad(n::text, 5, '0');
end;
$$;

-- BEFORE INSERT trigger; the entity prefix is passed as the trigger argument.
create or replace function public.assign_reference_no()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.reference_no is null then
    new.reference_no := public.next_reference(tg_argv[0]);
  end if;
  return new;
end;
$$;
