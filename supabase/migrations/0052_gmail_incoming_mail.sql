-- Forward-only incoming Gmail evidence. No browser access and no Gmail mutations.
create table public.gmail_inbox_sync (
  id text primary key default 'agency' check (id = 'agency'),
  google_subject text not null check (length(google_subject) between 1 and 255),
  oauth_client_id text not null check (length(oauth_client_id) between 1 and 255),
  enabled_at timestamptz not null,
  enabled_by uuid not null references public.users(id),
  history_id text not null check (history_id ~ '^[0-9]{1,40}$'),
  page_token text check (octet_length(page_token) between 1 and 524288),
  recovery_history_id text check (recovery_history_id ~ '^[0-9]{1,40}$'),
  watch_expires_at timestamptz,
  last_synced_at timestamptz,
  last_error text check (last_error ~ '^[a-zA-Z0-9_-]{1,64}$'),
  pending boolean not null default true,
  notification_version bigint not null default 0,
  lease_token text check (length(lease_token) between 1 and 128),
  lease_until timestamptz,
  lease_notification_version bigint,
  lease_history_id text,
  lease_page_token text,
  lease_recovery_history_id text,
  check ((lease_token is null) = (lease_until is null))
);

create table public.gmail_inbox_notifications (
  message_id text primary key check (length(message_id) between 1 and 255),
  history_id text not null check (history_id ~ '^[0-9]{1,40}$'),
  email_address text not null check (email_address = 'admin@pacificinsuranceph.com'),
  subscription text not null check (subscription = 'projects/pacific-insurane-ph/subscriptions/pacific-gmail-inbox-push'),
  received_at timestamptz not null default clock_timestamp()
);

create table public.gmail_inbox_messages (
  id uuid primary key default gen_random_uuid(),
  google_subject text not null,
  gmail_message_id text not null check (gmail_message_id ~ '^[a-zA-Z0-9_-]{1,255}$'),
  gmail_thread_id text not null check (gmail_thread_id ~ '^[a-zA-Z0-9_-]{1,255}$'),
  rfc_message_id text check (octet_length(rfc_message_id) <= 4096),
  in_reply_to text check (octet_length(in_reply_to) <= 4096),
  message_references text[] not null default '{}',
  from_address text not null check (length(from_address) between 1 and 320),
  from_name text not null check (octet_length(from_name) <= 4096),
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text not null check (octet_length(subject) <= 16384),
  body_text text not null check (octet_length(body_text) <= 131072),
  body_truncated boolean not null,
  received_at timestamptz not null,
  attachments jsonb not null check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 100),
  is_auto_reply boolean not null,
  authentication_results text check (octet_length(authentication_results) <= 16384),
  target_kind text check (target_kind in ('client','application','claim','renewal','travel','policy')),
  target_id uuid,
  client_id uuid references public.clients(id) on delete restrict,
  communication_id uuid unique references public.communications(id) on delete restrict,
  linked_by uuid references public.users(id),
  linked_at timestamptz,
  filed_parts jsonb not null default '{}' check (jsonb_typeof(filed_parts) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  unique (google_subject, gmail_message_id),
  check ((target_kind is null and target_id is null and client_id is null and communication_id is null and linked_by is null and linked_at is null)
    or (target_kind is not null and target_id is not null and client_id is not null and communication_id is not null and linked_by is not null and linked_at is not null)),
  check (cardinality(message_references) <= 100 and cardinality(to_addresses) <= 100 and cardinality(cc_addresses) <= 100)
);
create index gmail_inbox_messages_received_idx on public.gmail_inbox_messages(received_at desc, id);
create index gmail_inbox_messages_client_idx on public.gmail_inbox_messages(client_id, received_at desc);
create index gmail_inbox_messages_thread_idx on public.gmail_inbox_messages(google_subject, gmail_thread_id);

create table public.gmail_inbox_filings (
  message_id uuid not null references public.gmail_inbox_messages(id) on delete restrict,
  part_id text not null,
  document_id uuid not null unique references public.documents(id) on delete restrict,
  purpose text not null check (purpose in ('document','proposal','application_requirement','claim_requirement','travel_requirement','travel_policy','travel_application_copy')),
  requirement_id uuid,
  storage_path text not null unique,
  filed_by uuid not null references public.users(id),
  filed_at timestamptz not null default clock_timestamp(),
  primary key(message_id, part_id)
);

