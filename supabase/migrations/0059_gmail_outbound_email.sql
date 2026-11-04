-- Staff-reviewed individual Gmail sending: immutable intents, at-most-one dispatch per intent,
-- accepted-only business effects. No browser access; credentials stay in gmail_connections.

create table public.gmail_outbound_messages (
  id uuid primary key,
  communication_id uuid not null unique references public.communications(id) on delete restrict,
  prepared_by uuid not null references public.users(id),
  actor_id uuid not null references public.users(id),
  google_subject text not null check (length(google_subject) between 1 and 255),
  oauth_client_id text not null check (length(oauth_client_id) between 1 and 255),
  sender_email text not null check (sender_email = 'admin@pacificinsuranceph.com'),
  client_id uuid not null references public.clients(id) on delete restrict,
  origin jsonb not null check (jsonb_typeof(origin) = 'object' and origin->>'type' in
    ('contact','application_missing','claim_missing','billing','submission','proposal_request','proposal_delivery','renewal_draft','reply')),
  source_key text not null check (length(source_key) between 1 and 1024),
  recipient_email text not null check (length(recipient_email) between 3 and 320 and recipient_email !~ '[[:cntrl:][:space:],;<>]'),
  subject text not null check (octet_length(subject) <= 16384 and subject !~ '[\r\n]'),
  body text not null check (octet_length(body) <= 131072),
  template_name text check (octet_length(template_name) <= 1024),
  external_contact_id uuid references public.external_contacts(id),
  reply_to_message_id uuid references public.gmail_inbox_messages(id) on delete restrict,
  target_kind text not null check (target_kind in ('client','application','claim','renewal','travel','policy')),
  target_id uuid not null,
  rfc_message_id text not null unique,
  in_reply_to text check (octet_length(in_reply_to) <= 4096),
  message_references text[] not null default '{}' check (cardinality(message_references) <= 100),
  requested_thread_id text check (length(requested_thread_id) between 1 and 256 and requested_thread_id ~ '^[a-zA-Z0-9_-]+$'),
  attachments jsonb not null default '[]' check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 40),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  generation integer not null default 0 check (generation >= 0),
  repeat_of uuid unique references public.gmail_outbound_messages(id),
  state text not null default 'prepared' check (state in ('prepared','sending','accepted','failed','unknown')),
  dispatch_token uuid,
  dispatch_started_at timestamptz,
  accepted_at timestamptz,
  gmail_message_id text check (length(gmail_message_id) between 1 and 256 and gmail_message_id ~ '^[a-zA-Z0-9_-]+$'),
  gmail_thread_id text check (length(gmail_thread_id) between 1 and 256 and gmail_thread_id ~ '^[a-zA-Z0-9_-]+$'),
  error_code text check (error_code in ('gmail_send_rejected','gmail_send_timeout','gmail_send_unknown','gmail_send_invalid_response',
    'gmail_send_source_changed','gmail_send_attachment_unavailable','gmail_send_auth_required','gmail_send_persistence_unavailable','gmail_send_thread_mismatch')),
  provider_http_status integer check (provider_http_status between 100 and 599),
  effects_applied_at timestamptz,
  acceptance_metadata jsonb not null default '{}' check (jsonb_typeof(acceptance_metadata) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (google_subject, payload_hash, generation),
  check (rfc_message_id = '<crm.' || id::text || '@pacificinsuranceph.com>'),
  check ((generation = 0) = (repeat_of is null)),
  check (state <> 'accepted' or (gmail_message_id is not null and gmail_thread_id is not null and accepted_at is not null)),
  check (state not in ('sending','unknown','accepted') or (dispatch_token is not null and dispatch_started_at is not null)),
  check (state <> 'prepared' or (dispatch_token is null and error_code is null)),
  check (effects_applied_at is null or state = 'accepted')
);
create unique index gmail_outbound_messages_provider_idx on public.gmail_outbound_messages(google_subject, gmail_message_id) where gmail_message_id is not null;
create index gmail_outbound_messages_client_idx on public.gmail_outbound_messages(client_id, created_at desc);
create index gmail_outbound_messages_reply_idx on public.gmail_outbound_messages(reply_to_message_id, created_at desc) where reply_to_message_id is not null;
create index gmail_outbound_messages_thread_idx on public.gmail_outbound_messages(google_subject, gmail_thread_id) where state = 'accepted';
-- Serializes unresolved sends and workflow finalization per source + recipient. No lease, no reclaim.
create unique index gmail_outbound_messages_source_lock_idx on public.gmail_outbound_messages(google_subject, source_key)
  where state in ('sending','unknown') or (state = 'accepted' and effects_applied_at is null);
create trigger trg_gmail_outbound_messages_updated before update on public.gmail_outbound_messages
  for each row execute function public.set_updated_at();

alter table public.gmail_outbound_messages enable row level security;
revoke all on table public.gmail_outbound_messages from public, anon, authenticated;
grant select, insert, update on table public.gmail_outbound_messages to service_role;

-- Renewal drafts: real sends are 'Sent'; historical 'Logged' rows stay log-only evidence.
alter table public.renewal_email_drafts
  add column outbound_message_id uuid unique references public.gmail_outbound_messages(id) on delete restrict;
alter table public.renewal_email_drafts drop constraint renewal_email_drafts_status_check;
alter table public.renewal_email_drafts add constraint renewal_email_drafts_status_check check (status in ('Draft','Logged','Sent','Dismissed'));
alter table public.renewal_email_drafts drop constraint renewal_email_drafts_check;
alter table public.renewal_email_drafts add constraint renewal_email_drafts_communication_check
  check ((status in ('Logged','Sent')) = (communication_id is not null));

create function public.gmail_outbound_actor_can_send(p_actor_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.users u where u.id = p_actor_id and u.status = 'Active' and u.role in ('Owner','Admin','Assistant'));
$$;

