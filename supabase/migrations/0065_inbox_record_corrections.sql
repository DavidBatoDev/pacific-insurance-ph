-- Inbox links describe correspondence, not checklist completion. Originals and
-- immutable filing/source identities survive every correction; only explicitly
-- reviewed associations change. No Storage object is copied or deleted.

create function public.gmail_inbox_record_status(p_kind text, p_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select concat_ws(' · ', c.lifecycle_stage, c.status) from public.clients c where p_kind = 'client' and c.id = p_id
  union all select a.status from public.applications a where p_kind = 'application' and a.id = p_id
  union all select a.status from public.claims a where p_kind = 'claim' and a.id = p_id
  union all select a.status from public.renewals a where p_kind = 'renewal' and a.id = p_id
  union all select a.status from public.travel_requests a where p_kind = 'travel' and a.id = p_id
  union all select a.status from public.policies a where p_kind = 'policy' and a.id = p_id;
$$;

-- Keep the widely-used base projection's signature unchanged.
drop function public.list_gmail_inbox_targets(uuid);
create function public.list_gmail_inbox_targets(p_actor_id uuid)
returns table(kind text, id uuid, client_id uuid, label text, participants text[], status text)
language sql stable security invoker set search_path = '' as $$
  select r.*, public.gmail_inbox_record_status(r.kind,r.id)
  from public.gmail_inbox_record_targets() r where public.gmail_inbox_actor_can_read(p_actor_id,r.client_id)
  order by r.kind,r.label,r.id;
$$;
drop function public.get_gmail_inbox_thread_target(text,text);
create function public.get_gmail_inbox_thread_target(p_google_subject text, p_gmail_thread_id text)
returns table(kind text, id uuid, client_id uuid, label text, participants text[], status text)
language sql stable security invoker set search_path = '' as $$
  with established as (
    select distinct m.target_kind,m.target_id from public.gmail_inbox_messages m
    where m.google_subject = p_google_subject and m.gmail_thread_id = p_gmail_thread_id and m.target_kind is not null
  ) select r.*,public.gmail_inbox_record_status(r.kind,r.id)
    from public.gmail_inbox_record_targets() r join established e on e.target_kind = r.kind and e.target_id = r.id
    where (select count(*) from established) = 1;
$$;

create table public.gmail_inbox_corrections (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.gmail_inbox_messages(id) on delete restrict,
  actor_id uuid not null references public.users(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  revision text not null,
  dispositions jsonb not null,
  before_state jsonb not null,
  after_state jsonb,
  transaction_id bigint not null default txid_current(),
  created_at timestamptz not null default clock_timestamp()
);
create index gmail_inbox_corrections_message_idx on public.gmail_inbox_corrections(message_id,created_at,id);
create index gmail_inbox_corrections_actor_idx on public.gmail_inbox_corrections(actor_id);
alter table public.gmail_inbox_corrections enable row level security;
revoke all on public.gmail_inbox_corrections from public,anon,authenticated;
grant select,insert,update on public.gmail_inbox_corrections to service_role;

-- Internal projections deliberately include legacy/unmanaged checklist columns,
-- retired aliases, and requirements on historical records (including Lead).
create function public.gmail_inbox_correction_requirements()
returns table(kind text,record_id uuid,requirement_id uuid,client_id uuid,label text,status text,state jsonb)
language sql stable security invoker set search_path = '' as $$
  select 'application'::text,a.id,r.id,a.client_id,concat_ws(' · ',a.reference_no,r.document_name,nullif(r.applies_to,'')),r.status,to_jsonb(r)
    from public.application_requirements r join public.applications a on a.id = r.application_id
  union all
  select 'claim',a.id,r.id,a.client_id,concat_ws(' · ',a.reference_no,r.document_name,nullif(r.applies_to,'')),r.status,to_jsonb(r)
    from public.claim_requirements r join public.claims a on a.id = r.claim_id
  union all
  select 'travel',a.id,r.id,a.client_id,concat_ws(' · ',a.reference_no,r.document_name,nullif(r.applies_to,'')),r.status,to_jsonb(r)
    from public.travel_request_requirements r join public.travel_requests a on a.id = r.travel_request_id;
$$;

create function public.gmail_inbox_correction_documents(p_message_id uuid)
returns setof public.documents language sql stable security invoker set search_path = '' as $$
  select d.* from public.documents d where exists (
    select 1 from public.gmail_inbox_filings f where f.message_id = p_message_id
      and (f.document_id = d.id or f.storage_path = d.file_path))
    or exists(select 1 from public.requirement_attachment_sources s where s.message_id = p_message_id
      and (s.original_document_id = d.id or s.storage_path = d.file_path));
$$;

create function public.gmail_inbox_correction_usages(p_message_id uuid)
returns table(id text,document_id uuid,part_id text,kind text,record_id uuid,requirement_id uuid,client_id uuid,label text,status text,has_other_evidence boolean)
language sql stable security invoker set search_path = '' as $$
  select coalesce(u.id::text,'document:' || d.id::text),d.id,f.part_id,r.kind,r.record_id,r.requirement_id,r.client_id,r.label,r.status,
    exists(select 1 from public.documents other where other.id <> d.id and other.client_id = r.client_id
      and not exists(select 1 from public.gmail_inbox_correction_documents(p_message_id) affected where affected.id = other.id)
      and coalesce(other.application_requirement_id,other.claim_requirement_id,other.travel_requirement_id) = r.requirement_id
      and nullif(btrim(other.file_path),'') is not null and other.status not in ('Draft','Archived','Replaced'))
  from public.gmail_inbox_correction_documents(p_message_id) d
    join public.gmail_inbox_filings f on f.message_id = p_message_id and f.storage_path = d.file_path
    left join public.requirement_attachment_usages u on u.document_id = d.id
    join public.gmail_inbox_correction_requirements() r on r.requirement_id =
      coalesce(u.application_requirement_id,u.claim_requirement_id,u.travel_requirement_id,
        d.application_requirement_id,d.claim_requirement_id,d.travel_requirement_id);
$$;

create function public.gmail_inbox_correction_record_state(p_kind text,p_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select to_jsonb(r) from public.clients r where p_kind = 'client' and r.id = p_id
  union all select to_jsonb(r) from public.applications r where p_kind = 'application' and r.id = p_id
  union all select to_jsonb(r) from public.claims r where p_kind = 'claim' and r.id = p_id
  union all select to_jsonb(r) from public.renewals r where p_kind = 'renewal' and r.id = p_id
  union all select to_jsonb(r) from public.travel_requests r where p_kind = 'travel' and r.id = p_id
  union all select to_jsonb(r) from public.policies r where p_kind = 'policy' and r.id = p_id;
$$;

create function public.gmail_inbox_correction_outbound(p_message_id uuid)
returns setof public.gmail_outbound_messages language sql stable security invoker set search_path = '' as $$
  select o.* from public.gmail_outbound_messages o where o.reply_to_message_id = p_message_id
    or (o.origin->>'type' = 'reply' and o.origin->>'messageId' = p_message_id::text)
    or exists(select 1 from jsonb_array_elements(o.attachments) a
      where a#>>'{source,type}' = 'email' and a#>>'{source,messageId}' = p_message_id::text)
    or exists(select 1 from jsonb_array_elements(o.attachments) a
      join public.gmail_inbox_correction_documents(p_message_id) d
        on a->>'storagePath' = d.file_path or (a#>>'{source,type}' = 'document' and a#>>'{source,id}' = d.id::text))
    or (o.origin->>'type' = 'submission' and exists(
      select 1 from public.gmail_inbox_correction_usages(p_message_id) u
      where o.origin->>'kind' = u.kind and o.origin->>'id' = u.record_id::text));
$$;

create function public.gmail_inbox_correction_snapshot(p_message_id uuid,p_kind text,p_target_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with docs as materialized (select * from public.gmail_inbox_correction_documents(p_message_id)),
  requirements as materialized (
    select r.* from public.gmail_inbox_correction_requirements() r
    where (r.kind = p_kind and r.record_id = p_target_id)
      or exists(select 1 from docs d left join public.requirement_attachment_usages u on u.document_id = d.id
        where r.requirement_id = coalesce(u.application_requirement_id,u.claim_requirement_id,u.travel_requirement_id,
          d.application_requirement_id,d.claim_requirement_id,d.travel_requirement_id))
  ), records as (
    select p_kind as kind,p_target_id as id
    union select m.target_kind,m.target_id from public.gmail_inbox_messages m where m.id = p_message_id
    union select r.kind,r.record_id from requirements r
    union select 'application',d.application_id from docs d where d.application_id is not null
    union select 'claim',d.claim_id from docs d where d.claim_id is not null
    union select 'travel',d.travel_request_id from docs d where d.travel_request_id is not null
    union select 'renewal',d.renewal_id from docs d where d.renewal_id is not null
    union select 'policy',d.policy_id from docs d where d.policy_id is not null
  ) select jsonb_build_object(
    'message',(select to_jsonb(m) from public.gmail_inbox_messages m where m.id = p_message_id),
    'target',jsonb_build_object('kind',p_kind,'id',p_target_id),
    'clients',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]'::jsonb) from public.clients c where c.id in (
      select m.client_id from public.gmail_inbox_messages m where m.id = p_message_id
      union select r.client_id from public.gmail_inbox_record_targets() r where r.kind = p_kind and r.id = p_target_id
      union select d.client_id from docs d union select r.client_id from requirements r)),
    'records',(select coalesce(jsonb_agg(jsonb_build_object('kind',r.kind,'id',r.id,'state',public.gmail_inbox_correction_record_state(r.kind,r.id)) order by r.kind,r.id),'[]'::jsonb) from records r),
    'filings',(select coalesce(jsonb_agg(to_jsonb(f) order by f.part_id),'[]'::jsonb) from public.gmail_inbox_filings f where f.message_id = p_message_id),
    'sources',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.requirement_attachment_sources s where s.message_id = p_message_id),
    'documents',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) from docs d),
    'usages',(select coalesce(jsonb_agg(to_jsonb(u) order by u.id),'[]'::jsonb) from public.requirement_attachment_usages u
      where u.document_id in (select d.id from docs d) or u.source_id in (select s.id from public.requirement_attachment_sources s where s.message_id = p_message_id)),
    'requirements',(select coalesce(jsonb_agg(to_jsonb(r) order by r.kind,r.requirement_id),'[]'::jsonb) from requirements r),
    'otherEvidence',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) from public.documents d
      where coalesce(d.application_requirement_id,d.claim_requirement_id,d.travel_requirement_id) in (select r.requirement_id from requirements r)),
    'outbound',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) from public.gmail_inbox_correction_outbound(p_message_id) o),
    'payments',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.payments p where p.proof_document_id in (select d.id from docs d)),
    'coverage',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.external_coverage p where p.proof_document_id in (select d.id from docs d)),
    'commissions',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.commissions p where p.voucher_document_id in (select d.id from docs d)),
    'communicationFiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.communication_id,p.document_library_id),'[]'::jsonb)
      from public.communication_library_documents p where p.file_path_snapshot in (select d.file_path from docs d)),
    'communication',(select to_jsonb(c) from public.communications c join public.gmail_inbox_messages m on m.communication_id = c.id where m.id = p_message_id)
  );