alter table public.gmail_inbox_sync enable row level security;
alter table public.gmail_inbox_notifications enable row level security;
alter table public.gmail_inbox_messages enable row level security;
alter table public.gmail_inbox_filings enable row level security;
revoke all on table public.gmail_inbox_sync, public.gmail_inbox_notifications, public.gmail_inbox_messages, public.gmail_inbox_filings from public, anon, authenticated;
grant select, insert, update on table public.gmail_inbox_sync, public.gmail_inbox_notifications, public.gmail_inbox_messages, public.gmail_inbox_filings to service_role;

-- DB roles Owner/Admin = Admin, Assistant = Staff, Viewer = assigned-client Agent.
create function public.gmail_inbox_actor_can_read(p_actor_id uuid, p_client_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.users u where u.id = p_actor_id and u.status = 'Active'
    and (u.role in ('Owner','Admin') or (p_client_id is not null and (u.role = 'Assistant'
      or (u.role = 'Viewer' and exists (select 1 from public.clients c where c.id = p_client_id and c.assigned_user_id = u.id))))));
$$;

-- Source ownership and participant addresses always come from the source records,
-- never the browser or an email's untrusted references.
create function public.gmail_inbox_record_targets()
returns table(kind text, id uuid, client_id uuid, label text, participants text[])
language sql stable security invoker set search_path = '' as $$
  select 'client'::text, c.id, c.id,
    concat_ws(' · ', c.reference_no, concat_ws(' ', c.first_name, c.last_name)),
    array_remove(array[nullif(lower(btrim(c.email)), '')], null)
  from public.clients c
  union all
  select 'application', a.id, c.id, concat_ws(' · ', a.reference_no, concat_ws(' ', c.first_name, c.last_name)),
    array_remove(array[nullif(lower(btrim(c.email)), ''), nullif(lower(btrim(e.email)), '')], null)
  from public.applications a join public.clients c on c.id = a.client_id left join public.external_contacts e on e.id = a.pacific_cross_contact_id
  union all
  select 'claim', a.id, c.id, concat_ws(' · ', a.reference_no, concat_ws(' ', c.first_name, c.last_name)),
    array_remove(array[nullif(lower(btrim(c.email)), ''), nullif(lower(btrim(e.email)), '')], null)
  from public.claims a join public.clients c on c.id = a.client_id left join public.external_contacts e on e.id = a.pacific_cross_contact_id
  union all
  select 'renewal', a.id, c.id, concat_ws(' · ', a.reference_no, p.policy_number, concat_ws(' ', c.first_name, c.last_name)),
    array_remove(array[nullif(lower(btrim(c.email)), ''), nullif(lower(btrim(e.email)), '')], null)
  from public.renewals a join public.clients c on c.id = a.client_id join public.policies p on p.id = a.policy_id left join public.external_contacts e on e.id = p.pacific_cross_contact_id
  union all
  select 'travel', a.id, c.id, concat_ws(' · ', a.reference_no, a.policy_number, concat_ws(' ', c.first_name, c.last_name)),
    array_remove(array[nullif(lower(btrim(c.email)), '')], null)
  from public.travel_requests a join public.clients c on c.id = a.client_id
  union all
  select 'policy', a.id, c.id, concat_ws(' · ', a.reference_no, a.policy_number, concat_ws(' ', c.first_name, c.last_name)),
    array_remove(array[nullif(lower(btrim(c.email)), ''), nullif(lower(btrim(e.email)), '')], null)
  from public.policies a join public.clients c on c.id = a.client_id left join public.external_contacts e on e.id = a.pacific_cross_contact_id;
$$;

