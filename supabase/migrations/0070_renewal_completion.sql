-- Policy-first locking matches sync_policy_renewal. All evidence and trigger effects are atomic.
create function public.complete_renewal(
  p_actor_id uuid, p_renewal_id uuid,
  p_expected_updated_at timestamptz, p_new_expiry_date date
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  actor public.users%rowtype;
  policy public.policies%rowtype;
  cycle public.renewals%rowtype;
  client public.clients%rowtype;
  linked_policy_id uuid;
  next_renewal_id uuid;
  today date := (now() at time zone 'Asia/Manila')::date;
begin
  select * into actor from public.users where id = p_actor_id for share;
  if actor.id is null then raise exception 'Not authenticated.' using errcode = '42501'; end if;
  if actor.status is distinct from 'Active' then raise exception 'Your account is inactive.' using errcode = '42501'; end if;
  if actor.role is null or actor.role not in ('Owner', 'Admin', 'Assistant', 'Viewer') then
    raise exception 'Record not found.' using errcode = '42501';
  end if;
  select r.policy_id into linked_policy_id from public.renewals r where r.id = p_renewal_id;
  select * into policy from public.policies where id = linked_policy_id for update;
  if policy.id is null then raise exception 'Record not found.' using errcode = '42501'; end if;
  select * into cycle from public.renewals where id = p_renewal_id for update;
  if cycle.id is null or cycle.policy_id is distinct from policy.id or cycle.client_id is distinct from policy.client_id then
    raise exception 'Record not found.' using errcode = '42501';
  end if;
  select * into client from public.clients where id = cycle.client_id for share;
  if client.id is null or (actor.role = 'Viewer' and client.assigned_user_id is distinct from actor.id) then
    raise exception 'Record not found.' using errcode = '42501';
  end if;
  if cycle.status = 'Renewed' and policy.status = 'Active'
      and p_new_expiry_date is not null and policy.expiry_date = p_new_expiry_date
      and policy.renewal_date = p_new_expiry_date then
    return cycle.id;
  end if;
  if p_expected_updated_at is null or cycle.updated_at is distinct from p_expected_updated_at then
    raise exception 'This renewal changed. Reload and try again.' using errcode = '22023';
  end if;
  if cycle.status <> 'Paid' then
    raise exception 'Only a paid renewal can be marked renewed.' using errcode = '22023';
  end if;
  if p_new_expiry_date is null or not isfinite(p_new_expiry_date)
      or extract(year from p_new_expiry_date) not between 1 and 9999
      or p_new_expiry_date <= greatest(today, cycle.policy_expiry_date, cycle.renewal_due_date, policy.expiry_date, policy.renewal_date) then
    raise exception 'New expiry must be after the current renewal dates and today.' using errcode = '22023';
  end if;
  if exists (select 1 from public.renewals r where r.policy_id = policy.id and r.id <> cycle.id
      and r.status not in ('Paid', 'Renewed', 'Lapsed')) then
    raise exception 'A newer renewal cycle already exists. Review the policy before completing this renewal.' using errcode = '22023';
  end if;
  update public.renewals set status = 'Renewed', renewal_completed_date = today where id = cycle.id;
  update public.policies set status = 'Active', expiry_date = p_new_expiry_date, renewal_date = p_new_expiry_date where id = policy.id;
  select r.id into next_renewal_id from public.renewals r where r.policy_id = policy.id
    and r.status = 'Upcoming' and r.renewal_due_date = p_new_expiry_date;
  if next_renewal_id is null then raise exception 'Next renewal cycle was not created.' using errcode = '22023'; end if;
  insert into public.audit_logs(actor_id, action, table_name, record_id, previous_value, new_value)
  values(p_actor_id, 'renewal.completed', 'renewals', cycle.id,
    jsonb_build_object('status', cycle.status, 'renewal_completed_date', cycle.renewal_completed_date),
    jsonb_build_object('status', 'Renewed', 'renewal_completed_date', today)),
    (p_actor_id, 'renewal.completed', 'policies', policy.id,
    jsonb_build_object('status', policy.status, 'expiry_date', policy.expiry_date, 'renewal_date', policy.renewal_date),
    jsonb_build_object('status', 'Active', 'expiry_date', p_new_expiry_date, 'renewal_date', p_new_expiry_date));
  insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id, client_visible, metadata)
  values('client', client.id, 'renewal.completed',
    'Renewal completed — ' || coalesce(nullif(policy.policy_number, ''), policy.reference_no, cycle.reference_no, policy.id::text)
      || ' · new expiry ' || p_new_expiry_date::text,
    p_actor_id, false, jsonb_build_object('renewal_id', cycle.id, 'policy_id', policy.id, 'next_renewal_id', next_renewal_id));
  return cycle.id;
