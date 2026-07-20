-- Payments & Commissions sync (design payments-page.md).
-- Collections tab tracks expected premiums: Awaiting → Received → Verified
-- (plus Overdue). Verified + OR number starts commission tracking; the OR is
-- also stamped on the policy. Commission lifecycle gains Paid.

alter table public.payments
  add column if not exists status text not null default 'Awaiting'
    check (status in ('Awaiting','Received','Verified','Overdue'));

alter table public.policies
  add column if not exists or_number text;

alter table public.commissions
  add column if not exists estimated_amount numeric,
  add column if not exists paid_date date;
alter table public.commissions drop constraint if exists commissions_voucher_status_check;
alter table public.commissions add constraint commissions_voucher_status_check
  check (voucher_status in (
    'Not Started','Waiting for OR','Voucher Pending','Received','Issue / Follow-Up Required','Paid'));

-- Seed collections rows against the 0014 demo sources (idempotent by notes tag).
insert into public.payments (client_id, application_id, renewal_id, travel_request_id, amount, payment_method, status, or_number, payment_date, notes)
select v.client_id, v.application_id, v.renewal_id, v.travel_request_id, v.amount, v.method, v.status, v.orn, v.pay_date, v.notes
from (
  select a.client_id, a.id as application_id, null::uuid as renewal_id, null::uuid as travel_request_id,
         88000::numeric as amount, 'Business link' as method, 'Awaiting' as status, null::text as orn, null::date as pay_date, 'seed:pay-1' as notes
    from public.applications a where a.notes = 'seed:app-1'
  union all
  select a.client_id, a.id, null, null, 240000, 'Bank transfer', 'Received', null, current_date - 2, 'seed:pay-2'
    from public.applications a where a.notes = 'seed:app-2'
  union all
  select a.client_id, a.id, null, null, 134000, 'Cashier', 'Verified', 'OR-2026-88055', current_date - 10, 'seed:pay-3'
    from public.applications a where a.notes = 'seed:app-6'
  union all
  select r.client_id, null, r.id, null, 73000, 'Credit card', 'Overdue', null, null, 'seed:pay-4'
    from public.renewals r where r.notes = 'seed:ren-1'
  union all
  select r.client_id, null, r.id, null, 132000, 'Portal', 'Awaiting', null, null, 'seed:pay-5'
    from public.renewals r where r.notes = 'seed:ren-2'
  union all
  select t.client_id, null, null, t.id, 18000, 'Business link', 'Awaiting', null, null, 'seed:pay-6'
    from public.travel_requests t where t.notes = 'seed:trv-1'
  union all
  select t.client_id, null, null, t.id, 9800, 'Credit card', 'Verified', 'OR-2026-88090', current_date - 4, 'seed:pay-7'
    from public.travel_requests t where t.notes = 'seed:trv-2'
) v(client_id, application_id, renewal_id, travel_request_id, amount, method, status, orn, pay_date, notes)
where not exists (select 1 from public.payments p where p.notes = v.notes);

-- Seed commissions for the verified payments.
insert into public.commissions (client_id, payment_id, or_number, voucher_status, estimated_amount, amount, follow_up_date, notes)
select p.client_id, p.id, p.or_number, v.status, v.est, v.actual, v.follow, v.notes
from (values
  ('seed:pay-3', 'Paid'::text, 24120::numeric, 24120::numeric, null::date, 'seed:com-1'),
  ('seed:pay-7', 'Voucher Pending', 1470, null, current_date + 3, 'seed:com-2')
) as v(pay_tag, status, est, actual, follow, notes)
join public.payments p on p.notes = v.pay_tag
where not exists (select 1 from public.commissions c where c.notes = v.notes);