create function public.gmail_outbound_connection_ok(p_google_subject text, p_oauth_client_id text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.gmail_connections c where c.id = 'agency' and c.status = 'connected'
    and c.mailbox_email = 'admin@pacificinsuranceph.com'
    and c.google_subject = p_google_subject and c.oauth_client_id = p_oauth_client_id
    and c.granted_scopes @> array['https://www.googleapis.com/auth/gmail.send']::text[]);
$$;

create function public.gmail_outbound_source_key(p_origin jsonb, p_recipient text)
returns text language sql immutable security invoker set search_path = '' as $$
  select (p_origin->>'type') || ':' || case p_origin->>'type'
    when 'contact' then coalesce(p_origin#>>'{record,kind}' || ':' || (p_origin#>>'{record,id}'), 'client:' || (p_origin->>'clientId'))
    when 'submission' then (p_origin->>'kind') || ':' || (p_origin->>'id')
    when 'proposal_request' then p_origin->>'clientId'
    when 'proposal_delivery' then p_origin->>'clientId'
    when 'reply' then p_origin->>'messageId'
    else p_origin->>'id' end || ':' || lower(btrim(p_recipient));
$$;

create function public.gmail_outbound_renewal_due(p_draft public.renewal_email_drafts)
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce(public.renewal_email_due_date(p_draft.rule_id, p_draft.renewal_id) <= (pg_catalog.now() at time zone 'Asia/Manila')::date, false);
$$;

-- Source eligibility shared by prepare and claim. Returns null when eligible, else a safe code.
-- Callers own any locks; this function only reads.
create function public.gmail_outbound_source_problem(
  p_origin jsonb, p_client_id uuid, p_target_kind text, p_target_id uuid, p_recipient text,
  p_external_contact_id uuid, p_attachments jsonb, p_actor_id uuid, p_outbound_id uuid, p_phase text)
returns text language plpgsql stable security invoker set search_path = '' as $$
declare
  kind text := p_origin->>'type';
  source uuid;
  app public.applications%rowtype;
  cl public.claims%rowtype;
  client_row public.clients%rowtype;
  contact public.external_contacts%rowtype;
  draft public.renewal_email_drafts%rowtype;
  bound_state text;
  msg public.gmail_inbox_messages%rowtype;
begin
  select * into client_row from public.clients where id = p_client_id;
  if client_row.id is null then return 'outbound_record_unavailable'; end if;
  if p_target_kind is null or p_target_id is null then return 'outbound_record_unavailable'; end if;
  if not exists (select 1 from public.gmail_inbox_record_targets() r where r.kind = p_target_kind and r.id = p_target_id and r.client_id = p_client_id) then
    return 'outbound_record_unavailable';
  end if;
  case kind
  when 'contact' then
    if (p_origin->>'clientId')::uuid is distinct from p_client_id then return 'outbound_record_unavailable'; end if;
  when 'application_missing', 'billing' then
    source := (p_origin->>'id')::uuid;
    select * into app from public.applications where id = source;
    if app.id is null or app.client_id <> p_client_id or app.status = 'Lead' or p_target_kind <> 'application' or p_target_id <> source then
      return 'outbound_record_unavailable';
    end if;
    if kind = 'application_missing' and not exists (select 1 from public.application_requirements r
      where r.application_id = source and r.is_required and r.status in ('Pending','Incomplete')) then
      return 'outbound_no_outstanding';
    end if;
    if kind = 'billing' and not exists (select 1 from public.payments p where p.application_id = source) then
      return 'outbound_billing_unavailable';
    end if;
  when 'claim_missing' then
    source := (p_origin->>'id')::uuid;
    select * into cl from public.claims where id = source;
    if cl.id is null or cl.client_id <> p_client_id or p_target_kind <> 'claim' or p_target_id <> source then return 'outbound_record_unavailable'; end if;
    if not exists (select 1 from public.claim_requirements r where r.claim_id = source and r.is_required and r.status in ('Pending','Incomplete')) then
      return 'outbound_no_outstanding';
    end if;
  when 'submission' then
    source := (p_origin->>'id')::uuid;
    if p_origin->>'kind' = 'application' then
      select * into app from public.applications where id = source;
      if app.id is null or app.client_id <> p_client_id or app.status = 'Lead' or p_target_kind <> 'application' or p_target_id <> source then
        return 'outbound_record_unavailable';
      end if;
      if exists (select 1 from public.application_requirements r where r.application_id = source and r.is_required and r.status in ('Pending','Incomplete')) then
        return 'outbound_submission_outstanding';
      end if;
    elsif p_origin->>'kind' = 'claim' then
      select * into cl from public.claims where id = source;
      if cl.id is null or cl.client_id <> p_client_id or p_target_kind <> 'claim' or p_target_id <> source then return 'outbound_record_unavailable'; end if;
      if exists (select 1 from public.claim_requirements r where r.claim_id = source and r.is_required and r.status in ('Pending','Incomplete')) then
        return 'outbound_submission_outstanding';
      end if;
    else return 'outbound_record_unavailable'; end if;
    select * into contact from public.external_contacts where id = (p_origin->>'contactId')::uuid;
    if contact.id is null or contact.id is distinct from p_external_contact_id or contact.status <> 'Active'
      or lower(btrim(coalesce(contact.email, ''))) <> lower(btrim(p_recipient))
      or not (case when p_origin->>'kind' = 'application' then contact.department = 'New Business'
        else contact.department in ('Claims','Claims and Customer Service') end) then
      return 'outbound_contact_invalid';
    end if;
  when 'proposal_request' then
    if (p_origin->>'clientId')::uuid is distinct from p_client_id then return 'outbound_record_unavailable'; end if;
    select * into contact from public.external_contacts where id = p_external_contact_id;
    if contact.id is null or contact.status <> 'Active' or contact.department <> 'New Business'
      or lower(btrim(coalesce(contact.email, ''))) <> lower(btrim(p_recipient)) then
      return 'outbound_contact_invalid';
    end if;
  when 'proposal_delivery' then
    if (p_origin->>'clientId')::uuid is distinct from p_client_id then return 'outbound_record_unavailable'; end if;
    if client_row.lifecycle_stage <> 'Lead' or client_row.proposal_status is distinct from 'Received' then return 'outbound_proposal_not_received'; end if;
    if not exists (select 1 from jsonb_array_elements(p_attachments) a join public.documents d on d.id = (a#>>'{source,id}')::uuid
      where a#>>'{source,type}' = 'document' and d.client_id = p_client_id and d.document_type = 'Illustrative Proposal'
        and d.status <> 'Replaced' and d.file_path is not null) then
      return 'outbound_proposal_document_required';
    end if;
  when 'renewal_draft' then
    select * into draft from public.renewal_email_drafts where id = (p_origin->>'id')::uuid;
    if draft.id is null or p_target_kind <> 'renewal' or p_target_id <> draft.renewal_id
      or not exists (select 1 from public.renewals r where r.id = draft.renewal_id and r.client_id = p_client_id) then
      return 'outbound_record_unavailable';
    end if;
    if draft.status <> 'Draft' then return 'outbound_renewal_changed'; end if;
    if p_phase = 'prepare' and draft.updated_at is distinct from (p_origin->>'updatedAt')::timestamptz then return 'outbound_renewal_changed'; end if;
    if p_phase = 'claim' then
      if draft.outbound_message_id is not null and draft.outbound_message_id is distinct from p_outbound_id then
        select o.state into bound_state from public.gmail_outbound_messages o where o.id = draft.outbound_message_id;
        if bound_state is distinct from 'failed' then return 'outbound_renewal_changed'; end if;
      end if;
      if draft.updated_at is distinct from (p_origin->>'updatedAt')::timestamptz then return 'outbound_renewal_changed'; end if;
    end if;
    if not public.gmail_outbound_renewal_due(draft) then return 'outbound_renewal_not_due'; end if;
  when 'reply' then
    select * into msg from public.gmail_inbox_messages where id = (p_origin->>'messageId')::uuid;
    if msg.id is null or msg.target_id is null or msg.client_id is distinct from p_client_id
      or msg.target_kind is distinct from p_target_kind or msg.target_id is distinct from p_target_id
      or not public.gmail_inbox_actor_can_read(p_actor_id, msg.client_id) then
      return 'outbound_reply_unavailable';
    end if;
  else return 'outbound_record_unavailable';
  end case;
  return null;
end;
$$;

create function public.prepare_gmail_outbound_email(p_actor_id uuid, p_input jsonb)
returns public.gmail_outbound_messages language plpgsql security invoker set search_path = '' as $$
declare
  existing public.gmail_outbound_messages%rowtype;
  parent public.gmail_outbound_messages%rowtype;
  result public.gmail_outbound_messages%rowtype;
  intent uuid := (p_input->>'id')::uuid;
  origin jsonb := p_input->'origin';
  client uuid := (p_input->>'clientId')::uuid;
  target_kind text := p_input->>'targetKind';
  target uuid := (p_input->>'targetId')::uuid;
  recipient text := lower(btrim(p_input->>'recipient'));
  hash text := p_input->>'payloadHash';
  subject_value text := p_input->>'googleSubject';
  next_generation integer := 0;
  repeat_parent uuid := (p_input->>'repeatOfId')::uuid;
  problem text;
  communication uuid;
  asset jsonb;
begin
  if not public.gmail_outbound_actor_can_send(p_actor_id) then raise exception 'outbound_forbidden' using errcode = '42501'; end if;
  if intent is null or origin is null or client is null or hash is null or recipient is null then
    raise exception 'outbound_invalid' using errcode = '22023';
  end if;
  if not public.gmail_outbound_connection_ok(subject_value, p_input->>'oauthClientId') then
    raise exception 'outbound_connection' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gmail_outbound:intent:' || intent::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gmail_outbound:hash:' || subject_value || ':' || hash, 0));
  select * into existing from public.gmail_outbound_messages where id = intent;
  if existing.id is not null then
    if existing.prepared_by = p_actor_id and existing.payload_hash = hash and existing.google_subject = subject_value
      and existing.repeat_of is not distinct from repeat_parent then
      return existing;
    end if;
    raise exception 'outbound_intent_conflict' using errcode = '22023';
  end if;
  if repeat_parent is null then
    -- Identical content prepared elsewhere: return the canonical latest generation, never a second send.
    select * into existing from public.gmail_outbound_messages
      where google_subject = subject_value and payload_hash = hash order by generation desc limit 1;
    if existing.id is not null then return existing; end if;
  else
    select * into parent from public.gmail_outbound_messages where id = repeat_parent for update;
    if parent.id is null or parent.payload_hash <> hash or parent.google_subject <> subject_value
      or parent.client_id <> client then
      raise exception 'outbound_repeat_invalid' using errcode = '22023';
    end if;
    select * into existing from public.gmail_outbound_messages where repeat_of = parent.id;
    if existing.id is not null then return existing; end if;
    if exists (select 1 from public.gmail_outbound_messages o where o.google_subject = subject_value
      and o.payload_hash = hash and o.generation > parent.generation) then
      raise exception 'outbound_repeat_invalid' using errcode = '22023';
    end if;
    if not (parent.state = 'failed' or (parent.state = 'accepted' and parent.effects_applied_at is not null
      and parent.origin->>'type' in ('contact','billing','submission','reply'))) then
      raise exception 'outbound_repeat_invalid' using errcode = '22023';
    end if;
    next_generation := parent.generation + 1;
  end if;
  if target_kind = 'client' and target is distinct from client then raise exception 'outbound_record_unavailable' using errcode = '22023'; end if;
  problem := public.gmail_outbound_source_problem(origin, client, target_kind, target, recipient,
    (p_input->>'externalContactId')::uuid, coalesce(p_input->'attachments', '[]'::jsonb), p_actor_id, intent, 'prepare');
  if problem is not null then raise exception '%', problem using errcode = '22023'; end if;

  insert into public.communications(client_id, application_id, claim_id, renewal_id, travel_request_id, policy_id,
    direction, channel, subject, summary, notes, related_user_id, external_contact_id, delivery_status)
  values (client,
    case when target_kind = 'application' then target end,
    case when target_kind = 'claim' then target end,
    case when target_kind = 'renewal' then target end,
    case when target_kind = 'travel' then target end,
    case when target_kind = 'policy' then target when target_kind = 'renewal' then (select r.policy_id from public.renewals r where r.id = target) end,
    'Outbound', 'Gmail', p_input->>'subject', p_input->>'summary', p_input->>'body', p_actor_id,
    (p_input->>'externalContactId')::uuid, 'prepared')
  returning id into communication;

  insert into public.gmail_outbound_messages(id, communication_id, prepared_by, actor_id, google_subject, oauth_client_id, sender_email,
    client_id, origin, source_key, recipient_email, subject, body, template_name, external_contact_id, reply_to_message_id,
    target_kind, target_id, rfc_message_id, in_reply_to, message_references, requested_thread_id, attachments, payload_hash,
    generation, repeat_of)
  values (intent, communication, p_actor_id, p_actor_id, subject_value, p_input->>'oauthClientId', 'admin@pacificinsuranceph.com',
    client, origin, public.gmail_outbound_source_key(origin, recipient), recipient, p_input->>'subject', p_input->>'body',
    nullif(p_input->>'templateName', ''), (p_input->>'externalContactId')::uuid,
    case when origin->>'type' = 'reply' then (origin->>'messageId')::uuid end,
    target_kind, target, '<crm.' || intent::text || '@pacificinsuranceph.com>', p_input->>'inReplyTo',
    coalesce(array(select jsonb_array_elements_text(p_input->'references')), '{}'), p_input->>'requestedThreadId',
    coalesce(p_input->'attachments', '[]'::jsonb), hash, next_generation, repeat_parent)
  returning * into result;

  for asset in select value from jsonb_array_elements(result.attachments) loop
    if asset#>>'{source,type}' = 'library' then
      insert into public.communication_library_documents(communication_id, document_library_id, document_name_snapshot, version_label_snapshot, file_path_snapshot)
      values (communication, (asset#>>'{source,id}')::uuid, coalesce(asset->>'libraryDocumentName', asset->>'fileName'),
        coalesce(asset->>'libraryVersionLabel', ''), asset->>'storagePath')
      on conflict do nothing;
    end if;
  end loop;
  return result;
end;
$$;

create function public.gmail_outbound_lock_source(p_origin jsonb)
returns void language plpgsql volatile security invoker set search_path = '' as $$
declare draft_id uuid;
begin
  -- Lock order: renewal -> draft -> outbound. Finish never takes source locks.
  if p_origin->>'type' = 'renewal_draft' then
    draft_id := (p_origin->>'id')::uuid;
    perform 1 from public.renewals r join public.renewal_email_drafts d on d.renewal_id = r.id where d.id = draft_id for update of r;
    perform 1 from public.renewal_email_drafts d where d.id = draft_id for update;
  end if;
end;
$$;

create function public.claim_gmail_outbound_email(p_actor_id uuid, p_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  m public.gmail_outbound_messages%rowtype;
  blocking public.gmail_outbound_messages%rowtype;
  token uuid := gen_random_uuid();
  problem text;
begin
  if not public.gmail_outbound_actor_can_send(p_actor_id) then raise exception 'outbound_forbidden' using errcode = '42501'; end if;
  select * into m from public.gmail_outbound_messages where id = p_id;
  if m.id is null or not public.gmail_inbox_actor_can_read(p_actor_id, m.client_id) then
    raise exception 'outbound_not_found' using errcode = '42501';
  end if;
  perform public.gmail_outbound_lock_source(m.origin);
  select * into m from public.gmail_outbound_messages where id = p_id for update;
  if m.state <> 'prepared' then return jsonb_build_object('claimed', false, 'message', to_jsonb(m)); end if;
  if not public.gmail_outbound_connection_ok(m.google_subject, m.oauth_client_id) then
    update public.gmail_outbound_messages set state = 'failed', error_code = 'gmail_send_auth_required' where id = m.id returning * into m;
    update public.communications set delivery_status = 'failed' where id = m.communication_id;
    return jsonb_build_object('claimed', false, 'message', to_jsonb(m));
  end if;
  problem := public.gmail_outbound_source_problem(m.origin, m.client_id, m.target_kind, m.target_id, m.recipient_email,
    m.external_contact_id, m.attachments, p_actor_id, m.id, 'claim');
  if problem is not null then
    update public.gmail_outbound_messages set state = 'failed', error_code = 'gmail_send_source_changed' where id = m.id returning * into m;
    update public.communications set delivery_status = 'failed' where id = m.communication_id;
    insert into public.audit_logs(actor_id, action, table_name, record_id, new_value) values (p_actor_id, 'gmail.outbound.failed',
      'gmail_outbound_messages', m.id, jsonb_build_object('communication_id', m.communication_id, 'state', 'failed', 'error_code', m.error_code, 'reason', problem));
    return jsonb_build_object('claimed', false, 'message', to_jsonb(m), 'problem', problem);
  end if;
  begin
    update public.gmail_outbound_messages set state = 'sending', dispatch_token = token, dispatch_started_at = clock_timestamp(), actor_id = p_actor_id
      where id = m.id returning * into m;
  exception when unique_violation then
    select * into blocking from public.gmail_outbound_messages o where o.google_subject = m.google_subject and o.source_key = m.source_key
      and (o.state in ('sending','unknown') or (o.state = 'accepted' and o.effects_applied_at is null)) limit 1;
    return jsonb_build_object('claimed', false, 'message', to_jsonb(m), 'blockedBy', to_jsonb(blocking));
  end;
  update public.communications set delivery_status = 'sending', related_user_id = p_actor_id where id = m.communication_id;
  if m.origin->>'type' = 'renewal_draft' then
    update public.renewal_email_drafts set outbound_message_id = m.id where id = (m.origin->>'id')::uuid;
  end if;
  insert into public.audit_logs(actor_id, action, table_name, record_id, new_value) values (p_actor_id, 'gmail.outbound.sending',
    'gmail_outbound_messages', m.id, jsonb_build_object('communication_id', m.communication_id, 'client_id', m.client_id, 'state', 'sending'));
  return jsonb_build_object('claimed', true, 'dispatchToken', token, 'message', to_jsonb(m));
end;
$$;

create function public.fail_prepared_gmail_outbound_email(p_actor_id uuid, p_id uuid, p_error_code text)
returns public.gmail_outbound_messages language plpgsql security invoker set search_path = '' as $$
declare m public.gmail_outbound_messages%rowtype;
begin
  if not public.gmail_outbound_actor_can_send(p_actor_id) then raise exception 'outbound_forbidden' using errcode = '42501'; end if;
  if p_error_code not in ('gmail_send_source_changed','gmail_send_attachment_unavailable','gmail_send_auth_required','gmail_send_rejected') then
    raise exception 'outbound_invalid' using errcode = '22023';
  end if;
  select * into m from public.gmail_outbound_messages where id = p_id for update;
  if m.id is null or not public.gmail_inbox_actor_can_read(p_actor_id, m.client_id) then raise exception 'outbound_not_found' using errcode = '42501'; end if;
  if m.state <> 'prepared' then return m; end if;
  update public.gmail_outbound_messages set state = 'failed', error_code = p_error_code where id = m.id returning * into m;
  update public.communications set delivery_status = 'failed' where id = m.communication_id;
  insert into public.audit_logs(actor_id, action, table_name, record_id, new_value) values (p_actor_id, 'gmail.outbound.failed',
    'gmail_outbound_messages', m.id, jsonb_build_object('communication_id', m.communication_id, 'state', 'failed', 'error_code', p_error_code));
  return m;
end;
$$;

-- Service-role only; works even when the dispatching user became inactive after dispatch.
create function public.finish_gmail_outbound_email(p_id uuid, p_dispatch_token uuid, p_result jsonb)
returns public.gmail_outbound_messages language plpgsql security invoker set search_path = '' as $$
declare
  m public.gmail_outbound_messages%rowtype;
  next_state text := p_result->>'state';
  accepted timestamptz;
  occurred timestamptz;
  code text := p_result->>'errorCode';
begin
  select * into m from public.gmail_outbound_messages where id = p_id for update;
  if m.id is null or m.dispatch_token is distinct from p_dispatch_token or p_dispatch_token is null then
    raise exception 'outbound_token_mismatch' using errcode = '42501';
  end if;
  if next_state not in ('accepted','failed','unknown') then raise exception 'outbound_invalid' using errcode = '22023'; end if;
  if m.state = 'accepted' then
    if next_state = 'accepted' and m.gmail_message_id = p_result->>'gmailMessageId' then return m; end if;
    if next_state <> 'accepted' then return m; end if;
    raise exception 'outbound_result_conflict' using errcode = '22023';
  end if;
  if m.state = 'failed' then
    if next_state = 'failed' then return m; end if;
    raise exception 'outbound_result_conflict' using errcode = '22023';
  end if;
  if m.state not in ('sending','unknown') then raise exception 'outbound_result_conflict' using errcode = '22023'; end if;
  if m.state = 'unknown' and next_state = 'failed' then
    -- An uncertain dispatch can never be relabeled as not sent.
    raise exception 'outbound_result_conflict' using errcode = '22023';
  end if;
  if next_state = 'accepted' then
    accepted := coalesce((p_result->>'acceptedAt')::timestamptz, clock_timestamp());
    occurred := coalesce((p_result->>'occurredAt')::timestamptz, accepted);
    update public.gmail_outbound_messages set state = 'accepted', accepted_at = accepted,
      gmail_message_id = p_result->>'gmailMessageId', gmail_thread_id = p_result->>'gmailThreadId',
      error_code = case when code = 'gmail_send_thread_mismatch' then code end,
      provider_http_status = (p_result->>'providerHttpStatus')::integer
    where id = m.id returning * into m;
    update public.communications set delivery_status = 'sent', email_thread_id = m.gmail_thread_id, occurred_at = occurred
      where id = m.communication_id;
  else
    update public.gmail_outbound_messages set state = next_state, error_code = code,
      provider_http_status = (p_result->>'providerHttpStatus')::integer
    where id = m.id returning * into m;
    update public.communications set delivery_status = next_state where id = m.communication_id;
  end if;
  insert into public.audit_logs(actor_id, action, table_name, record_id, new_value) values (m.actor_id, 'gmail.outbound.' || m.state,
    'gmail_outbound_messages', m.id, jsonb_build_object('communication_id', m.communication_id, 'client_id', m.client_id, 'state', m.state,
      'error_code', m.error_code, 'provider_http_status', m.provider_http_status, 'gmail_message_id', m.gmail_message_id,
      'gmail_thread_id', m.gmail_thread_id, 'accepted_at', m.accepted_at));
  return m;
end;
$$;

-- Second transaction after acceptance commits. Idempotent; never sends mail.
create function public.apply_gmail_outbound_email_effects(p_id uuid)
returns public.gmail_outbound_messages language plpgsql security invoker set search_path = '' as $$
declare
  m public.gmail_outbound_messages%rowtype;
  kind text;
  source uuid;
  meta jsonb := '{}'::jsonb;
  client_before public.clients%rowtype;
  client_after public.clients%rowtype;
  app public.applications%rowtype;
  cl public.claims%rowtype;
  draft public.renewal_email_drafts%rowtype;
  pay record;
  amount text;
  n integer;
  ids jsonb;
  occurred timestamptz;
  manila date;
  detail text;
  contact_email text;
begin
  select * into m from public.gmail_outbound_messages where id = p_id;
  if m.id is null then raise exception 'outbound_not_found' using errcode = '42501'; end if;
  if m.state <> 'accepted' or m.effects_applied_at is not null then return m; end if;
  kind := m.origin->>'type';
  perform public.gmail_outbound_lock_source(m.origin);
  if kind in ('contact','proposal_delivery') then perform 1 from public.clients where id = m.client_id for update; end if;
  if kind in ('submission') and m.origin->>'kind' = 'application' then perform 1 from public.applications where id = (m.origin->>'id')::uuid for update; end if;
  if kind in ('submission') and m.origin->>'kind' = 'claim' then perform 1 from public.claims where id = (m.origin->>'id')::uuid for update; end if;
  select * into m from public.gmail_outbound_messages where id = p_id for update;
  if m.state <> 'accepted' or m.effects_applied_at is not null then return m; end if;
  select c.occurred_at into occurred from public.communications c where c.id = m.communication_id;
  occurred := coalesce(occurred, m.accepted_at);
  manila := (occurred at time zone 'Asia/Manila')::date;

  if kind = 'contact' then
    select * into client_before from public.clients where id = m.client_id;
    if client_before.lifecycle_stage = 'Lead' and client_before.lead_status = 'New' then
      update public.clients set lead_status = 'Attempted' where id = m.client_id returning * into client_after;
      insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id)
        values ('client', m.client_id, 'lead.status_changed', 'Email sent: New → Attempted', m.actor_id);
      insert into public.audit_logs(actor_id, action, table_name, record_id, previous_value, new_value)
        values (m.actor_id, 'lead_status_updated', 'clients', m.client_id, to_jsonb(client_before), to_jsonb(client_after));
      select string_agg(x, ': ') into detail from (
        select m.template_name as x where m.template_name is not null
        union all
        select a->>'libraryDocumentName' from jsonb_array_elements(m.attachments) a where (a->>'required')::boolean is true) parts;
      meta := jsonb_build_object('advance', jsonb_build_object('clientId', m.client_id,
        'name', concat_ws(' ', client_after.first_name, client_after.last_name), 'referenceNo', client_after.reference_no,
        'currentStage', client_after.lead_stage, 'currentStatus', client_after.lead_status, 'previousStatus', client_before.lead_status,
        'status', 'Attempted', 'label', 'Email sent', 'detail', detail, 'occurredAt', occurred));
    else
      meta := jsonb_build_object('skipped', 'not_first_touch');
    end if;
  elsif kind = 'application_missing' then
    source := (m.origin->>'id')::uuid;
    select * into app from public.applications where id = source;
    select coalesce(jsonb_agg(r.id order by r.sort_order, r.id), '[]'::jsonb), count(*) into ids, n from public.application_requirements r
      where r.application_id = source and r.is_required and r.status in ('Pending','Incomplete');
    insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id, metadata)
      values ('client', m.client_id, 'application.documents_requested',
        'Requested ' || n || ' missing document' || case when n = 1 then '' else 's' end || ' for ' || coalesce(app.reference_no, 'application'),
        m.actor_id, jsonb_build_object('communication_id', m.communication_id, 'outbound_message_id', m.id));
    insert into public.audit_logs(actor_id, action, table_name, record_id, new_value)
      values (m.actor_id, 'request_missing_documents', 'communications', m.communication_id, jsonb_build_object('application_id', source, 'requirement_ids', ids));
  elsif kind = 'claim_missing' then
    source := (m.origin->>'id')::uuid;
    select * into cl from public.claims where id = source;
    select coalesce(jsonb_agg(r.id order by r.sort_order, r.id), '[]'::jsonb), count(*) into ids, n from public.claim_requirements r
      where r.claim_id = source and r.is_required and r.status in ('Pending','Incomplete');
    insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id, metadata)
      values ('client', m.client_id, 'claim.documents_requested',
        'Requested ' || n || ' missing document' || case when n = 1 then '' else 's' end || ' for ' || coalesce(cl.reference_no, 'claim'),
        m.actor_id, jsonb_build_object('communication_id', m.communication_id, 'outbound_message_id', m.id));
    insert into public.audit_logs(actor_id, action, table_name, record_id, new_value)
      values (m.actor_id, 'request_missing_documents', 'communications', m.communication_id, jsonb_build_object('claim_id', source, 'requirement_ids', ids));
  elsif kind = 'billing' then
    source := (m.origin->>'id')::uuid;
    select * into app from public.applications where id = source;
    select p.id, p.amount into pay from public.payments p where p.application_id = source order by p.created_at desc, p.id desc limit 1;
    amount := case when pay.amount is null then 'the billed premium'
      else '₱' || regexp_replace(to_char(pay.amount, 'FM999,999,999,990.00'), '\.00$', '') end;
    insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id, metadata)
      values ('client', m.client_id, 'payment.instruction_sent',
        'Billing (' || amount || ') and payment channels sent for ' || coalesce(app.reference_no, 'application'),
        m.actor_id, jsonb_build_object('communication_id', m.communication_id, 'outbound_message_id', m.id));
    insert into public.audit_logs(actor_id, action, table_name, record_id, new_value)
      values (m.actor_id, 'billing_sent', 'communications', m.communication_id, jsonb_build_object('application_id', source, 'payment_id', pay.id));
  elsif kind = 'submission' then
    source := (m.origin->>'id')::uuid;
    select e.email into contact_email from public.external_contacts e where e.id = m.external_contact_id;
    contact_email := coalesce(m.recipient_email, contact_email);
    if m.origin->>'kind' = 'application' then
      select * into app from public.applications where id = source;
      if app.status not in ('Submitted to Pacific Cross','Awaiting Payment','Approved','Rejected','Declined','Cancelled','Withdrawn') then
        update public.applications set status = 'Submitted to Pacific Cross', date_submitted = coalesce(date_submitted, manila) where id = source;
      else
        update public.applications set date_submitted = coalesce(date_submitted, manila) where id = source and date_submitted is null;
        meta := jsonb_build_object('skipped', 'status_already_advanced');
      end if;
      insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id, metadata)
        values ('client', m.client_id, 'application.submitted',
          coalesce(app.reference_no, 'application') || ' submitted to Pacific Cross (' || contact_email || ') — sent from admin@pacificinsuranceph.com',
          m.actor_id, jsonb_build_object('communication_id', m.communication_id, 'outbound_message_id', m.id));
      insert into public.audit_logs(actor_id, action, table_name, record_id, previous_value, new_value)
        values (m.actor_id, 'submit_to_pacific_cross', 'applications', source,
          jsonb_build_object('status', app.status, 'date_submitted', app.date_submitted),
          (select jsonb_build_object('status', a.status, 'date_submitted', a.date_submitted, 'communication_id', m.communication_id,
            'external_contact_id', m.external_contact_id) from public.applications a where a.id = source));
    else
      select * into cl from public.claims where id = source;
      if cl.status in ('Draft','Documents Pending') then
        update public.claims set status = 'Submitted', claim_submitted_date = coalesce(claim_submitted_date, manila) where id = source;
      else
        update public.claims set claim_submitted_date = coalesce(claim_submitted_date, manila) where id = source and claim_submitted_date is null;
        meta := jsonb_build_object('skipped', 'status_already_advanced');
      end if;
      insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id, metadata)
        values ('client', m.client_id, 'claim.submitted',
          coalesce(cl.reference_no, 'claim') || ' submitted to Pacific Cross (' || contact_email || ') — sent from admin@pacificinsuranceph.com',
          m.actor_id, jsonb_build_object('communication_id', m.communication_id, 'outbound_message_id', m.id));
      insert into public.audit_logs(actor_id, action, table_name, record_id, previous_value, new_value)
        values (m.actor_id, 'submit_to_pacific_cross', 'claims', source,
          jsonb_build_object('status', cl.status, 'claim_submitted_date', cl.claim_submitted_date),
          (select jsonb_build_object('status', c.status, 'claim_submitted_date', c.claim_submitted_date, 'communication_id', m.communication_id,
            'external_contact_id', m.external_contact_id) from public.claims c where c.id = source));
    end if;
  elsif kind = 'proposal_delivery' then
    select * into client_before from public.clients where id = m.client_id;
    if client_before.lifecycle_stage = 'Lead' and client_before.proposal_status = 'Received' then
      update public.clients set proposal_status = 'Sent', proposal_decision = null where id = m.client_id;
      insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id, metadata)
        values ('client', m.client_id, 'lead.proposal', 'Proposal sent — ' || coalesce(client_before.product_interest, 'carrier') || ' proposal (Gmail accepted)',
          m.actor_id, jsonb_build_object('communication_id', m.communication_id, 'outbound_message_id', m.id));
      insert into public.audit_logs(actor_id, action, table_name, record_id, previous_value, new_value)
        values (m.actor_id, 'proposal_sent', 'clients', m.client_id, jsonb_build_object('proposal_status', client_before.proposal_status),
          jsonb_build_object('proposal_status', 'Sent', 'communication_id', m.communication_id));
    else
      meta := jsonb_build_object('skipped', 'proposal_status_changed');
    end if;
  elsif kind = 'renewal_draft' then
    select * into draft from public.renewal_email_drafts where id = (m.origin->>'id')::uuid;
    if draft.status = 'Draft' and draft.outbound_message_id = m.id then
      update public.renewal_email_drafts set status = 'Sent', communication_id = m.communication_id,
        recipient_email = m.recipient_email, edited_subject = m.subject, edited_body = m.body where id = draft.id;
      update public.tasks set status = 'Completed', completed_date = manila where id = draft.task_id and status in ('Open','In Progress');
      insert into public.audit_logs(actor_id, action, table_name, record_id, previous_value, new_value)
        values (m.actor_id, 'send', 'renewal_email_drafts', draft.id, jsonb_build_object('status', draft.status),
          jsonb_build_object('status', 'Sent', 'communication_id', m.communication_id, 'outbound_message_id', m.id));
    else
      meta := jsonb_build_object('skipped', 'draft_changed');
    end if;
  end if;
  -- proposal_request and reply have no business mutation: complete explicitly to release the source lock.
  update public.gmail_outbound_messages set effects_applied_at = clock_timestamp(), acceptance_metadata = acceptance_metadata || meta
    where id = m.id returning * into m;
  return m;
