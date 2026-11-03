-- H8d: create collection rows per renewal installment, based on the policy's
-- payment mode (with the proposal frequency retained on the client as fallback).
alter table public.payments
  add column if not exists installment_number smallint,
  add column if not exists installment_count smallint;

alter table public.payments
  drop constraint if exists payments_installment_position_check;
alter table public.payments
  add constraint payments_installment_position_check
  check (
    (installment_number is null and installment_count is null)
    or (
      installment_number >= 1
      and installment_count >= 1
      and installment_number <= installment_count
    )
  );

create unique index if not exists payments_renewal_installment_number_key
  on public.payments (renewal_id, installment_number)
  where renewal_id is not null and installment_number is not null;

create or replace function public.create_renewal_awaiting_payment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  policy_premium numeric;
  policy_currency text;
  payment_mode text;
  installment_count smallint;
begin
  select p.premium_amount, p.currency, coalesce(p.payment_mode, c.payment_frequency)
    into policy_premium, policy_currency, payment_mode
    from public.policies p
    join public.clients c on c.id = p.client_id
    where p.id = new.policy_id;

  installment_count := case when lower(payment_mode) = 'semi-annual' then 2 else 1 end;

  if not exists (select 1 from public.payments where renewal_id = new.id) then
    insert into public.payments (
      client_id, renewal_id, amount, currency, status, installment_number, installment_count, notes
    )
    select
      new.client_id,
      new.id,
      case when policy_premium is null then null else policy_premium / installment_count end,
      coalesce(policy_currency, 'PHP'),
      'Awaiting',
      installment_number,
      installment_count,
      format('Renewal installment %s of %s created from policy premium', installment_number, installment_count)
    from generate_series(1, installment_count) as installment_number;
  end if;

  return new;
end;
$$;

revoke execute on function public.create_renewal_awaiting_payment() from public, anon, authenticated;
grant execute on function public.create_renewal_awaiting_payment() to service_role;
