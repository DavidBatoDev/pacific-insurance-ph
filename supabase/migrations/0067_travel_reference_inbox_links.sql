-- H6e: optional Travel supplementary references are links to actual Inbox attachment parts
-- (message + part), never filename text or a second stored copy. Linking changes no payment,
-- policy number, portal status or checklist state.

create table public.travel_pack_reference_attachments (
  travel_request_id uuid not null references public.travel_requests(id) on delete cascade,
  slot text not null check (slot in ('emergency-numbers','covid-coverage','notification-of-claim')),
  message_id uuid not null references public.gmail_inbox_messages(id) on delete restrict,
  part_id text not null check (length(part_id) <= 255),
  -- Server-captured audit aid. Display reads current Inbox metadata; this is never an identity.
  file_name_snapshot text not null check (length(file_name_snapshot) between 1 and 255),
  client_level boolean not null,
  linked_by uuid not null references public.users(id),
  linked_at timestamptz not null default clock_timestamp(),
  primary key (travel_request_id, slot)
);
create index travel_pack_reference_attachments_message_idx on public.travel_pack_reference_attachments(message_id);
create index travel_pack_reference_attachments_linked_by_idx on public.travel_pack_reference_attachments(linked_by);
alter table public.travel_pack_reference_attachments enable row level security;
revoke all on public.travel_pack_reference_attachments from public, anon, authenticated;
grant select, insert, update, delete on public.travel_pack_reference_attachments to service_role;

-- Eligible sources: correspondence of the trip's client, linked to this trip or at client level.
create function public.travel_reference_source_eligible(p_message public.gmail_inbox_messages, p_travel public.travel_requests)
returns boolean language sql stable security invoker set search_path = '' as $$
  select p_message.target_id is not null and p_message.client_id = p_travel.client_id
    and ((p_message.target_kind = 'travel' and p_message.target_id = p_travel.id) or p_message.target_kind = 'client');
$$;

-- Eligibility is applied before pagination, so a capped page never hides later matches.
create function public.list_travel_reference_candidates(p_actor_id uuid, p_travel_request_id uuid, p_search text default '', p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare t public.travel_requests%rowtype; items jsonb; total integer;
begin
  if not exists(select 1 from public.users where id = p_actor_id and status = 'Active' and role in ('Owner','Admin','Assistant')) then
    raise exception 'travel_reference_forbidden' using errcode = '42501';
  end if;
  if p_offset is null or p_offset < 0 or p_offset > 2147483600 or p_search is null or length(p_search) > 200 then
    raise exception 'travel_reference_invalid_page' using errcode = '22023';
  end if;
  select * into t from public.travel_requests where id = p_travel_request_id;
  if t.id is null or not public.gmail_inbox_actor_can_read(p_actor_id, t.client_id) then
    raise exception 'travel_reference_unavailable' using errcode = '42501';
  end if;
  with candidates as (
    select m.id, a.value as attachment, m.subject, m.from_address, m.received_at, m.target_kind
    from public.gmail_inbox_messages m cross join lateral jsonb_array_elements(m.attachments) a(value)
    where public.travel_reference_source_eligible(m, t)
      and public.gmail_inbox_actor_can_read(p_actor_id, m.client_id)
      and (p_search = '' or position(lower(p_search) in lower(concat_ws(' ', a.value->>'fileName', m.subject, m.from_address))) > 0)
  ), page as (select * from candidates order by received_at desc, id, attachment->>'partId' offset p_offset limit 26)
  select coalesce(jsonb_agg(jsonb_build_object(
    'messageId', p.id, 'partId', p.attachment->>'partId', 'fileName', p.attachment->>'fileName',
    'mimeType', p.attachment->>'mimeType', 'size', (p.attachment->>'size')::bigint,
    'subject', p.subject, 'fromAddress', p.from_address, 'receivedAt', p.received_at,
    'stored', exists(select 1 from public.requirement_attachment_sources s where s.message_id = p.id and s.part_id = p.attachment->>'partId'),
    'clientLevel', p.target_kind = 'client',
    'linkedSlots', coalesce((select jsonb_agg(r.slot order by r.slot) from public.travel_pack_reference_attachments r
      where r.travel_request_id = t.id and r.message_id = p.id and r.part_id = p.attachment->>'partId'), '[]'::jsonb)
  ) order by p.received_at desc, p.id, p.attachment->>'partId'), '[]'::jsonb), count(*) into items, total from page p;
  return jsonb_build_object('items', case when total > 25 then items - 25 else items end,
    'nextOffset', case when total > 25 then p_offset + 25 else null end);
end;
$$;

-- Source details are disclosed only while the actor can still read the source email.
create function public.list_travel_reference_attachments(p_actor_id uuid, p_travel_request_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare t public.travel_requests%rowtype;
begin
  select * into t from public.travel_requests where id = p_travel_request_id;
  if t.id is null or not public.gmail_inbox_actor_can_read(p_actor_id, t.client_id) then
    raise exception 'travel_reference_unavailable' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'slot', r.slot, 'messageId', r.message_id, 'partId', r.part_id, 'clientLevel', r.client_level,
    'linkedAt', r.linked_at, 'linkedByName', u.full_name,
    'available', v.visible and public.travel_reference_source_eligible(m, t) and v.part is not null,
    'fileName', case when v.visible then coalesce(v.part->>'fileName', r.file_name_snapshot) end,
    'mimeType', case when v.visible then v.part->>'mimeType' end,
    'size', case when v.visible then (v.part->>'size')::bigint end,
    'subject', case when v.visible then m.subject end,
    'fromAddress', case when v.visible then m.from_address end,
    'receivedAt', case when v.visible then m.received_at end,
    'stored', v.visible and exists(select 1 from public.requirement_attachment_sources s where s.message_id = r.message_id and s.part_id = r.part_id)
  ) order by r.slot)
  from public.travel_pack_reference_attachments r
    join public.gmail_inbox_messages m on m.id = r.message_id
    left join public.users u on u.id = r.linked_by
    cross join lateral (select public.gmail_inbox_actor_can_read(p_actor_id, m.client_id) as visible,
      (select x.value from jsonb_array_elements(m.attachments) x where x.value->>'partId' = r.part_id limit 1) as part) v
  where r.travel_request_id = t.id), '[]'::jsonb);