end;
$$;

create function public.get_gmail_outbound_email(p_actor_id uuid, p_id uuid)
returns setof public.gmail_outbound_messages language sql stable security invoker set search_path = '' as $$
  select o.* from public.gmail_outbound_messages o
  where o.id = p_id and public.gmail_outbound_actor_can_send(p_actor_id) and public.gmail_inbox_actor_can_read(p_actor_id, o.client_id);
$$;

create function public.list_gmail_outbound_email(p_actor_id uuid, p_client_id uuid, p_reply_to_message_id uuid default null)
returns setof public.gmail_outbound_messages language sql stable security invoker set search_path = '' as $$
  select o.* from public.gmail_outbound_messages o
  where o.client_id = p_client_id and (p_reply_to_message_id is null or o.reply_to_message_id = p_reply_to_message_id)
    and public.gmail_outbound_actor_can_send(p_actor_id) and public.gmail_inbox_actor_can_read(p_actor_id, o.client_id)
  order by o.created_at desc, o.id desc limit 50;
$$;

-- Inbound thread suggestion: linked inbound targets plus accepted outbound snapshots. Exactly one or none.
create or replace function public.get_gmail_inbox_thread_target(p_google_subject text, p_gmail_thread_id text)
returns table(kind text, id uuid, client_id uuid, label text, participants text[])
language sql stable security invoker set search_path = '' as $$
  with established as (
    select m.target_kind, m.target_id from public.gmail_inbox_messages m
    where m.google_subject = p_google_subject and m.gmail_thread_id = p_gmail_thread_id and m.target_kind is not null
    union
    select o.target_kind, o.target_id from public.gmail_outbound_messages o
    where o.google_subject = p_google_subject and o.gmail_thread_id = p_gmail_thread_id and o.state = 'accepted'
  ) select r.* from public.gmail_inbox_record_targets() r join established e on e.target_kind = r.kind and e.target_id = r.id
    where (select count(*) from established) = 1;
