-- H8a: every new renewal cycle gets one Awaiting collection row.
-- The amount snapshots the policy premium when known; staff records it before verification when it is not.
create or replace function public.create_renewal_awaiting_payment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  policy_premium numeric;
begin
  select premium_amount into policy_premium from public.policies where id = new.policy_id;

  if not exists (select 1 from public.payments where renewal_id = new.id) then
    insert into public.payments (client_id, renewal_id, amount, status, notes)
    values (
      new.client_id,
      new.id,
      policy_premium,
      'Awaiting',
      'Renewal payment created from policy premium'
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.create_renewal_awaiting_payment() from public, anon, authenticated;
grant execute on function public.create_renewal_awaiting_payment() to service_role;

drop trigger if exists trg_renewals_create_awaiting_payment on public.renewals;
create trigger trg_renewals_create_awaiting_payment
  after insert on public.renewals
  for each row execute function public.create_renewal_awaiting_payment();
