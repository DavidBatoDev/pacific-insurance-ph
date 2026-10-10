-- H5c-e: staff tasks and drafts only. No provider delivery and no renewal-status advancement.
create table public.renewal_email_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique check (rule_key in ('notice_received','client_reminder','missing_notice','premium_breakdown')),
  name text not null,
  date_basis text not null check (date_basis in ('renewal_due_date','notice_received_date')),
  offset_days smallint not null,
  recipient text not null check (recipient in ('client','carrier')),
  external_contact_id uuid references public.external_contacts(id),
  template_id uuid not null references public.email_templates(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((rule_key in ('notice_received','client_reminder') and recipient = 'client' and external_contact_id is null)
    or (rule_key in ('missing_notice','premium_breakdown') and recipient = 'carrier')),
  check (rule_key <> 'notice_received' or (date_basis = 'notice_received_date' and offset_days = 0)),
  check (rule_key <> 'missing_notice' or date_basis = 'renewal_due_date')
);
create trigger trg_renewal_email_rules_updated before update on public.renewal_email_rules
  for each row execute function public.set_updated_at();
alter table public.renewal_email_rules enable row level security;
revoke all on public.renewal_email_rules from anon, authenticated;
grant all on public.renewal_email_rules to service_role;

create table public.renewal_email_drafts (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.renewal_email_rules(id),
  renewal_id uuid not null references public.renewals(id) on delete cascade,
  task_id uuid not null unique references public.tasks(id) on delete restrict,
  due_date date not null,
  recipient_email text,
  external_contact_id uuid references public.external_contacts(id),
  subject text not null,
  body text not null,
  merge_context jsonb not null,
  edited_subject text,
  edited_body text,
  status text not null default 'Draft' check (status in ('Draft','Logged','Dismissed')),
  dismissal_reason text,
  communication_id uuid unique references public.communications(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (renewal_id,rule_id),
  check ((status = 'Logged') = (communication_id is not null))
);
create trigger trg_renewal_email_drafts_updated before update on public.renewal_email_drafts
  for each row execute function public.set_updated_at();
alter table public.renewal_email_drafts enable row level security;
revoke all on public.renewal_email_drafts from anon, authenticated;
grant all on public.renewal_email_drafts to service_role;
create index on public.renewal_email_drafts(status,due_date);

-- Dedicated, editable copy: the pre-existing manual reminder is not overwritten.
insert into public.email_templates (template_name,channel,subject,body,status)
select v.name,'Email',v.subject,v.body,'Active'
from (values
  ('Renewal notice received','Renewal notice received — {{policy_number}}',E'Hi {{first_name}},\n\nWe received Pacific Cross\'s renewal notice for your {{product}} policy ({{policy_number}}). Your renewal date is {{renewal_date}}.\n\nWe will help you review the renewal terms and next steps. Please reply with any questions.\n\n{{agent}}'),
  ('Renewal client reminder','Renewal reminder — {{policy_number}}',E'Hi {{first_name}},\n\nYour {{product}} policy ({{policy_number}}) is due for renewal on {{renewal_date}}. Please let us know whether you would like to proceed so we can help you review the renewal terms and payment instructions.\n\n{{agent}}'),
  ('Renewal notice request','Request renewal notice — {{policy_number}}',E'Hi {{recipient_name}},\n\nPlease provide the renewal notice for {{client_name}}\'s {{product}} policy ({{policy_number}}), due for renewal on {{renewal_date}}. We have not yet recorded receipt of the notice.\n\nThank you,\n{{agent}}'),
  ('Renewal premium breakdown request','Request renewal premium breakdown — {{policy_number}}',E'Hi {{recipient_name}},\n\nPlease provide the premium breakdown, including fees and any loadings, for {{client_name}}\'s {{product}} policy ({{policy_number}}), due for renewal on {{renewal_date}}. We need the breakdown for this renewal whether or not the premium has changed.\n\nThank you,\n{{agent}}')
) v(name,subject,body)
where not exists (select 1 from public.email_templates t where t.template_name = v.name and t.channel = 'Email' and t.status = 'Active');

insert into public.renewal_email_rules (rule_key,name,date_basis,offset_days,recipient,external_contact_id,template_id,active)
select v.key,v.name,v.basis,v.offset_days,v.recipient,
  case when v.recipient = 'carrier' then officer.id end,t.id,
  v.recipient = 'client' or officer.id is not null
from (values
  ('notice_received','Client notice receipt','notice_received_date',0,'client','Renewal notice received'),
  ('client_reminder','Client renewal reminder','renewal_due_date',-30,'client','Renewal client reminder'),
  ('missing_notice','Carrier notice request','renewal_due_date',-60,'carrier','Renewal notice request'),
  ('premium_breakdown','Carrier premium breakdown request','renewal_due_date',-60,'carrier','Renewal premium breakdown request')
) v(key,name,basis,offset_days,recipient,template_name)
cross join lateral (select et.id from public.email_templates et
  where et.template_name = v.template_name and et.channel = 'Email' and et.status = 'Active'
  order by et.created_at,et.id limit 1) t
left join lateral (select ec.id from public.external_contacts ec
  where ec.name = 'Thea Opura' and ec.status = 'Active' and nullif(btrim(ec.email),'') is not null
    and (select count(*) from public.external_contacts e where e.name = 'Thea Opura'
      and e.status = 'Active' and nullif(btrim(e.email),'') is not null) = 1) officer on true;

-- One eligibility definition shared by cron, receipt-trigger execution and manual logging.
create function public.renewal_email_due_date(p_rule_id uuid,p_renewal_id uuid)
returns date language sql stable security invoker set search_path = public as $$
  select (case when er.date_basis = 'notice_received_date' then r.notice_received_date else r.renewal_due_date end) + er.offset_days
  from public.renewal_email_rules er
  join public.email_templates et on et.id = er.template_id
  cross join public.renewals r
  join public.policies p on p.id = r.policy_id
  join public.clients c on c.id = r.client_id
  left join public.external_contacts ec on ec.id = er.external_contact_id
  where er.id = p_rule_id and r.id = p_renewal_id and er.active
    and et.status = 'Active' and et.channel = 'Email'
    and p.status = 'Active' and r.status not in ('Paid','Renewed','Lapsed')
    and c.status = 'Active' and c.lifecycle_stage <> 'Lost' and not c.do_not_contact
    and (er.rule_key <> 'client_reminder' or not c.early_payer)
    and (er.rule_key <> 'missing_notice' or r.notice_received_date is null)
    and (er.recipient = 'client' or (ec.status = 'Active' and nullif(btrim(ec.email),'') is not null));
$$;
revoke execute on function public.renewal_email_due_date(uuid,uuid) from public,anon,authenticated;
grant execute on function public.renewal_email_due_date(uuid,uuid) to service_role;

create function public.queue_due_renewal_emails(p_renewal_id uuid default null)
returns table (draft_id uuid,task_id uuid,renewal_id uuid,rule_key text,outcome text)
language plpgsql security invoker set search_path = public as $$
declare
  cycle_id uuid;
  cycle public.renewals;
  rule public.renewal_email_rules;
  draft public.renewal_email_drafts;
  due date;
  today date := (now() at time zone 'Asia/Manila')::date;
  context jsonb;
  recipient_address text;
  owner_id uuid;
  new_task_id uuid;
begin
  -- Lock in stable order. Receipt writes hold the same renewal lock; no policy lock inversion.
  for cycle_id in select r.id from public.renewals r
    where p_renewal_id is null or r.id = p_renewal_id order by r.id loop
    select * into cycle from public.renewals r where r.id = cycle_id for update;
    if cycle.id is null then continue; end if;
    for rule in select er.* from public.renewal_email_rules er order by er.id loop
      due := public.renewal_email_due_date(rule.id,cycle.id);
      select * into draft from public.renewal_email_drafts d
        where d.renewal_id = cycle.id and d.rule_id = rule.id for update;
      if draft.id is not null and draft.status <> 'Draft' then
        return query select draft.id,draft.task_id,cycle.id,rule.rule_key,'unchanged'::text;
        continue;
      end if;
      if due is null then
        if draft.id is not null then
          update public.renewal_email_drafts d set status = 'Dismissed',
            dismissal_reason = 'No longer eligible: check rule, contact, receipt, payment or policy status.' where d.id = draft.id;
          update public.tasks t set status = 'Cancelled' where t.id = draft.task_id and t.status in ('Open','In Progress');
          return query select draft.id,draft.task_id,cycle.id,rule.rule_key,'dismissed'::text;
        end if;
        continue;
      end if;
      if draft.id is null and due > today then continue; end if;
      select jsonb_build_object(
        'first_name',c.first_name,'client_name',concat_ws(' ',c.first_name,c.last_name),
        'product',pr.name,'policy_number',coalesce(nullif(p.policy_number,''),p.reference_no),
        'reference',coalesce(nullif(p.policy_number,''),p.reference_no),
        'renewal_date',to_char(cycle.renewal_due_date,'YYYY-MM-DD'),
        'notice_received_date',to_char(cycle.notice_received_date,'YYYY-MM-DD'),
        'recipient_name',case when rule.recipient = 'carrier' then ec.name else c.first_name end,
        'premium','to be confirmed','agent',coalesce(u.full_name,'Pacific Insurance PH')),
        case when rule.recipient = 'carrier' then ec.email else c.email end,
        u.id
      into context,recipient_address,owner_id
      from public.policies p join public.clients c on c.id = cycle.client_id
      left join public.product_versions pv on pv.id = p.product_version_id
      left join public.products pr on pr.id = coalesce(pv.product_id,p.product_id)
      left join public.external_contacts ec on ec.id = rule.external_contact_id
      left join public.users u on u.id = coalesce(p.assigned_user_id,c.assigned_user_id)
        and u.status = 'Active' and u.role in ('Owner','Admin','Assistant')
      where p.id = cycle.policy_id;
      if draft.id is not null then
        -- Refresh source facts and timing, never overwrite staff-edited copy/recipient or completion.
        if draft.due_date is distinct from due or draft.merge_context is distinct from context then
          update public.renewal_email_drafts d set due_date = due,merge_context = context where d.id = draft.id;
          update public.tasks t set due_date = due where t.id = draft.task_id and t.due_date is distinct from due;
          return query select draft.id,draft.task_id,cycle.id,rule.rule_key,'refreshed'::text;
        else
          return query select draft.id,draft.task_id,cycle.id,rule.rule_key,'unchanged'::text;
        end if;
        continue;
      end if;
      insert into public.tasks (title,task_type,client_id,policy_id,renewal_id,assigned_user_id,due_date,notes)
        values ('Review renewal email — ' || rule.name,'Renewal',cycle.client_id,cycle.policy_id,cycle.id,owner_id,due,
          'Draft for staff review only. No email delivery. Open the linked draft to review, log or dismiss it.') returning id into new_task_id;
      insert into public.renewal_email_drafts (rule_id,renewal_id,task_id,due_date,recipient_email,external_contact_id,subject,body,merge_context)
        select rule.id,cycle.id,new_task_id,due,nullif(btrim(recipient_address),''),rule.external_contact_id,
          coalesce(et.subject,''),coalesce(et.body,''),context from public.email_templates et where et.id = rule.template_id
        returning * into draft;
      return query select draft.id,new_task_id,cycle.id,rule.rule_key,'queued'::text;
    end loop;
  end loop;
end;
$$;
revoke execute on function public.queue_due_renewal_emails(uuid) from public,anon,authenticated;
grant execute on function public.queue_due_renewal_emails(uuid) to service_role;

create function public.queue_renewal_receipt_emails_trigger()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  -- Recording receipt is immediate, transactional and independent of the daily cron.
  if new.notice_received_date is not null or tg_op = 'UPDATE' then
    perform public.queue_due_renewal_emails(new.id);
  end if;
  return new;
end;
$$;
revoke execute on function public.queue_renewal_receipt_emails_trigger() from public,anon,authenticated;
grant execute on function public.queue_renewal_receipt_emails_trigger() to service_role;
create trigger trg_renewals_queue_email after insert or update of notice_received_date,status,renewal_due_date
  on public.renewals for each row execute function public.queue_renewal_receipt_emails_trigger();

-- Logging and completion are one transaction; locks serialize edits, dismissals and repeated logs.
create function public.update_renewal_email_draft(
  p_draft_id uuid,p_actor_id uuid,p_operation text,p_expected_updated_at timestamptz,
  p_recipient_email text default null,p_subject text default null,p_body text default null)
returns public.renewal_email_drafts language plpgsql security invoker set search_path = public as $$
declare
  draft public.renewal_email_drafts;
  cycle public.renewals;
  due date;
  communication uuid;
begin
  if not exists (select 1 from public.users u where u.id = p_actor_id and u.status = 'Active' and u.role in ('Owner','Admin','Assistant')) then
    raise exception 'Renewal drafts are available to Admin and Staff only.';
  end if;
  select r.* into cycle from public.renewals r join public.renewal_email_drafts d on d.renewal_id = r.id
    where d.id = p_draft_id for update of r;
  if cycle.id is null then raise exception 'Renewal draft not found.'; end if;
  select * into draft from public.renewal_email_drafts d where d.id = p_draft_id for update;
  if p_operation not in ('save','log','dismiss') then raise exception 'Invalid draft operation.'; end if;
  -- Safe retry of an already committed log: never creates another communication or changes copy.
  if p_operation = 'log' and draft.status = 'Logged' then return draft; end if;
  if draft.status <> 'Draft' then raise exception 'This draft is already logged or dismissed.'; end if;
  if p_expected_updated_at is null or draft.updated_at is distinct from p_expected_updated_at then
    raise exception 'This draft changed. Reload it before saving, logging or dismissing.';
  end if;
  if p_operation = 'dismiss' then
    update public.renewal_email_drafts d set status = 'Dismissed',dismissal_reason = 'Dismissed by staff.'
      where d.id = draft.id returning * into draft;
    update public.tasks t set status = 'Cancelled' where t.id = draft.task_id and t.status in ('Open','In Progress');
    return draft;
  end if;
  if nullif(btrim(p_recipient_email),'') is null or p_recipient_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or nullif(btrim(p_subject),'') is null or nullif(btrim(p_body),'') is null then
    raise exception 'Recipient email, subject and body are required.';
  end if;
  if p_operation = 'log' then
    due := public.renewal_email_due_date(draft.rule_id,cycle.id);
    if due is null or due > (now() at time zone 'Asia/Manila')::date then
      raise exception 'This draft is no longer due. Check the rule, contact, receipt, payment or policy status.';
    end if;
    insert into public.communications (client_id,policy_id,renewal_id,direction,channel,subject,summary,notes,
      related_user_id,external_contact_id,delivery_status)
      values (cycle.client_id,cycle.policy_id,cycle.id,'Outbound','Gmail',btrim(p_subject),
        'Renewal email logged only — no provider delivery. To: ' || btrim(p_recipient_email),p_body,
        p_actor_id,draft.external_contact_id,'logged') returning id into communication;
  end if;
  if p_operation = 'log' or draft.recipient_email is distinct from btrim(p_recipient_email)
    or draft.edited_subject is distinct from btrim(p_subject) or draft.edited_body is distinct from p_body then
    update public.renewal_email_drafts d set recipient_email = btrim(p_recipient_email),edited_subject = btrim(p_subject),edited_body = p_body,
      status = case when p_operation = 'log' then 'Logged' else 'Draft' end,
      communication_id = communication where d.id = draft.id returning * into draft;
  end if;
  if p_operation = 'log' then
    update public.tasks t set status = 'Completed',completed_date = (now() at time zone 'Asia/Manila')::date where t.id = draft.task_id;
  end if;
  return draft;
end;
$$;
revoke execute on function public.update_renewal_email_draft(uuid,uuid,text,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.update_renewal_email_draft(uuid,uuid,text,timestamptz,text,text,text) to service_role;
-- No queue/backfill runs during migration. Cron or the explicit Admin action evaluates existing renewals.
