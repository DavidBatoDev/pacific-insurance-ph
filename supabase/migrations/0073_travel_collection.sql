-- Every Travel request needs a client collection (client → agency) in the payments ledger so staff
-- can record the client's payment from the Travel workflow. The wizard used to create one only
-- when a premium was quoted, so trips with an unknown premium had nothing to record against.
--
-- Get-or-create under a row lock on the trip: two concurrent callers (two tabs, or the wizard and
-- the workflow) serialize on the travel request and both receive the same, earliest collection.
-- Existing payments are never modified, merged or deleted, and nothing is inferred: a new row is
-- Awaiting, with the quoted premium when positive, otherwise no amount. Currency keeps its default.
create or replace function public.ensure_travel_collection(p_travel_request_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  trip record;
  payment_id uuid;
begin
  select id, client_id, quoted_premium into trip
  from public.travel_requests
  where id = p_travel_request_id
  for update;
  if not found then
    raise exception 'Travel request not found.' using errcode = 'P0002';
  end if;

  select id into payment_id
  from public.payments
  where travel_request_id = trip.id
  order by created_at, id
  limit 1;
  if payment_id is not null then
    return payment_id;
  end if;

  insert into public.payments (client_id, travel_request_id, amount, status, notes)
  values (
    trip.client_id,
    trip.id,
    case when trip.quoted_premium > 0 then trip.quoted_premium end,
    'Awaiting',
    'Travel collection created by application workflow'
  )
  returning id into payment_id;
  return payment_id;
end;
$$;

revoke execute on function public.ensure_travel_collection(uuid) from public, anon, authenticated;
grant execute on function public.ensure_travel_collection(uuid) to service_role;