end;
$$;

create function public.set_travel_reference_attachment(p_actor_id uuid, p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_slot text := p_input->>'slot'; v_part text := p_input->>'partId';
  m public.gmail_inbox_messages%rowtype; t public.travel_requests%rowtype;
  existing public.travel_pack_reference_attachments%rowtype; v_attachment jsonb; v_file_name text;
begin
  if jsonb_typeof(p_input) is distinct from 'object' or v_slot is null
    or v_slot not in ('emergency-numbers','covid-coverage','notification-of-claim')
    or v_part is null or length(v_part) > 255 or p_input->>'messageId' is null or p_input->>'travelRequestId' is null
    or jsonb_typeof(p_input->'confirmClientLevel') is distinct from 'boolean' then
    raise exception 'travel_reference_invalid' using errcode = '22023';
  end if;
  if not exists(select 1 from public.users where id = p_actor_id and status = 'Active' and role in ('Owner','Admin','Assistant')) then
    raise exception 'travel_reference_forbidden' using errcode = '42501';
  end if;
  -- Same first lock as Inbox filing and correct_gmail_inbox_message: linking and correcting serialize.
  select * into m from public.gmail_inbox_messages where id = (p_input->>'messageId')::uuid for update;
  select * into t from public.travel_requests where id = (p_input->>'travelRequestId')::uuid for update;
  if t.id is null or not public.gmail_inbox_actor_can_read(p_actor_id, t.client_id) then
    raise exception 'travel_reference_unavailable' using errcode = '42501';
  end if;
  if m.id is null or not public.gmail_inbox_actor_can_read(p_actor_id, m.client_id)
    or not public.travel_reference_source_eligible(m, t) then
    raise exception 'travel_reference_source_unavailable' using errcode = '42501';
  end if;
  select x.value into v_attachment from jsonb_array_elements(m.attachments) x where x.value->>'partId' = v_part limit 1;
  if v_attachment is null then raise exception 'travel_reference_source_unavailable' using errcode = '42501'; end if;
  if m.target_kind = 'client' and (p_input->>'confirmClientLevel')::boolean is not true then
    raise exception 'travel_reference_confirmation_required' using errcode = '22023';
  end if;
  v_file_name := left(coalesce(nullif(btrim(v_attachment->>'fileName'), ''), 'attachment'), 255);
  select * into existing from public.travel_pack_reference_attachments r
    where r.travel_request_id = t.id and r.slot = v_slot for update;
  if existing.travel_request_id is not null and existing.message_id = m.id and existing.part_id = v_part then
    return jsonb_build_object('changed', false);
  end if;
  insert into public.travel_pack_reference_attachments(travel_request_id, slot, message_id, part_id, file_name_snapshot, client_level, linked_by)
    values(t.id, v_slot, m.id, v_part, v_file_name, m.target_kind = 'client', p_actor_id)
  on conflict (travel_request_id, slot) do update set message_id = excluded.message_id, part_id = excluded.part_id,
    file_name_snapshot = excluded.file_name_snapshot, client_level = excluded.client_level,
    linked_by = excluded.linked_by, linked_at = clock_timestamp();
  insert into public.audit_logs(actor_id, action, table_name, record_id, previous_value, new_value)
    values(p_actor_id, 'travel.reference_attachment_linked', 'travel_requests', t.id,
      case when existing.travel_request_id is null then null else jsonb_build_object('slot', v_slot,
        'message_id', existing.message_id, 'part_id', existing.part_id, 'file_name', existing.file_name_snapshot) end,
      jsonb_build_object('slot', v_slot, 'message_id', m.id, 'part_id', v_part, 'file_name', v_file_name, 'client_level', m.target_kind = 'client'));
  insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id, client_visible, metadata)
    values('client', t.client_id, 'travel.reference_attachment_linked', 'Travel supplementary reference recorded from Inbox', p_actor_id, false,
      jsonb_build_object('travel_request_id', t.id, 'slot', v_slot, 'message_id', m.id));
  return jsonb_build_object('changed', true);