-- Hold the concrete source row while creating its association; a concurrent
-- reassignment must not produce a cross-client communication or document.
create function public.lock_gmail_inbox_target(p_kind text, p_target_id uuid, p_client_id uuid)
returns boolean language plpgsql volatile security invoker set search_path = '' as $$
begin
  case p_kind
    when 'client' then perform 1 from public.clients where id = p_target_id and id = p_client_id for update;
    when 'application' then perform 1 from public.applications where id = p_target_id and client_id = p_client_id for update;
    when 'claim' then perform 1 from public.claims where id = p_target_id and client_id = p_client_id for update;
    when 'renewal' then perform 1 from public.renewals where id = p_target_id and client_id = p_client_id for update;
    when 'travel' then perform 1 from public.travel_requests where id = p_target_id and client_id = p_client_id for update;
    when 'policy' then perform 1 from public.policies where id = p_target_id and client_id = p_client_id for update;
    else return false;
  end case;
  return found;
end;
$$;

create function public.enable_gmail_inbox(p_input jsonb, p_actor_id uuid)
returns setof public.gmail_inbox_sync language plpgsql security invoker set search_path = '' as $$
declare s public.gmail_inbox_sync%rowtype;
begin
  if not exists (select 1 from public.users where id = p_actor_id and status = 'Active' and role in ('Owner','Admin')) then
    raise exception 'inbox_forbidden' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(518107, 2);
  perform 1 from public.gmail_connections c where c.id = 'agency' and c.status = 'connected'
    and c.google_subject = p_input->>'googleSubject' and c.oauth_client_id = p_input->>'oauthClientId'
    and c.granted_scopes @> array['https://www.googleapis.com/auth/gmail.readonly']::text[] for share;
  if not found then raise exception 'inbox_identity_mismatch' using errcode = '22023'; end if;
  select * into s from public.gmail_inbox_sync where id = 'agency' for update;
  if found then
    if s.google_subject is distinct from p_input->>'googleSubject' or s.oauth_client_id is distinct from p_input->>'oauthClientId' then
      raise exception 'inbox_identity_mismatch' using errcode = '22023';
    end if;
    return next s; return;
  end if;
  if (p_input->>'enabledAt')::timestamptz > clock_timestamp() + interval '1 minute' then
    raise exception 'inbox_invalid_boundary' using errcode = '22023';
  end if;
  insert into public.gmail_inbox_sync(google_subject, oauth_client_id, enabled_at, enabled_by, history_id, watch_expires_at)
    values(p_input->>'googleSubject', p_input->>'oauthClientId', (p_input->>'enabledAt')::timestamptz, p_actor_id,
      p_input->>'historyId', (p_input->>'watchExpiresAt')::timestamptz) returning * into s;
  insert into public.audit_logs(actor_id, action, table_name, new_value) values(p_actor_id, 'gmail.inbox.enabled', 'gmail_inbox_sync',
    jsonb_build_object('connection_id', 'agency', 'enabled_at', s.enabled_at));
  return next s;
end;
$$;

create function public.update_gmail_inbox_watch(p_google_subject text, p_expires_at timestamptz)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.gmail_inbox_sync set watch_expires_at = p_expires_at where id = 'agency' and google_subject = p_google_subject;
  if not found then raise exception 'inbox_identity_mismatch' using errcode = '22023'; end if;
end;
$$;

create function public.claim_gmail_inbox_sync(p_lease_token text)
returns setof public.gmail_inbox_sync language sql volatile security invoker set search_path = '' as $$
  update public.gmail_inbox_sync s set lease_token = p_lease_token, lease_until = clock_timestamp() + interval '90 seconds',
    lease_notification_version = s.notification_version, lease_history_id = s.history_id,
    lease_page_token = s.page_token, lease_recovery_history_id = s.recovery_history_id
  where s.id = 'agency' and (s.lease_until is null or s.lease_until <= clock_timestamp())
    and exists (select 1 from public.gmail_connections c where c.id = 'agency' and c.status = 'connected'
      and c.google_subject = s.google_subject and c.oauth_client_id = s.oauth_client_id
      and c.granted_scopes @> array['https://www.googleapis.com/auth/gmail.readonly']::text[])
  returning s.*;
$$;