$$;

-- A completed audit row cannot be edited or deleted. The one permitted update
-- completes the exact transaction's before/after record, not a later rewrite.
create function public.guard_gmail_inbox_correction_audit()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'inbox_correction_audit_immutable' using errcode = '22023'; end if;
  if old.after_state is not null or old.transaction_id <> txid_current()
    or (to_jsonb(new) - 'after_state') is distinct from (to_jsonb(old) - 'after_state') or new.after_state is null then
    raise exception 'inbox_correction_audit_immutable' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger immutable_gmail_inbox_correction_audit before update or delete on public.gmail_inbox_corrections
for each row execute function public.guard_gmail_inbox_correction_audit();

-- No public bypass flag: a transaction-local audit capability must point at an
-- unfinished correction by a real Active Admin for this exact source document.
-- Source identity, original path, file name and upload provenance never change.
create or replace function public.prevent_requirement_original_document_move()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists(select 1 from public.requirement_attachment_sources where original_document_id = old.id) then
    if new.file_path is distinct from old.file_path or not exists(
      select 1 from public.gmail_inbox_corrections c join public.users a on a.id = c.actor_id
      join public.requirement_attachment_sources s on s.message_id = c.message_id and s.original_document_id = old.id
      where c.id::text = current_setting('app.inbox_correction_id',true) and c.transaction_id = txid_current()
        and c.after_state is null and a.status = 'Active' and a.role in ('Owner','Admin')
        and new.name = old.name and new.uploaded_by is not distinct from old.uploaded_by
        and new.uploaded_at = old.uploaded_at) then
      raise exception 'attachment_original_is_immutable' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create function public.gmail_inbox_correction_file_blockers(p_message_id uuid,p_path text)
