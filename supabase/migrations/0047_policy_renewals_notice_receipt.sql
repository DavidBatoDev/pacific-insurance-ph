-- H5a policy-driven renewal cycles; H5b carrier notice receipt is distinct from sent notice.
alter table public.renewals add column notice_received_date date;

-- Refuse to choose between staff-owned open cycles. Resolve duplicates explicitly before retrying.
do $$
declare
  duplicate_policy_ids uuid[];
begin
  select array_agg(policy_id order by policy_id) into duplicate_policy_ids
  from (
    select policy_id from public.renewals
    where status not in ('Paid', 'Renewed', 'Lapsed')
    group by policy_id having count(*) > 1
  ) duplicates;
  if duplicate_policy_ids is not null then
    raise exception 'Multiple open renewals for policy IDs: %', duplicate_policy_ids;
  end if;
end;
$$;

create unique index renewals_one_open_cycle_per_policy
  on public.renewals (policy_id)
  where status not in ('Paid', 'Renewed', 'Lapsed');

create function public.sync_policy_renewal(p_policy_id uuid)
returns table (renewal_id uuid, outcome text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  policy public.policies;
  cycle public.renewals;
  due_date date;
  product_category text;
begin
  -- Serialize trigger writes, explicit synchronization and closed-cycle checks for this policy.
  select * into policy from public.policies where id = p_policy_id for update;
  if policy.id is null or policy.status <> 'Active' then
    return query select null::uuid, 'skipped'::text;
    return;
  end if;

  select p.category into product_category
  from public.product_versions v join public.products p on p.id = v.product_id
  where v.id = policy.product_version_id;
  due_date := policy.renewal_date;
  if due_date is null and product_category is distinct from 'Travel Insurance' then
    due_date := policy.expiry_date;
  end if;
  if due_date is null then
    return query select null::uuid, 'skipped'::text;
    return;
  end if;

  -- Never recreate a completed cycle after an unrelated policy edit or repeated backfill.
  select * into cycle from public.renewals r
  where r.policy_id = policy.id and r.renewal_due_date = due_date
    and r.status in ('Paid', 'Renewed', 'Lapsed')
  order by r.id limit 1;
  if cycle.id is not null then
    return query select cycle.id, 'unchanged'::text;
    return;
  end if;

  select * into cycle from public.renewals r
  where r.policy_id = policy.id and r.status not in ('Paid', 'Renewed', 'Lapsed');
  if cycle.id is not null then
    if cycle.policy_expiry_date is distinct from policy.expiry_date
      or cycle.renewal_due_date is distinct from due_date then
      -- All workflow-owned fields, the reference and the cycle ID remain untouched.
      update public.renewals r set policy_expiry_date = policy.expiry_date,
        renewal_due_date = due_date where r.id = cycle.id;
      return query select cycle.id, 'refreshed'::text;
    else
      return query select cycle.id, 'unchanged'::text;
    end if;
    return;
  end if;

  insert into public.renewals (policy_id, client_id, policy_expiry_date, renewal_due_date, status)
  values (policy.id, policy.client_id, policy.expiry_date, due_date, 'Upcoming')
  returning id into cycle.id;
  return query select cycle.id, 'created'::text;
end;
$$;
revoke execute on function public.sync_policy_renewal(uuid) from public, anon, authenticated;
grant execute on function public.sync_policy_renewal(uuid) to service_role;

create function public.sync_policy_renewal_trigger()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.sync_policy_renewal(new.id);
  return new;
end;
$$;
revoke execute on function public.sync_policy_renewal_trigger() from public, anon, authenticated;
grant execute on function public.sync_policy_renewal_trigger() to service_role;

create trigger trg_policies_sync_renewal
  after insert or update of status, renewal_date, expiry_date, product_version_id
  on public.policies for each row execute function public.sync_policy_renewal_trigger();

-- Explicit operator backfill only: never run on page load or as part of this migration.
create function public.sync_policy_renewals()
returns table (policy_id uuid, renewal_id uuid, outcome text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  active_policy_id uuid;
begin
  for active_policy_id in select p.id from public.policies p where p.status = 'Active' order by p.id loop
    return query select active_policy_id, s.renewal_id, s.outcome
      from public.sync_policy_renewal(active_policy_id) s;
  end loop;
end;
$$;
revoke execute on function public.sync_policy_renewals() from public, anon, authenticated;
grant execute on function public.sync_policy_renewals() to service_role;