create function public.commit_gmail_inbox_sync(p_input jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare s public.gmail_inbox_sync%rowtype; m jsonb; a jsonb; done boolean; next_history text;
begin
  select * into s from public.gmail_inbox_sync where id = 'agency' for update;
  if s.id is null or s.lease_token is null or s.lease_until is null
    or s.lease_token is distinct from p_input->>'leaseToken' or s.lease_until <= clock_timestamp()
    or s.history_id is distinct from s.lease_history_id or s.page_token is distinct from s.lease_page_token
    or s.recovery_history_id is distinct from s.lease_recovery_history_id then
    raise exception 'inbox_lease_lost' using errcode = '40001';
  end if;
  perform 1 from public.gmail_connections c where c.id = 'agency' and c.status = 'connected'
    and c.google_subject = s.google_subject and c.oauth_client_id = s.oauth_client_id
    and c.granted_scopes @> array['https://www.googleapis.com/auth/gmail.readonly']::text[] for share;
  if not found then raise exception 'inbox_identity_mismatch' using errcode = '22023'; end if;
  done := (p_input->>'complete')::boolean;
  next_history := p_input->>'historyId';
  if done is null or next_history is null or next_history !~ '^[0-9]{1,40}$'
    or next_history::numeric < s.history_id::numeric
    or jsonb_typeof(p_input->'messages') is distinct from 'array' or jsonb_array_length(p_input->'messages') > 100
    or (s.recovery_history_id is not null and
      ((done and next_history is distinct from s.recovery_history_id)
        or (not done and p_input->>'recoveryHistoryId' is distinct from s.recovery_history_id)))
    or (done and (p_input->>'pageToken' is not null or p_input->>'recoveryHistoryId' is not null)) then
    raise exception 'inbox_invalid_checkpoint' using errcode = '22023';
  end if;
  for m in select value from jsonb_array_elements(p_input->'messages') loop
    if (m->>'receivedAt')::timestamptz < s.enabled_at or jsonb_typeof(m->'attachments') is distinct from 'array'
      or jsonb_array_length(m->'attachments') > 100 then
      raise exception 'inbox_invalid_message' using errcode = '22023';
    end if;
    for a in select value from jsonb_array_elements(m->'attachments') loop
      if jsonb_typeof(a) is distinct from 'object' or a->>'partId' is null or length(a->>'partId') > 255
        or coalesce(length(a->>'fileName'), 0) not between 1 and 1024 or coalesce(length(a->>'mimeType'), 0) not between 1 and 255
        or (a->>'size') is null or (a->>'size')::bigint not between 0 and 26214400
        or length(a->>'attachmentId') > 2048 or a ? 'data' then
        raise exception 'inbox_invalid_attachment' using errcode = '22023';
      end if;
    end loop;
    if (select count(*) <> count(distinct value->>'partId') from jsonb_array_elements(m->'attachments')) then
      raise exception 'inbox_duplicate_part' using errcode = '22023';
    end if;
    insert into public.gmail_inbox_messages(google_subject, gmail_message_id, gmail_thread_id, rfc_message_id, in_reply_to,
      message_references, from_address, from_name, to_addresses, cc_addresses, subject, body_text, body_truncated,
      received_at, attachments, is_auto_reply, authentication_results)
    values(s.google_subject, m->>'gmailMessageId', m->>'gmailThreadId', m->>'rfcMessageId', m->>'inReplyTo',
      array(select jsonb_array_elements_text(m->'references')), m->>'fromAddress', m->>'fromName',
      array(select jsonb_array_elements_text(m->'toAddresses')), array(select jsonb_array_elements_text(m->'ccAddresses')),
      m->>'subject', m->>'bodyText', (m->>'bodyTruncated')::boolean, (m->>'receivedAt')::timestamptz,
      (select coalesce(jsonb_agg(jsonb_build_object('partId', a->>'partId', 'attachmentId', a->>'attachmentId',
        'fileName', a->>'fileName', 'mimeType', a->>'mimeType', 'size', (a->>'size')::bigint)), '[]'::jsonb)
        from jsonb_array_elements(m->'attachments') a),
      (m->>'isAutoReply')::boolean, m->>'authenticationResults')
    on conflict(google_subject, gmail_message_id) do nothing;
  end loop;
  update public.gmail_inbox_sync set
    history_id = case when done then next_history else history_id end,
    page_token = p_input->>'pageToken', recovery_history_id = p_input->>'recoveryHistoryId',
    lease_history_id = case when done then null else history_id end,
    lease_page_token = case when done then null else p_input->>'pageToken' end,
    lease_recovery_history_id = case when done then null else p_input->>'recoveryHistoryId' end,
    lease_token = case when done then null else lease_token end,
    lease_until = case when done then null else clock_timestamp() + interval '90 seconds' end,
    pending = case when done then notification_version <> lease_notification_version else true end,
    last_synced_at = case when done then clock_timestamp() else last_synced_at end, last_error = null
  where id = 'agency' and lease_token = s.lease_token;
end;
$$;

create function public.release_gmail_inbox_sync(p_lease_token text, p_error_code text default null)
returns void language sql volatile security invoker set search_path = '' as $$
  update public.gmail_inbox_sync set lease_token = null, lease_until = null,
    lease_history_id = null, lease_page_token = null, lease_recovery_history_id = null,
    last_error = p_error_code, pending = case when p_error_code is not null then true else pending end
  where id = 'agency' and lease_token = p_lease_token;
$$;

create function public.enqueue_gmail_inbox_notification(p_input jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.gmail_inbox_notifications(message_id, history_id, email_address, subscription)
    values(p_input->>'messageId', p_input->>'historyId', lower(p_input->>'emailAddress'), p_input->>'subscription')
    on conflict(message_id) do nothing;
  if found then
    update public.gmail_inbox_sync set pending = true, notification_version = notification_version + 1 where id = 'agency';
  end if;
end;
$$;

create function public.list_gmail_inbox_messages(p_actor_id uuid, p_message_id uuid default null, p_offset integer default 0)
returns setof public.gmail_inbox_messages language sql stable security invoker set search_path = '' as $$
  select m.* from public.gmail_inbox_messages m where (p_message_id is null or m.id = p_message_id)
    and public.gmail_inbox_actor_can_read(p_actor_id, m.client_id)
  order by m.received_at desc, m.id desc limit 100 offset greatest(coalesce(p_offset, 0), 0);
$$;

create function public.list_gmail_inbox_targets(p_actor_id uuid)
returns table(kind text, id uuid, client_id uuid, label text, participants text[])
language sql stable security invoker set search_path = '' as $$
  select r.* from public.gmail_inbox_record_targets() r where public.gmail_inbox_actor_can_read(p_actor_id, r.client_id)
  order by r.kind, r.label, r.id;
$$;

create function public.get_gmail_inbox_thread_target(p_google_subject text, p_gmail_thread_id text)
returns table(kind text, id uuid, client_id uuid, label text, participants text[])
language sql stable security invoker set search_path = '' as $$
  with established as (
    select distinct m.target_kind, m.target_id from public.gmail_inbox_messages m
    where m.google_subject = p_google_subject and m.gmail_thread_id = p_gmail_thread_id and m.target_kind is not null
  ) select r.* from public.gmail_inbox_record_targets() r join established e on e.target_kind = r.kind and e.target_id = r.id
    where (select count(*) from established) = 1;
$$;

create function public.link_gmail_inbox_message(p_message_id uuid, p_kind text, p_target_id uuid, p_actor_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare m public.gmail_inbox_messages%rowtype; target_client uuid; communication uuid;
begin
  select * into m from public.gmail_inbox_messages where id = p_message_id for update;
  if m.id is null or not public.gmail_inbox_actor_can_read(p_actor_id, m.client_id) then
    raise exception 'inbox_unavailable' using errcode = '42501';
  end if;
  if m.target_id is not null then
    if m.target_kind = p_kind and m.target_id = p_target_id then return m.communication_id; end if;
    raise exception 'inbox_already_linked' using errcode = '22023';
  end if;
  if not exists(select 1 from public.users where id = p_actor_id and status = 'Active' and role in ('Owner','Admin')) then
    raise exception 'inbox_forbidden' using errcode = '42501';
  end if;
  select r.client_id into target_client from public.gmail_inbox_record_targets() r where r.kind = p_kind and r.id = p_target_id;
  if target_client is null then raise exception 'inbox_target_unavailable' using errcode = '22023'; end if;
  perform 1 from public.clients where id = target_client for update;
  if not public.lock_gmail_inbox_target(p_kind, p_target_id, target_client) then
    raise exception 'inbox_target_unavailable' using errcode = '22023';
  end if;
  insert into public.communications(client_id, application_id, claim_id, renewal_id, travel_request_id, policy_id,
    direction, channel, subject, summary, occurred_at, related_user_id, email_thread_id, delivery_status, notes)
  values(target_client, case when p_kind = 'application' then p_target_id end, case when p_kind = 'claim' then p_target_id end,
    case when p_kind = 'renewal' then p_target_id end, case when p_kind = 'travel' then p_target_id end,
    case when p_kind = 'policy' then p_target_id end, 'Inbound', 'Gmail', m.subject, 'Incoming Gmail correspondence',
    m.received_at, p_actor_id, m.gmail_thread_id, 'received', m.body_text) returning id into communication;
  update public.gmail_inbox_messages set target_kind = p_kind, target_id = p_target_id, client_id = target_client,
    communication_id = communication, linked_by = p_actor_id, linked_at = clock_timestamp() where id = m.id;
  insert into public.audit_logs(actor_id, action, table_name, record_id, new_value)
    values(p_actor_id, 'gmail.inbox.linked', 'gmail_inbox_messages', m.id,
      jsonb_build_object('target_kind', p_kind, 'target_id', p_target_id, 'client_id', target_client, 'communication_id', communication));
  return communication;
end;
$$;

create function public.file_gmail_inbox_attachment(p_input jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  m public.gmail_inbox_messages%rowtype; prior public.gmail_inbox_filings%rowtype;
  actor uuid := (p_input->>'actorId')::uuid; part text := p_input->>'partId'; purpose text := p_input->>'purpose';
  requirement uuid := (p_input->>'requirementId')::uuid; supplied_requirement uuid := (p_input->>'requirementId')::uuid;
  path text := p_input->>'storagePath'; filename text := p_input->>'fileName'; doc uuid; doc_type text;
  app_requirement uuid; claim_requirement uuid; travel_requirement uuid; source_status text; req_status text;
  client_row public.clients%rowtype; old_doc record;
begin
  if not exists(select 1 from public.users where id = actor and status = 'Active' and role in ('Owner','Admin','Assistant')) then
    raise exception 'inbox_forbidden' using errcode = '42501';
  end if;
  select * into m from public.gmail_inbox_messages where id = (p_input->>'messageId')::uuid for update;
  if m.id is null or m.target_id is null then raise exception 'inbox_link_required' using errcode = '22023'; end if;
  if part is null or not exists(select 1 from jsonb_array_elements(m.attachments) a where a->>'partId' = part)
    or purpose is null or purpose not in ('document','proposal','application_requirement','claim_requirement','travel_requirement','travel_policy','travel_application_copy')
    or filename is null or length(filename) not between 1 and 255 or filename ~ '[/\\[:cntrl:]]'
    or path is distinct from m.client_id::text || '/gmail/' || m.id::text || '/' || encode(sha256(convert_to(part, 'UTF8')), 'hex') || '.pdf' then
    raise exception 'inbox_invalid_filing' using errcode = '22023';
  end if;
  -- Check the already-confirmed receipt before lifecycle gates: retrying later
  -- must not reset an advanced requirement/proposal or create another document.
  select * into prior from public.gmail_inbox_filings where message_id = m.id and part_id = part;
  if found then
    if prior.purpose is distinct from purpose or prior.requirement_id is distinct from supplied_requirement or prior.storage_path is distinct from path then
      raise exception 'inbox_filing_conflict' using errcode = '22023';
    end if;
    return prior.document_id;
  end if;
  -- Serializes proposal replacement and client lifecycle checks across messages.
  select * into client_row from public.clients where id = m.client_id for update;
  if not found or not public.lock_gmail_inbox_target(m.target_kind, m.target_id, m.client_id) then
    raise exception 'inbox_target_unavailable' using errcode = '22023';
  end if;
  if purpose not in ('application_requirement','claim_requirement','travel_requirement','travel_policy') and requirement is not null then
    raise exception 'inbox_invalid_requirement' using errcode = '22023';
  end if;
  doc_type := 'Incoming Email Attachment';
  if purpose = 'proposal' then
    doc_type := 'Illustrative Proposal';
    if m.target_kind = 'client' then
      if client_row.lifecycle_stage <> 'Lead' or (client_row.proposal_status is not null and client_row.proposal_status <> 'Requested') then
        raise exception 'inbox_proposal_not_receivable' using errcode = '22023';
      end if;
    elsif m.target_kind = 'application' then
      select status into source_status from public.applications where id = m.target_id and client_id = m.client_id for update;
      if source_status is null or source_status = 'Lead' then raise exception 'inbox_application_unavailable' using errcode = '22023'; end if;
    else raise exception 'inbox_invalid_purpose' using errcode = '22023'; end if;
  elsif purpose = 'application_requirement' then
    if m.target_kind <> 'application' or requirement is null then raise exception 'inbox_invalid_requirement' using errcode = '22023'; end if;
    select status into source_status from public.applications where id = m.target_id and client_id = m.client_id for update;
    if source_status is null or source_status = 'Lead' then raise exception 'inbox_application_unavailable' using errcode = '22023'; end if;
    select status into req_status from public.application_requirements where id = requirement and application_id = m.target_id for update;
    if not found then raise exception 'inbox_invalid_requirement' using errcode = '22023'; end if;
    app_requirement := requirement; doc_type := 'Application Requirement';
  elsif purpose = 'claim_requirement' then
    if m.target_kind <> 'claim' or requirement is null then raise exception 'inbox_invalid_requirement' using errcode = '22023'; end if;
    perform 1 from public.claims where id = m.target_id and client_id = m.client_id for update;
    if not found then raise exception 'inbox_target_unavailable' using errcode = '22023'; end if;
    select status into req_status from public.claim_requirements where id = requirement and claim_id = m.target_id for update;
    if not found then raise exception 'inbox_invalid_requirement' using errcode = '22023'; end if;
    claim_requirement := requirement; doc_type := 'Claim Requirement';
  elsif purpose in ('travel_requirement','travel_policy','travel_application_copy') then
    if m.target_kind <> 'travel' then raise exception 'inbox_invalid_purpose' using errcode = '22023'; end if;
    perform 1 from public.travel_requests where id = m.target_id and client_id = m.client_id for update;
    if not found then raise exception 'inbox_target_unavailable' using errcode = '22023'; end if;
    if purpose = 'travel_policy' then
      doc_type := 'Travel Policy';
      if requirement is null then
        select id into requirement from public.travel_request_requirements
          where travel_request_id = m.target_id and document_name = 'Issued Travel policy' order by sort_order, id limit 1;
      end if;
    elsif purpose = 'travel_application_copy' then doc_type := 'Travel Application Copy';
    else
      doc_type := 'Travel Requirement';
      if requirement is null then raise exception 'inbox_invalid_requirement' using errcode = '22023'; end if;
    end if;
    if requirement is not null then
      select status into req_status from public.travel_request_requirements where id = requirement and travel_request_id = m.target_id
        and (purpose <> 'travel_policy' or document_name = 'Issued Travel policy') for update;
      if not found then raise exception 'inbox_invalid_requirement' using errcode = '22023'; end if;
      travel_requirement := requirement;
    end if;
  end if;
  insert into public.documents(client_id, application_id, claim_id, renewal_id, travel_request_id, policy_id,
    application_requirement_id, claim_requirement_id, travel_requirement_id, document_type, name, file_path, uploaded_by, visibility, status)
  values(m.client_id, case when m.target_kind = 'application' then m.target_id end, case when m.target_kind = 'claim' then m.target_id end,
    case when m.target_kind = 'renewal' then m.target_id end, case when m.target_kind = 'travel' then m.target_id end,
    case when m.target_kind = 'policy' then m.target_id end, app_requirement, claim_requirement, travel_requirement,
    doc_type, filename, path, actor, 'Internal Only', 'Uploaded') returning id into doc;
  if purpose = 'proposal' then
    if m.target_kind = 'client' then
      update public.clients set proposal_status = 'Received', proposal_decision = null where id = m.client_id;
    else
      for old_doc in select id, status from public.documents where client_id = m.client_id and document_type = 'Illustrative Proposal' and status <> 'Replaced' and id <> doc for update loop
        update public.documents set status = 'Replaced' where id = old_doc.id;
        insert into public.audit_logs(actor_id, action, table_name, record_id, previous_value, new_value)
          values(actor, 'update', 'documents', old_doc.id, jsonb_build_object('status', old_doc.status), jsonb_build_object('status', 'Replaced', 'replacedBy', doc));
      end loop;
    end if;
  end if;
  if app_requirement is not null then update public.application_requirements set status = 'Received' where id = app_requirement and status <> 'Verified'; end if;
  if claim_requirement is not null then update public.claim_requirements set status = 'Received' where id = claim_requirement and status <> 'Verified'; end if;
  if travel_requirement is not null then update public.travel_request_requirements set status = 'Received' where id = travel_requirement and status <> 'Verified'; end if;
  insert into public.gmail_inbox_filings(message_id, part_id, document_id, purpose, requirement_id, storage_path, filed_by)
    values(m.id, part, doc, purpose, supplied_requirement, path, actor);
  update public.gmail_inbox_messages set filed_parts = jsonb_set(filed_parts, array[part], to_jsonb(doc::text), true) where id = m.id;
  insert into public.audit_logs(actor_id, action, table_name, record_id, new_value)
    values(actor, 'gmail.inbox.attachment_filed', 'documents', doc,
      jsonb_build_object('message_id', m.id, 'purpose', purpose, 'target_kind', m.target_kind, 'target_id', m.target_id,
        'requirement_id', requirement, 'requirement_status', case when requirement is null then null when req_status = 'Verified' then 'Verified' else 'Received' end));
  insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id, metadata)
    values('client', m.client_id, case when purpose = 'proposal' then case when m.target_kind = 'client' then 'lead.proposal' else 'application.proposal_received' end else 'document.uploaded' end,
      'Incoming Gmail attachment filed by staff', actor, jsonb_build_object('document_id', doc, 'message_id', m.id, 'purpose', purpose));
  return doc;
end;
$$;

-- Explicit signatures: neither table data nor invoker RPCs are browser grants.
revoke all on function public.gmail_inbox_actor_can_read(uuid, uuid), public.gmail_inbox_record_targets(), public.lock_gmail_inbox_target(text, uuid, uuid),
  public.enable_gmail_inbox(jsonb, uuid), public.update_gmail_inbox_watch(text, timestamptz),
  public.claim_gmail_inbox_sync(text), public.commit_gmail_inbox_sync(jsonb), public.release_gmail_inbox_sync(text, text),
  public.enqueue_gmail_inbox_notification(jsonb), public.list_gmail_inbox_messages(uuid, uuid, integer), public.list_gmail_inbox_targets(uuid),
  public.get_gmail_inbox_thread_target(text, text), public.link_gmail_inbox_message(uuid, text, uuid, uuid),
  public.file_gmail_inbox_attachment(jsonb) from public, anon, authenticated;
grant execute on function public.gmail_inbox_actor_can_read(uuid, uuid), public.gmail_inbox_record_targets(), public.lock_gmail_inbox_target(text, uuid, uuid),
  public.enable_gmail_inbox(jsonb, uuid), public.update_gmail_inbox_watch(text, timestamptz),
  public.claim_gmail_inbox_sync(text), public.commit_gmail_inbox_sync(jsonb), public.release_gmail_inbox_sync(text, text),
  public.enqueue_gmail_inbox_notification(jsonb), public.list_gmail_inbox_messages(uuid, uuid, integer), public.list_gmail_inbox_targets(uuid),
  public.get_gmail_inbox_thread_target(text, text), public.link_gmail_inbox_message(uuid, text, uuid, uuid),
  public.file_gmail_inbox_attachment(jsonb) to service_role;