end;
$$;

create function public.unlink_travel_reference_attachment(p_actor_id uuid, p_travel_request_id uuid, p_slot text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare link public.travel_pack_reference_attachments%rowtype; current_link public.travel_pack_reference_attachments%rowtype;
  t public.travel_requests%rowtype;
begin
  if p_slot is null or p_slot not in ('emergency-numbers','covid-coverage','notification-of-claim') then
    raise exception 'travel_reference_invalid' using errcode = '22023';
  end if;
  if not exists(select 1 from public.users where id = p_actor_id and status = 'Active' and role in ('Owner','Admin','Assistant')) then
    raise exception 'travel_reference_forbidden' using errcode = '42501';
  end if;
  select * into link from public.travel_pack_reference_attachments r where r.travel_request_id = p_travel_request_id and r.slot = p_slot;
  if link.travel_request_id is not null then
    perform 1 from public.gmail_inbox_messages where id = link.message_id for update;
  end if;
  select * into t from public.travel_requests where id = p_travel_request_id for update;
  if t.id is null or not public.gmail_inbox_actor_can_read(p_actor_id, t.client_id) then
    raise exception 'travel_reference_unavailable' using errcode = '42501';
  end if;
  if link.travel_request_id is null then return jsonb_build_object('changed', false); end if;
  select * into current_link from public.travel_pack_reference_attachments r
    where r.travel_request_id = p_travel_request_id and r.slot = p_slot for update;
  if current_link.travel_request_id is null then return jsonb_build_object('changed', false); end if;
  if current_link.message_id <> link.message_id or current_link.part_id <> link.part_id then
    raise exception 'travel_reference_changed' using errcode = 'P0001';
  end if;
  -- Removes only the association: the email, its stored original and checklist state are untouched.
  delete from public.travel_pack_reference_attachments r where r.travel_request_id = p_travel_request_id and r.slot = p_slot;
  insert into public.audit_logs(actor_id, action, table_name, record_id, previous_value)
    values(p_actor_id, 'travel.reference_attachment_unlinked', 'travel_requests', t.id,
      jsonb_build_object('slot', p_slot, 'message_id', current_link.message_id, 'part_id', current_link.part_id, 'file_name', current_link.file_name_snapshot));
  insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id, client_visible, metadata)
    values('client', t.client_id, 'travel.reference_attachment_unlinked', 'Travel supplementary reference unlinked', p_actor_id, false,
      jsonb_build_object('travel_request_id', t.id, 'slot', p_slot, 'message_id', current_link.message_id));
  return jsonb_build_object('changed', true);
end;
$$;

-- An email used as a Travel reference is a correction dependency. correct_gmail_inbox_message
-- calls preview_gmail_inbox_correction under the message lock, so the blocker also stops a
-- correction when a link was saved after its review.
alter function public.preview_gmail_inbox_correction(uuid,uuid,text,uuid) rename to preview_gmail_inbox_correction_core;
create function public.preview_gmail_inbox_correction(p_actor_id uuid, p_message_id uuid, p_kind text, p_target_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare impact jsonb; refs text;
begin
  impact := public.preview_gmail_inbox_correction_core(p_actor_id, p_message_id, p_kind, p_target_id);
  select string_agg(distinct coalesce(t.reference_no, 'a Travel request'), ', ' order by coalesce(t.reference_no, 'a Travel request'))
    into refs from public.travel_pack_reference_attachments r join public.travel_requests t on t.id = r.travel_request_id
    where r.message_id = p_message_id;
  if refs is not null then
    impact := jsonb_set(impact, '{blockers}', (impact->'blockers') || to_jsonb('This email is recorded as a Travel supplementary reference on '
      || refs || '. Unlink it in the Travel workflow before correcting this email.'));
  end if;
  return impact;
end;
$$;

revoke all on function public.travel_reference_source_eligible(public.gmail_inbox_messages, public.travel_requests),
  public.list_travel_reference_candidates(uuid,uuid,text,integer), public.list_travel_reference_attachments(uuid,uuid),
  public.set_travel_reference_attachment(uuid,jsonb), public.unlink_travel_reference_attachment(uuid,uuid,text),
  public.preview_gmail_inbox_correction_core(uuid,uuid,text,uuid), public.preview_gmail_inbox_correction(uuid,uuid,text,uuid)
  from public, anon, authenticated;
grant execute on function public.travel_reference_source_eligible(public.gmail_inbox_messages, public.travel_requests),
  public.list_travel_reference_candidates(uuid,uuid,text,integer), public.list_travel_reference_attachments(uuid,uuid),
  public.set_travel_reference_attachment(uuid,jsonb), public.unlink_travel_reference_attachment(uuid,uuid,text),
  public.preview_gmail_inbox_correction_core(uuid,uuid,text,uuid), public.preview_gmail_inbox_correction(uuid,uuid,text,uuid)
  to service_role;