$$;

-- Renewal queue: never refresh or cancel a draft whose bound send is unresolved.
create function public.renewal_draft_send_in_flight(p_outbound_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select p_outbound_id is not null and exists (select 1 from public.gmail_outbound_messages o where o.id = p_outbound_id
    and (o.state in ('sending','unknown') or (o.state = 'accepted' and o.effects_applied_at is null)));
$$;

create or replace function public.queue_due_renewal_emails(p_renewal_id uuid default null)
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
  -- Lock in stable order: renewal -> draft (-> outbound). Receipt writes hold the same renewal lock.
  for cycle_id in select r.id from public.renewals r
    where p_renewal_id is null or r.id = p_renewal_id order by r.id loop
    select * into cycle from public.renewals r where r.id = cycle_id for update;
    if cycle.id is null then continue; end if;
    for rule in select er.* from public.renewal_email_rules er order by er.id loop
      due := public.renewal_email_due_date(rule.id,cycle.id);
      select * into draft from public.renewal_email_drafts d
        where d.renewal_id = cycle.id and d.rule_id = rule.id for update;
      if draft.id is not null and (draft.status <> 'Draft' or public.renewal_draft_send_in_flight(draft.outbound_message_id)) then
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
          'Draft for staff review. Open the linked draft to review and send it from admin@pacificinsuranceph.com, or dismiss it.') returning id into new_task_id;
      insert into public.renewal_email_drafts (rule_id,renewal_id,task_id,due_date,recipient_email,external_contact_id,subject,body,merge_context)
        select rule.id,cycle.id,new_task_id,due,nullif(btrim(recipient_address),''),rule.external_contact_id,
          coalesce(et.subject,''),coalesce(et.body,''),context from public.email_templates et where et.id = rule.template_id
        returning * into draft;
      return query select draft.id,new_task_id,cycle.id,rule.rule_key,'queued'::text;
    end loop;
  end loop;