end;
$$;
revoke execute on function public.complete_renewal(uuid, uuid, timestamptz, date) from public, anon, authenticated;
grant execute on function public.complete_renewal(uuid, uuid, timestamptz, date) to service_role;

create function public.lapse_renewal(
  p_actor_id uuid, p_renewal_id uuid, p_expected_updated_at timestamptz
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  actor public.users%rowtype;
  policy public.policies%rowtype;
  cycle public.renewals%rowtype;
  client public.clients%rowtype;
  linked_policy_id uuid;
  today date := (now() at time zone 'Asia/Manila')::date;
begin
  select * into actor from public.users where id = p_actor_id for share;
  if actor.id is null then raise exception 'Not authenticated.' using errcode = '42501'; end if;
  if actor.status is distinct from 'Active' then raise exception 'Your account is inactive.' using errcode = '42501'; end if;
  if actor.role is null or actor.role not in ('Owner', 'Admin', 'Assistant', 'Viewer') then
    raise exception 'Record not found.' using errcode = '42501';
  end if;
  select r.policy_id into linked_policy_id from public.renewals r where r.id = p_renewal_id;
  select * into policy from public.policies where id = linked_policy_id for update;
  if policy.id is null then raise exception 'Record not found.' using errcode = '42501'; end if;
  select * into cycle from public.renewals where id = p_renewal_id for update;
  if cycle.id is null or cycle.policy_id is distinct from policy.id or cycle.client_id is distinct from policy.client_id then
    raise exception 'Record not found.' using errcode = '42501';
  end if;
  select * into client from public.clients where id = cycle.client_id for share;
  if client.id is null or (actor.role = 'Viewer' and client.assigned_user_id is distinct from actor.id) then
    raise exception 'Record not found.' using errcode = '42501';
  end if;
  if cycle.status = 'Lapsed' then return cycle.id; end if;
  if p_expected_updated_at is null or cycle.updated_at is distinct from p_expected_updated_at then
    raise exception 'This renewal changed. Reload and try again.' using errcode = '22023';
  end if;
  if cycle.status in ('Paid', 'Renewed') then
    raise exception 'A paid or renewed renewal cannot be lapsed.' using errcode = '22023';
  end if;
  if cycle.renewal_due_date is null or cycle.renewal_due_date >= today then
    raise exception 'Only an overdue renewal can be marked lapsed.' using errcode = '22023';
  end if;
  update public.renewals set status = 'Lapsed' where id = cycle.id;
  insert into public.audit_logs(actor_id, action, table_name, record_id, previous_value, new_value)
  values(p_actor_id, 'renewal.lapsed', 'renewals', cycle.id,
    jsonb_build_object('status', cycle.status), jsonb_build_object('status', 'Lapsed'));
  insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id, client_visible, metadata)
  values('client', client.id, 'renewal.lapsed',
    'Renewal lapsed — ' || coalesce(nullif(policy.policy_number, ''), policy.reference_no, cycle.reference_no, policy.id::text)
      || ' · was due ' || cycle.renewal_due_date::text,
    p_actor_id, false, jsonb_build_object('renewal_id', cycle.id, 'policy_id', policy.id));
  return cycle.id;
end;
$$;
revoke execute on function public.lapse_renewal(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.lapse_renewal(uuid, uuid, timestamptz) to service_role;