returns text[] language sql stable security invoker set search_path = '' as $$
  select array_remove(array[
    case when exists(select 1 from public.documents d where d.file_path = p_path
      and (d.commission_id is not null or d.document_type = 'Commission Voucher'))
      then 'Commission voucher originals and aliases must be resolved in Commissions.' end,
    case when exists(select 1 from public.documents d where d.file_path = p_path
      and d.document_type in ('Illustrative Proposal','Travel Policy','Travel Application Copy'))
      or exists(select 1 from public.gmail_inbox_filings f where f.message_id = p_message_id and f.storage_path = p_path
        and f.purpose in ('proposal','travel_policy','travel_application_copy'))
      then 'Proposal, Travel policy and application-copy originals must retain their source-workflow identity. Resolve them in that workflow before moving this filing.' end,
    case when exists(select 1 from public.documents d where d.file_path = p_path and d.status in ('Approved','Under Review'))
      then 'An approved or in-review document must be reviewed in its source workflow before its association can change.' end,
    case when exists(select 1 from public.payments p join public.documents d on d.id = p.proof_document_id where d.file_path = p_path)
      then 'This original is payment evidence. Resolve its payment reference before changing its association.' end,
    case when exists(select 1 from public.external_coverage p join public.documents d on d.id = p.proof_document_id where d.file_path = p_path)
      then 'This original is coverage evidence. Resolve its coverage reference before changing its association.' end,
    case when exists(select 1 from public.communication_library_documents p where p.file_path_snapshot = p_path)
      then 'A communication retains this original as a file snapshot. Resolve that reference in its source workflow first.' end,
    case when exists(select 1 from public.gmail_inbox_correction_outbound(p_message_id) o
      cross join lateral jsonb_array_elements(o.attachments) a
      where a->>'storagePath' = p_path or exists(select 1 from public.documents d where d.file_path = p_path
        and a#>>'{source,type}' = 'document' and a#>>'{source,id}' = d.id::text))
      then 'An outbound email retains this original. Accepted, sending or uncertain sends cannot be rewritten; prepared or failed intents also retain immutable attachment snapshots and must be resolved before moving or detaching this evidence.' end
  ],null);
$$;

create function public.gmail_inbox_correction_usage_blockers(p_message_id uuid,p_usage_id text)
returns text[] language sql stable security invoker set search_path = '' as $$
  select public.gmail_inbox_correction_file_blockers(p_message_id,d.file_path) || array_remove(array[
    case when u.status = 'Verified' then 'Verified evidence cannot be detached here. Review its verification in the source checklist first.' end,
    case when (
      (u.kind = 'application' and (
        nullif(public.gmail_inbox_correction_record_state(u.kind,u.record_id)->>'date_submitted','') is not null
        or nullif(public.gmail_inbox_correction_record_state(u.kind,u.record_id)->>'policy_issued_date','') is not null
        or nullif(public.gmail_inbox_correction_record_state(u.kind,u.record_id)->>'policy_id','') is not null
        or public.gmail_inbox_record_status(u.kind,u.record_id) in ('Submitted to Pacific Cross','Awaiting Payment','Approved')
        or nullif(public.gmail_inbox_correction_record_state(u.kind,u.record_id)->>'medical_review_cleared_at','') is not null))
      or (u.kind = 'claim' and (
        nullif(public.gmail_inbox_correction_record_state(u.kind,u.record_id)->>'claim_submitted_date','') is not null
        or public.gmail_inbox_record_status(u.kind,u.record_id) in ('Submitted','Pending Review','Approved','Rejected','Credited','Closed')))
      or (u.kind = 'travel' and (public.gmail_inbox_record_status(u.kind,u.record_id) in ('Policy Issued','Policy Delivered','Completed')
        or public.gmail_inbox_correction_record_state(u.kind,u.record_id)->>'portal_processing_status' = 'Issued'))
    ) then 'The source record has submission, issuance or cleared medical-review dependencies. Resolve those in its source workflow before detaching evidence.' end,
    case when exists(select 1 from public.gmail_inbox_correction_outbound(p_message_id) o
      where o.origin->>'type' = 'submission' and o.origin->>'kind' = u.kind and o.origin->>'id' = u.record_id::text)
      then 'A submission email depends on this checklist. Resolve that outbound submission before detaching evidence.' end
  ],null)
  from public.gmail_inbox_correction_usages(p_message_id) u join public.documents d on d.id = u.document_id
  where u.id = p_usage_id;
$$;

create function public.gmail_inbox_correction_document_target(p_document_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with destination as (
    select d.client_id,
      case when d.application_id is not null then 'application' when d.claim_id is not null then 'claim'
        when d.travel_request_id is not null then 'travel' when d.renewal_id is not null then 'renewal'
        when d.policy_id is not null then 'policy' else 'client' end as kind,
      coalesce(d.application_id,d.claim_id,d.travel_request_id,d.renewal_id,d.policy_id,d.client_id) as id
    from public.documents d where d.id = p_document_id
      and num_nonnulls(d.application_id,d.claim_id,d.travel_request_id,d.renewal_id,d.policy_id) <= 1
  ) select jsonb_build_object('kind',r.kind,'id',r.id,'clientId',r.client_id,'label',r.label,
      'participants',r.participants,'status',public.gmail_inbox_record_status(r.kind,r.id))
    from destination d join public.gmail_inbox_record_targets() r on r.kind = d.kind and r.id = d.id and r.client_id = d.client_id;
$$;

create function public.preview_gmail_inbox_correction(p_actor_id uuid,p_message_id uuid,p_kind text,p_target_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  m public.gmail_inbox_messages%rowtype;
  current_target jsonb; target jsonb; snapshot jsonb; filings jsonb; requirements jsonb;
  cross_client boolean; blockers text[] := array[]::text[];
begin
  if not exists(select 1 from public.users where id = p_actor_id and status = 'Active' and role in ('Owner','Admin')) then
    raise exception 'inbox_correction_forbidden' using errcode = '42501';
  end if;
  select * into m from public.gmail_inbox_messages where id = p_message_id;
  if m.id is null or m.target_id is null or not public.gmail_inbox_actor_can_read(p_actor_id,m.client_id) then
    raise exception 'inbox_correction_unavailable' using errcode = '42501';
  end if;
  select jsonb_build_object('kind',r.kind,'id',r.id,'clientId',r.client_id,'label',r.label,'participants',r.participants,
    'status',public.gmail_inbox_record_status(r.kind,r.id)) into target
    from public.gmail_inbox_record_targets() r where r.kind = p_kind and r.id = p_target_id
      and public.gmail_inbox_actor_can_read(p_actor_id,r.client_id);
  select jsonb_build_object('kind',r.kind,'id',r.id,'clientId',r.client_id,'label',r.label,'participants',r.participants,
    'status',public.gmail_inbox_record_status(r.kind,r.id)) into current_target
    from public.gmail_inbox_record_targets() r where r.kind = m.target_kind and r.id = m.target_id and r.client_id = m.client_id;
  if target is null or current_target is null then raise exception 'inbox_correction_target_unavailable' using errcode = '42501'; end if;
  if p_kind = m.target_kind and p_target_id = m.target_id then raise exception 'inbox_correction_no_change' using errcode = '22023'; end if;
  cross_client := (target->>'clientId')::uuid <> m.client_id;
  if not exists(select 1 from public.communications c where c.id = m.communication_id
    and c.client_id = m.client_id and c.direction = 'Inbound' and c.channel = 'Gmail' and c.delivery_status = 'received'
    and c.application_id is not distinct from case when m.target_kind = 'application' then m.target_id end
    and c.claim_id is not distinct from case when m.target_kind = 'claim' then m.target_id end
    and c.renewal_id is not distinct from case when m.target_kind = 'renewal' then m.target_id end
    and c.travel_request_id is not distinct from case when m.target_kind = 'travel' then m.target_id end
    and c.policy_id is not distinct from case when m.target_kind = 'policy' then m.target_id end) then
    blockers := array_append(blockers,'The Received communication association no longer matches this email. Resolve that discrepancy before correction.');
  end if;
  if exists(select 1 from public.gmail_inbox_correction_outbound(m.id) o
    where o.reply_to_message_id = m.id or (o.origin->>'type' = 'reply' and o.origin->>'messageId' = m.id::text)) then
    blockers := array_append(blockers,'An outbound reply retains this email association. Accepted, sending and uncertain replies cannot be rewritten; prepared or failed reply intents retain immutable old-recipient snapshots and must be resolved before correcting this email.');
  end if;
  -- Email attachment intents may have no stored path and may reference a part
  -- never filed locally. The message/part source identity is still an immutable
  -- outbound dependency and must be reviewed independently of document aliases.
  if exists(select 1 from public.gmail_inbox_correction_outbound(m.id) o
    cross join lateral jsonb_array_elements(o.attachments) a
    where a#>>'{source,type}' = 'email' and a#>>'{source,messageId}' = m.id::text) then
    blockers := array_append(blockers,'An outbound email retains an attachment from this message, including possibly an unfiled part. Accepted, sending and uncertain sends cannot be rewritten; prepared or failed intents retain immutable source snapshots and must be resolved before correcting this email.');
  end if;
  if exists(select 1 from public.gmail_inbox_filings f left join public.requirement_attachment_sources s
    on s.message_id = f.message_id and s.part_id = f.part_id
    left join public.documents d on d.id = f.document_id
    where f.message_id = m.id and (s.id is null or s.original_document_id <> f.document_id
      or s.storage_path <> f.storage_path or d.file_path is distinct from f.storage_path
      or m.filed_parts->>f.part_id is distinct from f.document_id::text
      or not exists(select 1 from jsonb_array_elements(m.attachments) a where a->>'partId' = f.part_id)))
    or exists(select 1 from jsonb_each_text(m.filed_parts) p where not exists(
      select 1 from public.gmail_inbox_filings f where f.message_id = m.id and f.part_id = p.key and f.document_id::text = p.value)) then
    blockers := array_append(blockers,'Stored filing provenance is inconsistent. Resolve the source metadata before correction.');
  end if;
  if exists(select 1 from public.gmail_inbox_correction_documents(m.id) d
    where d.client_id is distinct from m.client_id or d.commission_id is not null or d.document_type = 'Commission Voucher')
    or exists(select 1 from public.gmail_inbox_correction_usages(m.id) u where u.client_id <> m.client_id)
    or exists(select 1 from public.requirement_attachment_sources s join public.documents d on d.file_path = s.storage_path
      where d.id in (select x.id from public.gmail_inbox_correction_documents(m.id) x) and s.message_id <> m.id) then
    blockers := array_append(blockers,'A canonical-file alias has conflicting client, commission-voucher or email-source ownership. Resolve those source references before correction.');
  end if;
  if exists(select 1 from public.gmail_inbox_correction_documents(m.id) d left join public.requirement_attachment_usages u on u.document_id = d.id
    where (u.id is not null and (
      coalesce(d.application_requirement_id,d.claim_requirement_id,d.travel_requirement_id) is distinct from
        coalesce(u.application_requirement_id,u.claim_requirement_id,u.travel_requirement_id)
      or not exists(select 1 from public.requirement_attachment_sources s where s.id = u.source_id and s.message_id = m.id and s.storage_path = d.file_path)))
      or (coalesce(d.application_requirement_id,d.claim_requirement_id,d.travel_requirement_id) is not null and not exists(
        select 1 from public.gmail_inbox_correction_usages(m.id) x where x.document_id = d.id))) then
    blockers := array_append(blockers,'A checklist alias has mismatched receipt provenance. Resolve that source association before correction.');
  end if;
  if exists(select 1 from public.requirement_attachment_sources s join public.requirement_attachment_usages u on u.source_id = s.id
      left join public.documents d on d.id = u.document_id
      where s.message_id = m.id and (d.file_path is distinct from s.storage_path or d.client_id is distinct from m.client_id))
    or exists(select 1 from public.gmail_inbox_correction_usages(m.id) u join public.documents d on d.id = u.document_id
      where d.client_id is distinct from u.client_id
        or (u.kind = 'application' and d.application_id is distinct from u.record_id)
        or (u.kind = 'claim' and d.claim_id is distinct from u.record_id)
        or (u.kind = 'travel' and d.travel_request_id is distinct from u.record_id)) then
    blockers := array_append(blockers,'Receipt document ownership or canonical-file provenance does not match its checklist. Resolve the source discrepancy before correction.');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'partId',f.part_id,'fileName',d.name,'documentId',d.id,
    'target',public.gmail_inbox_correction_document_target(d.id),
    'purpose',case when d.document_type = 'Incoming Email Attachment' then 'document' else f.purpose end,
    'usages',coalesce((select jsonb_agg(jsonb_build_object(
      'id',u.id,'documentId',u.document_id,'kind',u.kind,'recordId',u.record_id,'requirementId',u.requirement_id,
      'label',u.label,'status',u.status,'hasOtherEvidence',u.has_other_evidence,
      'canDetach',cardinality(public.gmail_inbox_correction_usage_blockers(m.id,u.id)) = 0,
      'blockers',public.gmail_inbox_correction_usage_blockers(m.id,u.id)) order by u.id)
      from public.gmail_inbox_correction_usages(m.id) u where u.part_id = f.part_id),'[]'::jsonb),
    'canMove',cardinality(public.gmail_inbox_correction_file_blockers(m.id,f.storage_path)) = 0
      and public.gmail_inbox_correction_document_target(d.id) is not null
      and not exists(select 1 from public.gmail_inbox_correction_usages(m.id) u where u.part_id = f.part_id and u.status = 'Verified'),
    'blockers',public.gmail_inbox_correction_file_blockers(m.id,f.storage_path) ||
      case when public.gmail_inbox_correction_document_target(d.id) is null
        then array['The original has orphaned, conflicting or multiple record associations. Resolve them in its source workflow before moving this filing.']::text[]
        else array[]::text[] end ||
      case when exists(select 1 from public.gmail_inbox_correction_usages(m.id) u where u.part_id = f.part_id and u.status = 'Verified')
        then array['This original supports a Verified receipt. Keep it on its current destination or review verification in the source checklist before moving it.']::text[]
        else array[]::text[] end
  ) order by f.part_id),'[]'::jsonb) into filings
  from public.gmail_inbox_filings f join public.documents d on d.id = f.document_id where f.message_id = m.id;
  if cross_client and exists(select 1 from jsonb_array_elements(filings) f
    where not (f->>'canMove')::boolean or exists(select 1 from jsonb_array_elements(f->'usages') u where not (u->>'canDetach')::boolean)) then
    blockers := array_append(blockers,'Cross-client correction requires moving every filing and detaching every old-client receipt. Resolve the listed source-workflow blockers first.');
  end if;
  -- A new receipt is offered only through the existing supported target helper.
  select coalesce(jsonb_agg(jsonb_build_object('id',r.requirement_id,'label',r.label,'status',r.status) order by r.label,r.requirement_id),'[]'::jsonb)
    into requirements from public.requirement_attachment_targets() r where r.kind = p_kind and r.record_id = p_target_id
      and r.client_id = (target->>'clientId')::uuid;
  snapshot := public.gmail_inbox_correction_snapshot(m.id,p_kind,p_target_id);
  return jsonb_build_object('messageId',m.id,'revision',encode(sha256(convert_to((snapshot || jsonb_build_object('projection',target))::text,'UTF8')),'hex'),
    'currentTarget',current_target,'target',target,'crossClient',cross_client,'filings',filings,'targetRequirements',requirements,'blockers',blockers);
end;
$$;

create function public.correct_gmail_inbox_message(p_actor_id uuid,p_input jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_variable
declare
  m public.gmail_inbox_messages%rowtype;
  impact jsonb; before_state jsonb; after_state jsonb; disposition jsonb; filing jsonb; receipt jsonb;
  target_kind text := p_input#>>'{target,kind}'; target_id uuid; target_client uuid; correction_id uuid;
  item record; original public.documents%rowtype; kept_usage public.requirement_attachment_usages%rowtype;
  alias_id uuid; remaining boolean; resolution text; detached_documents uuid[] := array[]::uuid[];
begin
  if jsonb_typeof(p_input) is distinct from 'object' or jsonb_typeof(p_input->'target') is distinct from 'object'
    or jsonb_typeof(p_input->'filings') is distinct from 'array' or jsonb_typeof(p_input->'receipts') is distinct from 'array'
    or coalesce(length(btrim(p_input->>'reason')),0) not between 1 and 2000
    or coalesce(p_input->>'revision','') !~ '^[0-9a-f]{64}$'
    or p_input->>'messageId' is null or p_input#>>'{target,id}' is null
    or target_kind is null or target_kind not in ('client','application','claim','renewal','travel','policy')
    or jsonb_typeof(p_input->'confirmCrossClient') is distinct from 'boolean' then
    raise exception 'inbox_correction_invalid' using errcode = '22023';
  end if;
  target_id := (p_input#>>'{target,id}')::uuid;
  -- Same first lock as filing/receive: no reader can correct a source while a
  -- receipt for that same message is being committed.
  select * into m from public.gmail_inbox_messages where id = (p_input->>'messageId')::uuid for update nowait;
  if m.id is null or m.target_id is null then raise exception 'inbox_correction_unavailable' using errcode = '42501'; end if;
  perform 1 from public.users where id = p_actor_id and status = 'Active' and role in ('Owner','Admin') for share nowait;
  if not found then raise exception 'inbox_correction_forbidden' using errcode = '42501'; end if;

  -- The existing outbound prepare/claim and generic alias writers do not take a
  -- source-message lock. Non-waiting table write locks close their phantom race.
  -- These locks are held only for this short Admin correction transaction; busy
  -- workflows cause a refresh conflict rather than a deadlock or automatic retry.
  lock table public.documents,public.requirement_attachment_usages,
    public.gmail_outbound_messages,public.payments,public.external_coverage,
    public.commissions,public.communication_library_documents
    in share row exclusive mode nowait;
  before_state := public.gmail_inbox_correction_snapshot(m.id,target_kind,target_id);
  for item in select value from jsonb_array_elements(before_state->'clients') order by value->>'id' loop
    perform 1 from public.clients where id = (item.value->>'id')::uuid for update nowait;
  end loop;
  for item in select value from jsonb_array_elements(before_state->'records') order by value->>'kind',value->>'id' loop
    case item.value->>'kind'
      when 'client' then null;
      when 'application' then perform 1 from public.applications where id = (item.value->>'id')::uuid for update nowait;
      when 'claim' then perform 1 from public.claims where id = (item.value->>'id')::uuid for update nowait;
      when 'renewal' then perform 1 from public.renewals where id = (item.value->>'id')::uuid for update nowait;
      when 'travel' then perform 1 from public.travel_requests where id = (item.value->>'id')::uuid for update nowait;
      when 'policy' then perform 1 from public.policies where id = (item.value->>'id')::uuid for update nowait;
      else raise exception 'inbox_correction_invalid' using errcode = '22023';
    end case;
  end loop;
  for item in select value from jsonb_array_elements(before_state->'requirements') order by value->>'kind',value->>'requirement_id' loop
    case item.value->>'kind'
      when 'application' then perform 1 from public.application_requirements where id = (item.value->>'requirement_id')::uuid for update nowait;
      when 'claim' then perform 1 from public.claim_requirements where id = (item.value->>'requirement_id')::uuid for update nowait;
      when 'travel' then perform 1 from public.travel_request_requirements where id = (item.value->>'requirement_id')::uuid for update nowait;
    end case;
  end loop;
  perform 1 from public.communications where id = m.communication_id for update nowait;
  impact := public.preview_gmail_inbox_correction(p_actor_id,m.id,target_kind,target_id);
  if impact->>'revision' is distinct from p_input->>'revision' then
    raise exception 'inbox_correction_stale' using errcode = 'P0001';
  end if;
  if jsonb_array_length(impact->'blockers') <> 0 then raise exception 'inbox_correction_blocked' using errcode = '22023'; end if;
  target_client := (impact#>>'{target,clientId}')::uuid;
  if (impact->>'crossClient')::boolean and (p_input->>'confirmCrossClient')::boolean is not true then
    raise exception 'inbox_correction_cross_client_confirmation_required' using errcode = '22023';
  end if;
  if jsonb_array_length(p_input->'filings') <> jsonb_array_length(impact->'filings')
    or (select count(*) <> count(distinct x->>'partId') from jsonb_array_elements(p_input->'filings') x)
    or jsonb_array_length(p_input->'receipts') <> (select count(*) from jsonb_array_elements(impact->'filings') f cross join lateral jsonb_array_elements(f->'usages') u)
    or (select count(*) <> count(distinct x->>'usageId') from jsonb_array_elements(p_input->'receipts') x) then
    raise exception 'inbox_correction_dispositions_required' using errcode = '22023';
  end if;
  for disposition in select value from jsonb_array_elements(p_input->'filings') loop
    select f into filing from jsonb_array_elements(impact->'filings') f where f->>'partId' = disposition->>'partId';
    if filing is null or jsonb_typeof(disposition) <> 'object'
      or disposition->>'action' is null or disposition->>'action' not in ('keep','move')
      or not (disposition ? 'requirementId')
      or (disposition->>'action' = 'keep' and ((impact->>'crossClient')::boolean or disposition->>'requirementId' is not null))
      or (disposition->>'action' = 'move' and not (filing->>'canMove')::boolean) then
      raise exception 'inbox_correction_invalid_filing_disposition' using errcode = '22023';
    end if;
    if disposition->>'requirementId' is not null and not exists(
      select 1 from jsonb_array_elements(impact->'targetRequirements') r where r->>'id' = disposition->>'requirementId') then
      raise exception 'inbox_correction_requirement_unavailable' using errcode = '22023';
    end if;
  end loop;
  for disposition in select value from jsonb_array_elements(p_input->'receipts') loop
    select u into receipt from jsonb_array_elements(impact->'filings') f cross join lateral jsonb_array_elements(f->'usages') u
      where u->>'id' = disposition->>'usageId';
    if receipt is null or jsonb_typeof(disposition) <> 'object'
      or disposition->>'action' is null or disposition->>'action' not in ('keep','detach')
      or not (disposition ? 'remainingStatus')
      or (disposition->>'remainingStatus' is not null and disposition->>'remainingStatus' not in ('Pending','Incomplete'))
      or (disposition->>'action' = 'keep' and ((impact->>'crossClient')::boolean or disposition->>'remainingStatus' is not null))
      or (disposition->>'action' = 'detach' and not (receipt->>'canDetach')::boolean) then
      raise exception 'inbox_correction_invalid_receipt_disposition' using errcode = '22023';
    end if;
    if disposition->>'action' = 'detach' then
      detached_documents := array_append(detached_documents,(receipt->>'documentId')::uuid);
    end if;
  end loop;
  -- Evaluate the FINAL complete disposition set, not each receipt in isolation:
  -- two mutually \"other\" receipts may both have been selected for detachment.
  for item in select distinct u.kind,u.record_id,u.requirement_id,u.client_id,u.status
    from public.gmail_inbox_correction_usages(m.id) u where u.document_id = any(detached_documents)
    order by u.kind,u.requirement_id loop
    select exists(select 1 from public.documents d where d.client_id = item.client_id
      and coalesce(d.application_requirement_id,d.claim_requirement_id,d.travel_requirement_id) = item.requirement_id
      and not (d.id = any(detached_documents)) and nullif(btrim(d.file_path),'') is not null
      and d.status not in ('Draft','Archived','Replaced')) into remaining;
    select min(x->>'remainingStatus') into resolution from jsonb_array_elements(p_input->'receipts') x
      join public.gmail_inbox_correction_usages(m.id) u on u.id = x->>'usageId'
      where u.requirement_id = item.requirement_id and x->>'action' = 'detach';
    if item.status = 'Received' and not remaining then
      if resolution is null or exists(select 1 from jsonb_array_elements(p_input->'receipts') x
        join public.gmail_inbox_correction_usages(m.id) u on u.id = x->>'usageId'
        where u.requirement_id = item.requirement_id and x->>'action' = 'detach'
          and x->>'remainingStatus' is distinct from resolution) then
        raise exception 'inbox_correction_last_receipt_resolution_required' using errcode = '22023';
      end if;
    end if;
  end loop;

  before_state := public.gmail_inbox_correction_snapshot(m.id,target_kind,target_id);
  insert into public.gmail_inbox_corrections(message_id,actor_id,reason,revision,dispositions,before_state)
    values(m.id,p_actor_id,btrim(p_input->>'reason'),impact->>'revision',
      jsonb_build_object('filings',p_input->'filings','receipts',p_input->'receipts','confirmCrossClient',p_input->'confirmCrossClient'),before_state)
    returning id into correction_id;
  perform set_config('app.inbox_correction_id',correction_id::text,true);

  -- Apply status resolutions while the original usage projection is intact.
  for item in select distinct u.kind,u.requirement_id,x->>'remainingStatus' as resolution
    from jsonb_array_elements(p_input->'receipts') x join public.gmail_inbox_correction_usages(m.id) u on u.id = x->>'usageId'
    where x->>'action' = 'detach' and x->>'remainingStatus' is not null and u.status = 'Received'
      and not exists(select 1 from public.documents d where d.client_id = u.client_id
        and coalesce(d.application_requirement_id,d.claim_requirement_id,d.travel_requirement_id) = u.requirement_id
        and not (d.id = any(detached_documents)) and nullif(btrim(d.file_path),'') is not null
        and d.status not in ('Draft','Archived','Replaced'))
    order by u.kind,u.requirement_id loop
    case item.kind
      when 'application' then update public.application_requirements set status = item.resolution where id = item.requirement_id;
      when 'claim' then update public.claim_requirements set status = item.resolution where id = item.requirement_id;
      when 'travel' then update public.travel_request_requirements set status = item.resolution where id = item.requirement_id;
    end case;
  end loop;
  for disposition in select value from jsonb_array_elements(p_input->'receipts') where value->>'action' = 'detach' order by value->>'usageId' loop
    -- IDs were bound to documents under lock before any status mutation.
    select u into receipt from jsonb_array_elements(impact->'filings') f cross join lateral jsonb_array_elements(f->'usages') u
      where u->>'id' = disposition->>'usageId';
    delete from public.requirement_attachment_usages where document_id = (receipt->>'documentId')::uuid;
    update public.documents set application_requirement_id = null,claim_requirement_id = null,travel_requirement_id = null,
      source_library_document_id = null,
      document_type = case when document_type in ('Application Requirement','Claim Requirement','Travel Requirement')
        then 'Incoming Email Attachment' else document_type end
      where id = (receipt->>'documentId')::uuid;
  end loop;
  for disposition in select value from jsonb_array_elements(p_input->'filings') where value->>'action' = 'move' order by value->>'partId' loop
    select d.* into original from public.gmail_inbox_filings f join public.documents d on d.id = f.document_id
      where f.message_id = m.id and f.part_id = disposition->>'partId';
    -- A legacy first filing may itself be the kept receipt. Preserve that old
    -- association as an alias with the same bytes/provenance and the SAME usage
    -- ID, freeing the immutable source-document identity for its reviewed move.
    select * into kept_usage from public.requirement_attachment_usages where document_id = original.id;
    if kept_usage.id is not null then
      insert into public.documents(client_id,application_id,claim_id,renewal_id,travel_request_id,policy_id,
        application_requirement_id,claim_requirement_id,travel_requirement_id,source_library_document_id,
        document_type,name,file_path,uploaded_by,uploaded_at,visibility,status,version,notes)
      values(original.client_id,original.application_id,original.claim_id,original.renewal_id,original.travel_request_id,original.policy_id,
        original.application_requirement_id,original.claim_requirement_id,original.travel_requirement_id,original.source_library_document_id,
        original.document_type,original.name,original.file_path,original.uploaded_by,original.uploaded_at,original.visibility,original.status,original.version,original.notes)
      returning id into alias_id;
      update public.requirement_attachment_usages set document_id = alias_id where id = kept_usage.id;
    elsif coalesce(original.application_requirement_id,original.claim_requirement_id,original.travel_requirement_id) is not null then
      -- Unmanaged legacy receipts also support explicit keep: materialize their
      -- association before moving the original, with no fabricated receipt date.
      if exists(select 1 from jsonb_array_elements(p_input->'receipts') x where x->>'usageId' = 'document:' || original.id::text and x->>'action' = 'keep') then
        insert into public.documents(client_id,application_id,claim_id,travel_request_id,
          application_requirement_id,claim_requirement_id,travel_requirement_id,source_library_document_id,
          document_type,name,file_path,uploaded_by,uploaded_at,visibility,status,version,notes)
        values(original.client_id,original.application_id,original.claim_id,original.travel_request_id,
          original.application_requirement_id,original.claim_requirement_id,original.travel_requirement_id,original.source_library_document_id,
          original.document_type,original.name,original.file_path,original.uploaded_by,original.uploaded_at,original.visibility,original.status,original.version,original.notes)
        returning id into alias_id;
        insert into public.requirement_attachment_usages(source_id,document_id,application_requirement_id,claim_requirement_id,travel_requirement_id,attached_by,attached_at)
          select s.id,alias_id,original.application_requirement_id,original.claim_requirement_id,original.travel_requirement_id,
            f.filed_by,f.filed_at from public.requirement_attachment_sources s join public.gmail_inbox_filings f
              on f.message_id = s.message_id and f.part_id = s.part_id where s.message_id = m.id and s.part_id = disposition->>'partId';
      end if;
    end if;
    update public.documents set client_id = target_client,
      application_id = case when target_kind = 'application' then target_id end,
      claim_id = case when target_kind = 'claim' then target_id end,
      renewal_id = case when target_kind = 'renewal' then target_id end,
      travel_request_id = case when target_kind = 'travel' then target_id end,
      policy_id = case when target_kind = 'policy' then target_id end,
      application_requirement_id = null,claim_requirement_id = null,travel_requirement_id = null,
      source_library_document_id = null,document_type = 'Incoming Email Attachment',visibility = 'Internal Only'
      where id = original.id;
  end loop;
  if (impact->>'crossClient')::boolean then
    -- Include retired and unmanaged canonical-path aliases, not just active
    -- usages. Leaving any alias with old ownership would leak download access.
    update public.documents d set client_id = target_client,
      application_id = case when target_kind = 'application' then target_id end,
      claim_id = case when target_kind = 'claim' then target_id end,
      renewal_id = case when target_kind = 'renewal' then target_id end,
      travel_request_id = case when target_kind = 'travel' then target_id end,
      policy_id = case when target_kind = 'policy' then target_id end,
      application_requirement_id = null,claim_requirement_id = null,travel_requirement_id = null,
      source_library_document_id = null,document_type = 'Incoming Email Attachment',visibility = 'Internal Only'
      where d.id in (select x.id from public.gmail_inbox_correction_documents(m.id) x);
  end if;
  update public.communications set client_id = target_client,
    application_id = case when target_kind = 'application' then target_id end,
    claim_id = case when target_kind = 'claim' then target_id end,
    renewal_id = case when target_kind = 'renewal' then target_id end,
    travel_request_id = case when target_kind = 'travel' then target_id end,
    policy_id = case when target_kind = 'policy' then target_id end,
    related_user_id = p_actor_id where id = m.communication_id;
  update public.gmail_inbox_messages set client_id = target_client,target_kind = target_kind,target_id = target_id,
    linked_by = p_actor_id,linked_at = clock_timestamp() where id = m.id;
  -- Real additional receipts are recorded AFTER cutover by the existing
  -- transaction helper; it preserves Verified and validates ownership/target.
  for disposition in select value from jsonb_array_elements(p_input->'filings')
    where value->>'action' = 'move' and value->>'requirementId' is not null order by value->>'partId' loop
    perform public.receive_requirement_attachment(p_actor_id,
      jsonb_build_object('kind',target_kind,'recordId',target_id,'requirementId',disposition->>'requirementId'),
      jsonb_build_object('type','email','messageId',m.id,'partId',disposition->>'partId','confirmOtherRecord',true));
  end loop;
  if (impact->>'crossClient')::boolean and (
    exists(select 1 from public.gmail_inbox_correction_documents(m.id) d where d.client_id is distinct from target_client)
    or exists(select 1 from public.gmail_inbox_correction_usages(m.id) u where u.client_id <> target_client)) then
    raise exception 'inbox_correction_old_client_evidence_unresolved' using errcode = '22023';
  end if;
  after_state := public.gmail_inbox_correction_snapshot(m.id,target_kind,target_id);
  -- Include actual final states of requirements/records that ceased to be
  -- reachable from this email after detachment, not just its new destination.
  after_state := after_state || jsonb_build_object(
    'priorRequirements',(select coalesce(jsonb_agg(to_jsonb(r) order by r.kind,r.requirement_id),'[]'::jsonb)
      from public.gmail_inbox_correction_requirements() r where r.requirement_id in (
        select (x->>'requirement_id')::uuid from jsonb_array_elements(before_state->'requirements') x)),
    'priorRecords',(select coalesce(jsonb_agg(jsonb_build_object('kind',x->>'kind','id',x->>'id',
      'state',public.gmail_inbox_correction_record_state(x->>'kind',(x->>'id')::uuid)) order by x->>'kind',x->>'id'),'[]'::jsonb)
      from jsonb_array_elements(before_state->'records') x));
  update public.gmail_inbox_corrections set after_state = after_state where id = correction_id;
  perform set_config('app.inbox_correction_id','',true);
  insert into public.audit_logs(actor_id,action,table_name,record_id,previous_value,new_value)
    values(p_actor_id,'gmail.inbox.corrected','gmail_inbox_messages',m.id,
      jsonb_build_object('target_kind',m.target_kind,'target_id',m.target_id,'client_id',m.client_id,'communication_id',m.communication_id),
      jsonb_build_object('correction_id',correction_id,'target_kind',target_kind,'target_id',target_id,'client_id',target_client,
        'communication_id',m.communication_id,'reason',btrim(p_input->>'reason'),'filings',p_input->'filings','receipts',p_input->'receipts'));
  insert into public.activity_timeline(scope_type,scope_id,activity_type,summary,actor_id,client_visible,metadata)
    values('client',target_client,'gmail.inbox.corrected','Incoming email association corrected after impact review',p_actor_id,false,
      jsonb_build_object('message_id',m.id,'communication_id',m.communication_id,'correction_id',correction_id));
  return m.communication_id;
exception when lock_not_available then
  raise exception 'inbox_correction_busy_refresh' using errcode = 'P0001';
end;
$$;

-- Generic deletion has no impact review or last-receipt status resolution. It
-- must not become an alternate way to strip Gmail evidence, bypass verification,
-- or authorize deletion of a canonical shared object. Non-Gmail behavior and
-- commission-voucher protections remain unchanged.
create or replace function public.delete_document_safely(p_actor_id uuid,p_document_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare d public.documents%rowtype; path text;
begin
  if not exists(select 1 from public.users u where u.id = p_actor_id and u.status = 'Active' and u.role in ('Owner','Admin')) then
    raise exception 'attachment_forbidden' using errcode = '42501';
  end if;
  select * into d from public.documents where id = p_document_id for update;
  if d.id is null then return jsonb_build_object('storagePath',null); end if;
  if d.commission_id is not null or d.document_type = 'Commission Voucher' then
    raise exception 'Commission voucher originals cannot be deleted. Replace the voucher from Commissions.' using errcode = '22023';
  end if;
  if exists(select 1 from public.requirement_attachment_sources s
    where s.original_document_id = d.id or s.storage_path = d.file_path)
    or exists(select 1 from public.gmail_inbox_filings f where f.document_id = d.id or f.storage_path = d.file_path)
    or exists(select 1 from public.requirement_attachment_usages u where u.document_id = d.id and u.source_id is not null) then
    raise exception 'inbox_evidence_requires_audited_correction' using errcode = '22023';
  end if;
  perform 1 from public.clients where id = d.client_id for update;
  update public.requirement_attachment_uploads set retired_at = clock_timestamp()
    where storage_path in (select upload_path from public.requirement_attachment_usages where document_id = d.id);
  delete from public.documents where id = d.id;
  if not exists(select 1 from public.documents where file_path = d.file_path)
    and not exists(select 1 from public.requirement_attachment_sources where storage_path = d.file_path) then path := d.file_path; end if;
  insert into public.audit_logs(actor_id,action,table_name,record_id,previous_value,new_value)
    values(p_actor_id,'delete','documents',d.id,jsonb_build_object('name',d.name),jsonb_build_object('original_preserved',false));
  return jsonb_build_object('storagePath',path,'originalPreserved',false);
end;
$$;

revoke all on function
  public.gmail_inbox_record_status(text,uuid),
  public.list_gmail_inbox_targets(uuid),public.get_gmail_inbox_thread_target(text,text),
  public.gmail_inbox_correction_requirements(),public.gmail_inbox_correction_documents(uuid),
  public.gmail_inbox_correction_usages(uuid),public.gmail_inbox_correction_record_state(text,uuid),
  public.gmail_inbox_correction_outbound(uuid),public.gmail_inbox_correction_snapshot(uuid,text,uuid),
  public.guard_gmail_inbox_correction_audit(),public.prevent_requirement_original_document_move(),
  public.gmail_inbox_correction_file_blockers(uuid,text),public.gmail_inbox_correction_usage_blockers(uuid,text),
  public.gmail_inbox_correction_document_target(uuid),
  public.preview_gmail_inbox_correction(uuid,uuid,text,uuid),public.correct_gmail_inbox_message(uuid,jsonb),
  public.delete_document_safely(uuid,uuid)
  from public,anon,authenticated;
grant execute on function
  public.gmail_inbox_record_status(text,uuid),
  public.list_gmail_inbox_targets(uuid),public.get_gmail_inbox_thread_target(text,text),
  public.gmail_inbox_correction_requirements(),public.gmail_inbox_correction_documents(uuid),
  public.gmail_inbox_correction_usages(uuid),public.gmail_inbox_correction_record_state(text,uuid),
  public.gmail_inbox_correction_outbound(uuid),public.gmail_inbox_correction_snapshot(uuid,text,uuid),
  public.guard_gmail_inbox_correction_audit(),public.prevent_requirement_original_document_move(),
  public.gmail_inbox_correction_file_blockers(uuid,text),public.gmail_inbox_correction_usage_blockers(uuid,text),
  public.gmail_inbox_correction_document_target(uuid),
  public.preview_gmail_inbox_correction(uuid,uuid,text,uuid),public.correct_gmail_inbox_message(uuid,jsonb),
  public.delete_document_safely(uuid,uuid)
  to service_role;