end;
$$;

-- Save and dismiss only; sending goes through the Gmail outbound ledger.
drop function public.update_renewal_email_draft(uuid,uuid,text,timestamptz,text,text,text);
create function public.update_renewal_email_draft(
  p_draft_id uuid,p_actor_id uuid,p_operation text,p_expected_updated_at timestamptz,
  p_recipient_email text default null,p_subject text default null,p_body text default null)
returns public.renewal_email_drafts language plpgsql security invoker set search_path = public as $$
declare
  draft public.renewal_email_drafts;
  cycle public.renewals;
begin
  if not exists (select 1 from public.users u where u.id = p_actor_id and u.status = 'Active' and u.role in ('Owner','Admin','Assistant')) then
    raise exception 'Renewal drafts are available to Admin and Staff only.';
  end if;
  select r.* into cycle from public.renewals r join public.renewal_email_drafts d on d.renewal_id = r.id
    where d.id = p_draft_id for update of r;
  if cycle.id is null then raise exception 'Renewal draft not found.'; end if;
  select * into draft from public.renewal_email_drafts d where d.id = p_draft_id for update;
  if p_operation not in ('save','dismiss') then raise exception 'Invalid draft operation.'; end if;
  if draft.status <> 'Draft' then raise exception 'This draft is already sent, logged or dismissed.'; end if;
  if public.renewal_draft_send_in_flight(draft.outbound_message_id) then
    raise exception 'This draft has an email whose sending outcome is still being confirmed. Check its status first.';
  end if;
  if p_expected_updated_at is null or draft.updated_at is distinct from p_expected_updated_at then
    raise exception 'This draft changed. Reload it before saving or dismissing.';
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
  if draft.recipient_email is distinct from btrim(p_recipient_email)
    or draft.edited_subject is distinct from btrim(p_subject) or draft.edited_body is distinct from p_body then
    update public.renewal_email_drafts d set recipient_email = btrim(p_recipient_email),edited_subject = btrim(p_subject),edited_body = p_body
      where d.id = draft.id returning * into draft;
  end if;
  return draft;
