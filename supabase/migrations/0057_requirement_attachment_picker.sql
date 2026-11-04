-- Private immutable originals and destination-specific checklist receipts.
-- Existing filing/proposal evidence and checklist statuses are not rewritten.
create table public.requirement_attachment_sources (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  part_id text not null,
  storage_path text not null unique,
  original_document_id uuid not null unique references public.documents(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  unique(message_id, part_id),
  foreign key(message_id, part_id) references public.gmail_inbox_filings(message_id, part_id) on delete restrict
);
create table public.requirement_attachment_uploads (
  storage_path text primary key,
  actor_id uuid not null references public.users(id),
  client_id uuid not null references public.clients(id) on delete restrict,
  target_kind text not null check (target_kind in ('application','claim','travel')),
  record_id uuid not null,
  requirement_id uuid not null,
  file_name text not null check (length(file_name) between 1 and 255 and file_name !~ '[/\\[:cntrl:]]'),
  mime_type text not null check (length(mime_type) between 1 and 255),
  size bigint not null check (size between 1 and 26214400),
  expires_at timestamptz not null default clock_timestamp() + interval '2 hours',
  retired_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
create table public.requirement_attachment_usages (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.requirement_attachment_sources(id) on delete restrict,
  upload_path text unique references public.requirement_attachment_uploads(storage_path) on delete restrict,
  document_id uuid not null unique references public.documents(id) on delete cascade,
  application_requirement_id uuid references public.application_requirements(id) on delete cascade,
  claim_requirement_id uuid references public.claim_requirements(id) on delete cascade,
  travel_requirement_id uuid references public.travel_request_requirements(id) on delete cascade,
  attached_by uuid not null references public.users(id),
  attached_at timestamptz not null default clock_timestamp(),
  check (num_nonnulls(source_id, upload_path) = 1),
  check (num_nonnulls(application_requirement_id, claim_requirement_id, travel_requirement_id) = 1),
  unique(source_id, application_requirement_id),
  unique(source_id, claim_requirement_id),
  unique(source_id, travel_requirement_id)
);
create index requirement_attachment_usages_application_idx on public.requirement_attachment_usages(application_requirement_id) where application_requirement_id is not null;
create index requirement_attachment_usages_claim_idx on public.requirement_attachment_usages(claim_requirement_id) where claim_requirement_id is not null;
create index requirement_attachment_usages_travel_idx on public.requirement_attachment_usages(travel_requirement_id) where travel_requirement_id is not null;
alter table public.requirement_attachment_sources enable row level security;
alter table public.requirement_attachment_uploads enable row level security;
alter table public.requirement_attachment_usages enable row level security;
revoke all on public.requirement_attachment_sources, public.requirement_attachment_uploads, public.requirement_attachment_usages from public, anon, authenticated;
grant select, insert, update, delete on public.requirement_attachment_sources, public.requirement_attachment_uploads, public.requirement_attachment_usages to service_role;

create function public.requirement_attachment_targets()
returns table(kind text, record_id uuid, requirement_id uuid, client_id uuid, label text, status text)
language sql stable security invoker set search_path = '' as $$
  select 'application'::text, a.id, r.id, a.client_id, concat_ws(' · ', a.reference_no, r.document_name, nullif(r.applies_to,'')), r.status
    from public.application_requirements r join public.applications a on a.id = r.application_id where a.status <> 'Lead'
  union all
  select 'claim', a.id, r.id, a.client_id, concat_ws(' · ', a.reference_no, r.document_name, nullif(r.applies_to,'')), r.status
    from public.claim_requirements r join public.claims a on a.id = r.claim_id
  union all
  select 'travel', a.id, r.id, a.client_id, concat_ws(' · ', a.reference_no, r.document_name, nullif(r.applies_to,'')), r.status
    from public.travel_request_requirements r join public.travel_requests a on a.id = r.travel_request_id;
$$;

create function public.resolve_requirement_attachment_scope(p_actor_id uuid, p_scope jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare target record; client uuid; target_label text; target_status text;
begin
  if p_scope->>'type' = 'requirement' then
    select * into target from public.requirement_attachment_targets() t
      where t.kind = p_scope->'target'->>'kind' and t.record_id = (p_scope->'target'->>'recordId')::uuid
        and t.requirement_id = (p_scope->'target'->>'requirementId')::uuid;
    if not found then raise exception 'attachment_target_unavailable' using errcode = '42501'; end if;
    client := target.client_id;
    target_label := target.label; target_status := target.status;
  elsif p_scope->>'type' = 'client' then
    select id into client from public.clients where id = (p_scope->>'clientId')::uuid;
  else raise exception 'attachment_invalid_scope' using errcode = '22023'; end if;
  if client is null or not public.gmail_inbox_actor_can_read(p_actor_id, client) then
    raise exception 'attachment_forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object('clientId', client, 'label', target_label, 'status', target_status);
end;
$$;

-- Used for historical metadata and every subsequent non-checklist Inbox filing.
create function public.capture_requirement_attachment_source()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare source uuid; d public.documents%rowtype;
begin
  insert into public.requirement_attachment_sources(message_id, part_id, storage_path, original_document_id, created_at)
    values(new.message_id, new.part_id, new.storage_path, new.document_id, new.filed_at)
    on conflict(message_id, part_id) do nothing;
  select id into source from public.requirement_attachment_sources where message_id = new.message_id and part_id = new.part_id;
  select * into d from public.documents where id = new.document_id;
  if num_nonnulls(d.application_requirement_id, d.claim_requirement_id, d.travel_requirement_id) = 1 then
    insert into public.requirement_attachment_usages(source_id, document_id, application_requirement_id, claim_requirement_id,
      travel_requirement_id, attached_by, attached_at)
    values(source, d.id, d.application_requirement_id, d.claim_requirement_id, d.travel_requirement_id, new.filed_by, new.filed_at)
    on conflict(document_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger capture_requirement_attachment_source after insert on public.gmail_inbox_filings
  for each row execute function public.capture_requirement_attachment_source();
insert into public.requirement_attachment_sources(message_id, part_id, storage_path, original_document_id, created_at)
  select message_id, part_id, storage_path, document_id, filed_at from public.gmail_inbox_filings;
insert into public.requirement_attachment_usages(source_id, document_id, application_requirement_id, claim_requirement_id,
  travel_requirement_id, attached_by, attached_at)
  select s.id, d.id, d.application_requirement_id, d.claim_requirement_id, d.travel_requirement_id, f.filed_by, f.filed_at
  from public.requirement_attachment_sources s join public.gmail_inbox_filings f on f.document_id = s.original_document_id
    join public.documents d on d.id = s.original_document_id
  where num_nonnulls(d.application_requirement_id, d.claim_requirement_id, d.travel_requirement_id) = 1;

create function public.list_requirement_email_attachments(p_actor_id uuid, p_scope jsonb, p_search text default '', p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare scope jsonb; items jsonb; total integer; can_use boolean;
begin
  scope := public.resolve_requirement_attachment_scope(p_actor_id, p_scope);
  if p_offset < 0 or p_offset > 2147483600 or length(p_search) > 200 then raise exception 'attachment_invalid_page' using errcode = '22023'; end if;
  select role in ('Owner','Admin','Assistant') into can_use from public.users where id = p_actor_id and status = 'Active';
  with candidates as (
    select m.id, a.value as attachment, m.client_id, m.subject, m.from_address, m.received_at, m.target_kind, m.target_id,
      coalesce(t.label, m.target_kind) as source_label, s.id as source_id
    from public.gmail_inbox_messages m cross join lateral jsonb_array_elements(m.attachments) a(value)
    join public.gmail_inbox_record_targets() t on t.kind = m.target_kind and t.id = m.target_id and t.client_id = m.client_id
    left join public.requirement_attachment_sources s on s.message_id = m.id and s.part_id = a.value->>'partId'
    where m.client_id = (scope->>'clientId')::uuid and m.target_id is not null
      and public.gmail_inbox_actor_can_read(p_actor_id, m.client_id)
      and (p_search = '' or position(lower(p_search) in lower(concat_ws(' ', a.value->>'fileName', m.subject, m.from_address, t.label))) > 0)
  ), page as (select * from candidates order by received_at desc, id, attachment->>'partId' offset p_offset limit 26)
  select coalesce(jsonb_agg(jsonb_build_object(
    'messageId', p.id, 'partId', p.attachment->>'partId', 'clientId', p.client_id,
    'fileName', p.attachment->>'fileName', 'mimeType', p.attachment->>'mimeType', 'size', (p.attachment->>'size')::bigint,
    'subject', p.subject, 'fromAddress', p.from_address, 'receivedAt', p.received_at,
    'sourceRecord', jsonb_build_object('kind',p.target_kind,'recordId',p.target_id,'label',p.source_label,'requirementId',null),
    'stored', p.source_id is not null,
    'alreadyAttached', exists(select 1 from public.requirement_attachment_usages u where u.source_id = p.source_id
      and coalesce(u.application_requirement_id,u.claim_requirement_id,u.travel_requirement_id) = (p_scope->'target'->>'requirementId')::uuid),
    'usages', coalesce((select jsonb_agg(jsonb_build_object('kind',t.kind,'recordId',t.record_id,'label',t.label,'requirementId',t.requirement_id) order by u.attached_at, u.id)
      from public.requirement_attachment_usages u join public.requirement_attachment_targets() t
      on t.requirement_id = coalesce(u.application_requirement_id,u.claim_requirement_id,u.travel_requirement_id)
      where u.source_id = p.source_id and t.client_id = p.client_id), '[]'::jsonb)
  ) order by p.received_at desc, p.id, p.attachment->>'partId'), '[]'::jsonb), count(*) into items, total from page p;
  return jsonb_build_object('items', case when total > 25 then items - 25 else items end,
    'nextOffset', case when total > 25 then p_offset + 25 else null end, 'canUseEmail', coalesce(can_use,false));
end;
$$;

create function public.begin_requirement_attachment_upload(p_actor_id uuid, p_target jsonb, p_upload jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare scope jsonb; path text := p_upload->>'path';
begin
  scope := public.resolve_requirement_attachment_scope(p_actor_id, jsonb_build_object('type','requirement','target',p_target));
  if path is null or path !~ ('^' || (scope->>'clientId') || '/requirements/[0-9a-f-]{36}\.[a-z0-9]{1,12}$') then
    raise exception 'attachment_invalid_upload' using errcode = '22023';
  end if;
  insert into public.requirement_attachment_uploads(storage_path,actor_id,client_id,target_kind,record_id,requirement_id,file_name,mime_type,size)
    values(path,p_actor_id,(scope->>'clientId')::uuid,p_target->>'kind',(p_target->>'recordId')::uuid,
      (p_target->>'requirementId')::uuid,p_upload->>'fileName',p_upload->>'mimeType',(p_upload->>'size')::bigint);
end;
$$;

create function public.receive_requirement_attachment(p_actor_id uuid, p_target jsonb, p_source jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_variable
declare
  scope jsonb; client uuid; kind text := p_target->>'kind'; record_id uuid := (p_target->>'recordId')::uuid;
  req uuid := (p_target->>'requirementId')::uuid; req_status text;
  m public.gmail_inbox_messages%rowtype; source public.requirement_attachment_sources%rowtype;
  intent public.requirement_attachment_uploads%rowtype; usage public.requirement_attachment_usages%rowtype;
  part text := p_source->>'partId'; path text; filename text; original uuid; doc uuid; cross_record boolean; library uuid;
begin
  -- All Gmail paths serialize on the source message, including old Inbox filing.
  if p_source->>'type' = 'email' then
    if not exists(select 1 from public.users where id = p_actor_id and status = 'Active' and role in ('Owner','Admin','Assistant')) then
      raise exception 'attachment_gmail_forbidden' using errcode = '42501';
    end if;
    select * into m from public.gmail_inbox_messages where id = (p_source->>'messageId')::uuid for update;
    if m.id is null or m.client_id is null or m.target_id is null or part is null
      or not exists(select 1 from jsonb_array_elements(m.attachments) a where a->>'partId' = part) then
      raise exception 'attachment_source_unavailable' using errcode = '42501';
    end if;
  elsif p_source->>'type' <> 'upload' or p_source->>'type' is null then
    raise exception 'attachment_invalid_source' using errcode = '22023';
  end if;
  scope := public.resolve_requirement_attachment_scope(p_actor_id,jsonb_build_object('type','requirement','target',p_target));
  client := (scope->>'clientId')::uuid;
  perform 1 from public.clients where id = client for update;
  if not public.gmail_inbox_actor_can_read(p_actor_id,client)
    or not public.lock_gmail_inbox_target(kind, record_id, client) then
    raise exception 'attachment_target_unavailable' using errcode = '42501';
  end if;
  -- Re-read ownership/status under the same concrete record + checklist locks.
  case kind
    when 'application' then select status into req_status from public.application_requirements where id = req and application_id = record_id for update;
    when 'claim' then select status into req_status from public.claim_requirements where id = req and claim_id = record_id for update;
    when 'travel' then select status into req_status from public.travel_request_requirements where id = req and travel_request_id = record_id for update;
    else raise exception 'attachment_invalid_target' using errcode = '22023';
  end case;
  if req_status is null or not exists(select 1 from public.requirement_attachment_targets() t where t.kind = kind
      and t.record_id = record_id and t.requirement_id = req and t.client_id = client) then
    raise exception 'attachment_target_unavailable' using errcode = '42501';
  end if;
  if p_source->>'type' = 'email' then
    if m.client_id <> client or not public.lock_gmail_inbox_target(m.target_kind,m.target_id,client) then
      raise exception 'attachment_source_unavailable' using errcode = '42501';
    end if;
    select * into source from public.requirement_attachment_sources where message_id = m.id and part_id = part;
    cross_record := (m.target_kind <> 'client' and (m.target_kind <> kind or m.target_id <> record_id)) or exists(
      select 1 from public.requirement_attachment_usages u join public.requirement_attachment_targets() t
        on t.requirement_id = coalesce(u.application_requirement_id,u.claim_requirement_id,u.travel_requirement_id)
      where u.source_id = source.id and (t.kind <> kind or t.record_id <> record_id));
    if cross_record and coalesce((p_source->>'confirmOtherRecord')::boolean,false) is not true then
      raise exception 'attachment_acknowledgement_required' using errcode = '22023';
    end if;
    select * into usage from public.requirement_attachment_usages u where u.source_id = source.id
      and coalesce(u.application_requirement_id,u.claim_requirement_id,u.travel_requirement_id) = req;
    if found then return jsonb_build_object('documentId',usage.document_id,'requirementStatus',req_status,'alreadyAttached',true); end if;
    if source.id is null then
      path := client::text || '/gmail/' || m.id::text || '/' || encode(sha256(convert_to(part,'UTF8')),'hex');
      -- Accept the previous Inbox PDF key during deployment as well as the
      -- format-neutral picker key. Whichever is filed first stays canonical.
      if p_source->>'storagePath' is null or p_source->>'storagePath' not in (path || '.bin', path || '.pdf') then
        raise exception 'attachment_invalid_original' using errcode = '22023';
      end if;
      path := p_source->>'storagePath';
      filename := p_source->>'fileName';
      if filename is null or length(filename) not between 1 and 255 or filename ~ '[/\\[:cntrl:]]' then
        raise exception 'attachment_invalid_filename' using errcode = '22023';
      end if;
      insert into public.documents(client_id,application_id,claim_id,renewal_id,travel_request_id,policy_id,document_type,name,file_path,uploaded_by,visibility,status)
      values(client,case when m.target_kind = 'application' then m.target_id end,case when m.target_kind = 'claim' then m.target_id end,
        case when m.target_kind = 'renewal' then m.target_id end,case when m.target_kind = 'travel' then m.target_id end,
        case when m.target_kind = 'policy' then m.target_id end,'Incoming Email Attachment',filename,path,p_actor_id,'Internal Only','Uploaded') returning id into original;
      insert into public.gmail_inbox_filings(message_id,part_id,document_id,purpose,storage_path,filed_by)
        values(m.id,part,original,'document',path,p_actor_id);
      update public.gmail_inbox_messages set filed_parts = jsonb_set(filed_parts,array[part],to_jsonb(original::text),true) where id = m.id;
      select * into source from public.requirement_attachment_sources where message_id = m.id and part_id = part;
    end if;
    path := source.storage_path;
    select name into filename from public.documents where id = source.original_document_id;
  else
    select * into intent from public.requirement_attachment_uploads where storage_path = p_source->>'path' for update;
    if intent.storage_path is null or intent.actor_id <> p_actor_id or intent.client_id <> client or intent.target_kind <> kind
      or intent.record_id <> record_id or intent.requirement_id <> req or intent.file_name is distinct from p_source->>'fileName'
      or intent.mime_type is distinct from p_source->>'mimeType' or intent.size is distinct from (p_source->>'size')::bigint then
      raise exception 'attachment_invalid_upload' using errcode = '42501';
    end if;
    if intent.retired_at is not null then raise exception 'attachment_upload_retired' using errcode = '22023'; end if;
    select * into usage from public.requirement_attachment_usages where upload_path = intent.storage_path;
    if found then return jsonb_build_object('documentId',usage.document_id,'requirementStatus',req_status,'alreadyAttached',true); end if;
    if intent.expires_at < clock_timestamp() then raise exception 'attachment_upload_expired' using errcode = '22023'; end if;
    path := intent.storage_path; filename := intent.file_name;
  end if;
  -- Form provenance belongs to the destination checklist, never to a supplied
  -- browser ID or to the source email's original record.
  if kind = 'application' then
    select (array_agg(f.document_library_id order by f.id))[1] into library
      from public.application_requirements r join public.application_carrier_forms f
        on f.application_id = r.application_id and f.person_name_snapshot = r.applies_to
      where r.id = req and r.application_id = record_id and lower(r.document_name) like '%application form%'
        and f.document_library_id is not null
      having count(distinct f.document_library_id) = 1;
  elsif kind = 'travel' then
    select t.carrier_form_library_id into library from public.travel_requests t
      join public.travel_request_requirements r on r.travel_request_id = t.id
      where t.id = record_id and r.id = req and lower(r.document_name) like '%application form%';
  end if;
  insert into public.documents(client_id,application_id,claim_id,travel_request_id,application_requirement_id,claim_requirement_id,travel_requirement_id,
    source_library_document_id,document_type,name,file_path,uploaded_by,visibility,status)
  values(client,case when kind = 'application' then record_id end,case when kind = 'claim' then record_id end,case when kind = 'travel' then record_id end,
    case when kind = 'application' then req end,case when kind = 'claim' then req end,case when kind = 'travel' then req end,
    library,initcap(kind) || ' Requirement',filename,path,p_actor_id,'Internal Only','Uploaded') returning id into doc;
  insert into public.requirement_attachment_usages(source_id,upload_path,document_id,application_requirement_id,claim_requirement_id,travel_requirement_id,attached_by)
    values(source.id,intent.storage_path,doc,case when kind = 'application' then req end,case when kind = 'claim' then req end,case when kind = 'travel' then req end,p_actor_id);
  if req_status <> 'Verified' then
    case kind
      when 'application' then update public.application_requirements set status = 'Received' where id = req;
      when 'claim' then update public.claim_requirements set status = 'Received' where id = req;
      when 'travel' then update public.travel_request_requirements set status = 'Received' where id = req;
    end case;
    req_status := 'Received';
  end if;
  insert into public.audit_logs(actor_id,action,table_name,record_id,new_value) values(p_actor_id,'requirement.attachment_received','documents',doc,
    jsonb_build_object('requirement_id',req,'target_kind',kind,'target_id',record_id,'source_id',source.id,'requirement_status',req_status));
  insert into public.activity_timeline(scope_type,scope_id,activity_type,summary,actor_id,metadata)
    values('client',client,'document.uploaded','Checklist attachment received',p_actor_id,jsonb_build_object('document_id',doc,'requirement_id',req));
  return jsonb_build_object('documentId',doc,'requirementStatus',req_status,'alreadyAttached',false);
end;
$$;

create function public.get_requirement_attachment_original(p_actor_id uuid, p_message_id uuid, p_part_id text)
returns text language plpgsql stable security invoker set search_path = '' as $$
declare path text;
begin
  if not exists(select 1 from public.gmail_inbox_messages m join public.gmail_inbox_record_targets() t
      on t.kind = m.target_kind and t.id = m.target_id and t.client_id = m.client_id
      where m.id = p_message_id and public.gmail_inbox_actor_can_read(p_actor_id,m.client_id)
        and exists(select 1 from jsonb_array_elements(m.attachments) a where a->>'partId' = p_part_id)) then
    raise exception 'attachment_source_unavailable' using errcode = '42501';
  end if;
  select storage_path into path from public.requirement_attachment_sources where message_id = p_message_id and part_id = p_part_id;
  return path;
end;
$$;

-- Delete the association, never a shared original. Legacy first filings retain
-- their immutable source document while its checklist columns are detached.
create function public.delete_document_safely(p_actor_id uuid,p_document_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare d public.documents%rowtype; path text; preserved boolean := false;
begin
  if not exists(select 1 from public.users u where u.id = p_actor_id and u.status = 'Active' and u.role in ('Owner','Admin')) then
    raise exception 'attachment_forbidden' using errcode = '42501';
  end if;
  select * into d from public.documents where id = p_document_id for update;
  if d.id is null then return jsonb_build_object('storagePath',null); end if;
  perform 1 from public.clients where id = d.client_id for update;
  if exists(select 1 from public.requirement_attachment_sources where original_document_id = d.id)
      or exists(select 1 from public.gmail_inbox_filings where document_id = d.id) then
    if not exists(select 1 from public.requirement_attachment_usages where document_id = d.id) then
      raise exception 'attachment_original_is_immutable' using errcode = '22023';
    end if;
    delete from public.requirement_attachment_usages where document_id = d.id;
    update public.documents set application_requirement_id = null, claim_requirement_id = null, travel_requirement_id = null where id = d.id;
    preserved := true;
  else
    -- Retiring the signed-upload intent prevents a retry from recreating a
    -- reference after this transaction authorizes physical object deletion.
    update public.requirement_attachment_uploads set retired_at = clock_timestamp()
      where storage_path in (select upload_path from public.requirement_attachment_usages where document_id = d.id);
    delete from public.documents where id = d.id;
    if not exists(select 1 from public.documents where file_path = d.file_path)
      and not exists(select 1 from public.requirement_attachment_sources where storage_path = d.file_path) then path := d.file_path; end if;
  end if;
  insert into public.audit_logs(actor_id,action,table_name,record_id,previous_value,new_value)
    values(p_actor_id,'delete','documents',d.id,jsonb_build_object('name',d.name),jsonb_build_object('original_preserved',preserved));
  return jsonb_build_object('storagePath',path,'originalPreserved',preserved);
end;
$$;

-- Checklist purposes use the same association transaction. Non-checklist Inbox
-- purposes retain the existing one-part filing/proposal/lifecycle guards.
create or replace function public.file_gmail_inbox_attachment(p_input jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  m public.gmail_inbox_messages%rowtype; prior public.gmail_inbox_filings%rowtype;
  actor uuid := (p_input->>'actorId')::uuid; part text := p_input->>'partId'; purpose text := p_input->>'purpose';
  requirement uuid := (p_input->>'requirementId')::uuid; supplied_requirement uuid := (p_input->>'requirementId')::uuid;
  path text := p_input->>'storagePath'; filename text := p_input->>'fileName'; doc uuid; doc_type text;
  travel_requirement uuid; req_status text; receipt jsonb;
begin
  if not exists(select 1 from public.users where id = actor and status = 'Active' and role in ('Owner','Admin','Assistant')) then
    raise exception 'inbox_forbidden' using errcode = '42501';
  end if;
  select * into m from public.gmail_inbox_messages where id = (p_input->>'messageId')::uuid for update;
  if m.id is null or m.target_id is null then raise exception 'inbox_link_required' using errcode = '22023'; end if;
  if purpose in ('application_requirement','claim_requirement','travel_requirement') then
    if requirement is null or purpose <> m.target_kind || '_requirement' then raise exception 'inbox_invalid_requirement' using errcode = '22023'; end if;
    receipt := public.receive_requirement_attachment(actor,jsonb_build_object('kind',m.target_kind,'recordId',m.target_id,'requirementId',requirement),
      jsonb_build_object('type','email','messageId',m.id,'partId',part,'confirmOtherRecord',false,'storagePath',path,'fileName',filename));
    return (receipt->>'documentId')::uuid;
  end if;
  if part is null or not exists(select 1 from jsonb_array_elements(m.attachments) a where a->>'partId' = part)
    or purpose is null or purpose not in ('document','proposal','travel_policy','travel_application_copy')
    or filename is null or length(filename) not between 1 and 255 or filename ~ '[/\\[:cntrl:]]'
    or path is distinct from m.client_id::text || '/gmail/' || m.id::text || '/' || encode(sha256(convert_to(part,'UTF8')),'hex') || '.pdf' then
    raise exception 'inbox_invalid_filing' using errcode = '22023';
  end if;
  select * into prior from public.gmail_inbox_filings where message_id = m.id and part_id = part;
  if found then
    if prior.purpose is distinct from purpose or prior.requirement_id is distinct from supplied_requirement or prior.storage_path is distinct from path then
      raise exception 'inbox_filing_conflict' using errcode = '22023';
    end if;
    return prior.document_id;
  end if;
  perform 1 from public.clients where id = m.client_id for update;
  if not found or not public.lock_gmail_inbox_target(m.target_kind,m.target_id,m.client_id) then raise exception 'inbox_target_unavailable' using errcode = '22023'; end if;
  if purpose <> 'travel_policy' and requirement is not null then raise exception 'inbox_invalid_requirement' using errcode = '22023'; end if;
  doc_type := 'Incoming Email Attachment';
  if purpose in ('travel_policy','travel_application_copy') then
    if m.target_kind <> 'travel' then raise exception 'inbox_invalid_purpose' using errcode = '22023'; end if;
    if purpose = 'travel_policy' then
      doc_type := 'Travel Policy';
      if requirement is null then select id into requirement from public.travel_request_requirements
        where travel_request_id = m.target_id and document_name = 'Issued Travel policy' order by sort_order,id limit 1; end if;
      if requirement is not null then
        select status into req_status from public.travel_request_requirements where id = requirement and travel_request_id = m.target_id and document_name = 'Issued Travel policy' for update;
        if not found then raise exception 'inbox_invalid_requirement' using errcode = '22023'; end if;
        travel_requirement := requirement;
      end if;
    else doc_type := 'Travel Application Copy'; end if;
  end if;
  if purpose = 'proposal' then
    doc := public.register_proposal_receipt(jsonb_build_object('actorId',actor,'targetKind',m.target_kind,'targetId',m.target_id,'storagePath',path,'name',filename));
  else
    insert into public.documents(client_id,application_id,claim_id,renewal_id,travel_request_id,policy_id,travel_requirement_id,document_type,name,file_path,uploaded_by,visibility,status)
      values(m.client_id,case when m.target_kind = 'application' then m.target_id end,case when m.target_kind = 'claim' then m.target_id end,
        case when m.target_kind = 'renewal' then m.target_id end,case when m.target_kind = 'travel' then m.target_id end,
        case when m.target_kind = 'policy' then m.target_id end,travel_requirement,doc_type,filename,path,actor,'Internal Only','Uploaded') returning id into doc;
  end if;
  if travel_requirement is not null then update public.travel_request_requirements set status = 'Received' where id = travel_requirement and status <> 'Verified'; end if;
  insert into public.gmail_inbox_filings(message_id,part_id,document_id,purpose,requirement_id,storage_path,filed_by)
    values(m.id,part,doc,purpose,supplied_requirement,path,actor);
  update public.gmail_inbox_messages set filed_parts = jsonb_set(filed_parts,array[part],to_jsonb(doc::text),true) where id = m.id;
  insert into public.audit_logs(actor_id,action,table_name,record_id,new_value) values(actor,'gmail.inbox.attachment_filed','documents',doc,
    jsonb_build_object('message_id',m.id,'purpose',purpose,'target_kind',m.target_kind,'target_id',m.target_id,'requirement_id',requirement,
      'requirement_status',case when requirement is null then null when req_status = 'Verified' then 'Verified' else 'Received' end));
  if purpose <> 'proposal' then insert into public.activity_timeline(scope_type,scope_id,activity_type,summary,actor_id,metadata)
    values('client',m.client_id,'document.uploaded','Incoming Gmail attachment filed by staff',actor,jsonb_build_object('document_id',doc,'message_id',m.id,'purpose',purpose)); end if;
  return doc;
end;
$$;

revoke all on function public.requirement_attachment_targets(), public.resolve_requirement_attachment_scope(uuid,jsonb),
  public.capture_requirement_attachment_source(), public.list_requirement_email_attachments(uuid,jsonb,text,integer),
  public.begin_requirement_attachment_upload(uuid,jsonb,jsonb), public.receive_requirement_attachment(uuid,jsonb,jsonb),
  public.get_requirement_attachment_original(uuid,uuid,text), public.delete_document_safely(uuid,uuid),
  public.file_gmail_inbox_attachment(jsonb) from public, anon, authenticated;
grant execute on function public.requirement_attachment_targets(), public.resolve_requirement_attachment_scope(uuid,jsonb),
  public.capture_requirement_attachment_source(), public.list_requirement_email_attachments(uuid,jsonb,text,integer),
  public.begin_requirement_attachment_upload(uuid,jsonb,jsonb), public.receive_requirement_attachment(uuid,jsonb,jsonb),
  public.get_requirement_attachment_original(uuid,uuid,text), public.delete_document_safely(uuid,uuid),
  public.file_gmail_inbox_attachment(jsonb) to service_role;

-- Source evidence is append-only, even for service-role callers. Requirement
-- associations can be removed without permitting a filing or its bytes to move.
create function public.prevent_requirement_attachment_source_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'attachment_original_is_immutable' using errcode = '22023';
end;
$$;
create trigger immutable_requirement_attachment_source before update or delete on public.requirement_attachment_sources
  for each row execute function public.prevent_requirement_attachment_source_change();
create trigger immutable_gmail_inbox_filing before update or delete on public.gmail_inbox_filings
  for each row execute function public.prevent_requirement_attachment_source_change();

create function public.prevent_requirement_original_document_move()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists(select 1 from public.requirement_attachment_sources where original_document_id = old.id) then
    raise exception 'attachment_original_is_immutable' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger immutable_requirement_original_document before update on public.documents
  for each row when (new.file_path is distinct from old.file_path or new.client_id is distinct from old.client_id
    or new.application_id is distinct from old.application_id or new.claim_id is distinct from old.claim_id
    or new.travel_request_id is distinct from old.travel_request_id or new.renewal_id is distinct from old.renewal_id
    or new.policy_id is distinct from old.policy_id)
  execute function public.prevent_requirement_original_document_move();
revoke all on function public.prevent_requirement_attachment_source_change(), public.prevent_requirement_original_document_move() from public, anon, authenticated;
grant execute on function public.prevent_requirement_attachment_source_change(), public.prevent_requirement_original_document_move() to service_role;
