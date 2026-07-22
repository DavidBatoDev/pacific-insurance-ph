-- 0019: Phase E parity — structured discovery capture + Official Payment Channels
--
-- 1. clients gains the two remaining discovery fields the Log Call tab writes
--    (est_premium and product_interest already exist from 0013).
-- 2. payment_channels backs Settings → Payment Channels and the Send Payment
--    Links payee picker — official business accounts only, never personal.

alter table public.clients add column if not exists family_size integer;
alter table public.clients add column if not exists coverage_tier text;

create table if not exists public.payment_channels (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  channel_type text not null default 'Company Bank'
    check (channel_type in ('GCash for Business', 'Company Bank')),
  account_name text not null,
  account_number text not null,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_channels enable row level security;

drop trigger if exists set_payment_channels_updated_at on public.payment_channels;
create trigger set_payment_channels_updated_at
  before update on public.payment_channels
  for each row execute function public.set_updated_at();

-- Design seed channels (settings.jsx) — idempotent on label.
insert into public.payment_channels (label, channel_type, account_name, account_number, is_default, active)
select v.label, v.channel_type, v.account_name, v.account_number, v.is_default, v.active
from (values
  ('Pacific GCash for Business', 'GCash for Business', 'Pacific Insurance PH Inc.', '0917 888 2100', true, true),
  ('BPI Corporate Current', 'Company Bank', 'Pacific Insurance PH Inc.', 'BPI · 1234-5678-90', false, true),
  ('BDO Collections', 'Company Bank', 'Pacific Insurance PH Inc.', 'BDO · 0055-2211-88', false, false)
) as v(label, channel_type, account_name, account_number, is_default, active)
where not exists (select 1 from public.payment_channels p where p.label = v.label);
