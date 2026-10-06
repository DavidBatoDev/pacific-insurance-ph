-- 0042: Phase H H9a — commission rates per product and business type.
--
-- Replaces the hardcoded COMM_RATE map in app/(app)/payments/actions.ts, which was keyed by
-- payment source and matched none of the client's rates. Rates are effective-dated so a change
-- never rewrites the basis of a past estimate, and a null rate means "pending" (HMO's rate was
-- still to be confirmed by Eman at the 2026-10-02 review). 0041 is reserved for the D1 import
-- schema, so this starts at 0042.
--
-- The VAT / withholding-tax formula is H9b and is not applied here (see the DH16 assumption in
-- TO-BE-UPDATE-PLAN.md and docs/development-alignment.md).

create table if not exists public.commission_rates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  business_type text not null check (business_type in ('New', 'Renewal')),
  rate_pct numeric(5,2) check (rate_pct between 0 and 100),
  effective_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, business_type, effective_date)
);

alter table public.commission_rates enable row level security;

drop trigger if exists set_commission_rates_updated_at on public.commission_rates;
create trigger set_commission_rates_updated_at
  before update on public.commission_rates
  for each row execute function public.set_updated_at();

-- Rates given at the 2026-10-02 module review. Products resolve by their stable source_key so
-- the seed does not depend on per-environment uuids; idempotent on the unique key.
insert into public.commission_rates (product_id, business_type, rate_pct, effective_date, notes)
select p.id, v.business_type, v.rate_pct, date '2026-10-02', v.notes
from (values
  ('pacific-cross-select',      'New',     20.0::numeric, 'Oct 2 meeting (Select Plus and Standard)'),
  ('pacific-cross-select',      'Renewal', 20.0,          'Oct 2 meeting (Select Plus and Standard)'),
  ('pacific-cross-blue-royale', 'New',     22.5,          'Oct 2 meeting'),
  ('pacific-cross-blue-royale', 'Renewal', 20.0,          'Oct 2 meeting'),
  ('pacific-cross-travelsafe',  'New',     30.0,          'Oct 2 meeting'),
  ('pacific-cross-travelsafe',  'Renewal', 30.0,          'Oct 2 meeting'),
  ('pacific-cross-bc-flexi',    'New',     null,          'Pending — ask Eman (HMO)'),
  ('pacific-cross-bc-flexi',    'Renewal', null,          'Pending — ask Eman (HMO)'),
  ('pacific-cross-flexishield', 'New',     null,          'Not given in the Oct 2 meeting'),
  ('pacific-cross-flexishield', 'Renewal', null,          'Not given in the Oct 2 meeting')
) as v(source_key, business_type, rate_pct, notes)
join public.products p on p.source_key = v.source_key
on conflict (product_id, business_type, effective_date) do nothing;

-- Every estimate records the rate behind it, so a later rate change stays auditable.
alter table public.commissions add column if not exists rate_pct numeric(5,2);
alter table public.commissions add column if not exists commission_rate_id uuid
  references public.commission_rates(id) on delete set null;
