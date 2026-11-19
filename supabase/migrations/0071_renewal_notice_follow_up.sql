-- Carrier notice follow-up: one staff-reviewed draft N days after the carrier notice request was
-- sent (or logged), only while the renewal notice is still missing. Same one-draft-per-cycle,
-- review-before-send lifecycle as the other renewal rules; a dismissed request never follows up.
alter table public.renewal_email_rules drop constraint renewal_email_rules_rule_key_check;
alter table public.renewal_email_rules add constraint renewal_email_rules_rule_key_check
  check (rule_key in ('notice_received','client_reminder','missing_notice','missing_notice_follow_up','premium_breakdown'));
alter table public.renewal_email_rules drop constraint renewal_email_rules_check;
alter table public.renewal_email_rules add constraint renewal_email_rules_check
  check ((rule_key in ('notice_received','client_reminder') and recipient = 'client' and external_contact_id is null)
    or (rule_key in ('missing_notice','missing_notice_follow_up','premium_breakdown') and recipient = 'carrier'));
alter table public.renewal_email_rules drop constraint renewal_email_rules_date_basis_check;
alter table public.renewal_email_rules add constraint renewal_email_rules_date_basis_check
  check (date_basis in ('renewal_due_date','notice_received_date','notice_request_sent_date'));
alter table public.renewal_email_rules add constraint renewal_email_rules_follow_up_basis_check
  check ((rule_key = 'missing_notice_follow_up') = (date_basis = 'notice_request_sent_date'));
alter table public.renewal_email_rules add constraint renewal_email_rules_follow_up_offset_check
  check (rule_key <> 'missing_notice_follow_up' or offset_days >= 1);

insert into public.email_templates (template_name,channel,subject,body,status)
select 'Renewal notice follow-up','Email','Following up: renewal notice — {{policy_number}}',
  E'Hi {{recipient_name}},\n\nFollowing up on our request for the renewal notice for {{client_name}}\'s {{product}} policy ({{policy_number}}), due for renewal on {{renewal_date}}. We still have not received it.\n\nThank you,\n{{agent}}',
  'Active'
where not exists (select 1 from public.email_templates t
  where t.template_name = 'Renewal notice follow-up' and t.channel = 'Email' and t.status = 'Active');

-- Starts with the request rule's carrier contact and on/off state.
insert into public.renewal_email_rules (rule_key,name,date_basis,offset_days,recipient,external_contact_id,template_id,active)
select 'missing_notice_follow_up','Carrier notice follow-up','notice_request_sent_date',7,'carrier',
  request.external_contact_id,t.id,request.active and request.external_contact_id is not null
from public.renewal_email_rules request
cross join lateral (select et.id from public.email_templates et
  where et.template_name = 'Renewal notice follow-up' and et.channel = 'Email' and et.status = 'Active'
  order by et.created_at,et.id limit 1) t
where request.rule_key = 'missing_notice'
on conflict (rule_key) do nothing;

-- One eligibility definition shared by cron, receipt-trigger execution and manual logging.
create or replace function public.renewal_email_due_date(p_rule_id uuid,p_renewal_id uuid)
returns date language sql stable security invoker set search_path = public as $$
  select (case er.date_basis
      when 'notice_received_date' then r.notice_received_date
      when 'notice_request_sent_date' then (
        select (m.occurred_at at time zone 'Asia/Manila')::date
        from public.renewal_email_drafts d
        join public.renewal_email_rules q on q.id = d.rule_id and q.rule_key = 'missing_notice'
        join public.communications m on m.id = d.communication_id
        where d.renewal_id = r.id and d.status in ('Sent','Logged'))
      else r.renewal_due_date end) + er.offset_days
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
    and (er.rule_key not in ('missing_notice','missing_notice_follow_up') or r.notice_received_date is null)
    and (er.recipient = 'client' or (ec.status = 'Active' and nullif(btrim(ec.email),'') is not null));
$$;
revoke execute on function public.renewal_email_due_date(uuid,uuid) from public,anon,authenticated;
grant execute on function public.renewal_email_due_date(uuid,uuid) to service_role;