end;
$$;

revoke all on function public.gmail_outbound_actor_can_send(uuid), public.gmail_outbound_connection_ok(text, text),
  public.gmail_outbound_source_key(jsonb, text), public.gmail_outbound_renewal_due(public.renewal_email_drafts),
  public.gmail_outbound_source_problem(jsonb, uuid, text, uuid, text, uuid, jsonb, uuid, uuid, text),
  public.prepare_gmail_outbound_email(uuid, jsonb), public.gmail_outbound_lock_source(jsonb),
  public.claim_gmail_outbound_email(uuid, uuid), public.fail_prepared_gmail_outbound_email(uuid, uuid, text),
  public.finish_gmail_outbound_email(uuid, uuid, jsonb), public.apply_gmail_outbound_email_effects(uuid),
  public.get_gmail_outbound_email(uuid, uuid), public.list_gmail_outbound_email(uuid, uuid, uuid),
  public.get_gmail_inbox_thread_target(text, text), public.renewal_draft_send_in_flight(uuid),
  public.queue_due_renewal_emails(uuid), public.update_renewal_email_draft(uuid,uuid,text,timestamptz,text,text,text)
  from public, anon, authenticated;
grant execute on function public.gmail_outbound_actor_can_send(uuid), public.gmail_outbound_connection_ok(text, text),
  public.gmail_outbound_source_key(jsonb, text), public.gmail_outbound_renewal_due(public.renewal_email_drafts),
  public.gmail_outbound_source_problem(jsonb, uuid, text, uuid, text, uuid, jsonb, uuid, uuid, text),
  public.prepare_gmail_outbound_email(uuid, jsonb), public.gmail_outbound_lock_source(jsonb),
  public.claim_gmail_outbound_email(uuid, uuid), public.fail_prepared_gmail_outbound_email(uuid, uuid, text),
  public.finish_gmail_outbound_email(uuid, uuid, jsonb), public.apply_gmail_outbound_email_effects(uuid),
  public.get_gmail_outbound_email(uuid, uuid), public.list_gmail_outbound_email(uuid, uuid, uuid),
  public.get_gmail_inbox_thread_target(text, text), public.renewal_draft_send_in_flight(uuid),
  public.queue_due_renewal_emails(uuid), public.update_renewal_email_draft(uuid,uuid,text,timestamptz,text,text,text)
  to service_role;
