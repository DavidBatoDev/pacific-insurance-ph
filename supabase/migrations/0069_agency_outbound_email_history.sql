-- Agency-wide, read-only history of CRM-sent email (Email → Sent). Projects only display-safe
-- columns: no body, manifest storage paths, dispatch tokens or OAuth identity.

create index gmail_outbound_messages_agency_time_idx
  on public.gmail_outbound_messages ((coalesce(accepted_at, dispatch_started_at, created_at)) desc, id desc);

create function public.list_agency_outbound_email(
  p_actor_id uuid,
  p_query text default '',
  p_status text default 'sent',
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_offset integer default 0
)
returns table (
  id uuid, client_id uuid, client_name text, client_reference text, actor_name text,
  recipient text, subject text, target_kind text, target_id uuid, origin_type text,
  effective_state text, occurred_at timestamptz, created_at timestamptz, accepted_at timestamptz,
  attachment_count integer, effects_pending boolean, thread_mismatch boolean
)
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_query text := btrim(coalesce(p_query, ''));
  v_pattern text;
  -- Same strict 120-second boundary as displayedSendState (STALE_SENDING_MS).
  v_stale_before timestamptz := statement_timestamp() - interval '120 seconds';
begin
  if not public.gmail_outbound_actor_can_send(p_actor_id) then
    raise exception 'outbound_forbidden' using errcode = '42501';
  end if;
  if length(v_query) > 200
    or p_status is null or p_status not in ('sent','all','prepared','sending','failed','unknown')
    or p_offset is null or p_offset < 0 or p_offset > 100000
    or (p_from is not null and p_to is not null and p_from >= p_to) then
    raise exception 'outbound_filter_invalid' using errcode = '22023';
  end if;
  v_pattern := '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select o.id, o.client_id,
    nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''),
    c.reference_no, u.full_name,
    o.recipient_email, o.subject, o.target_kind, o.target_id, o.origin->>'type',
    s.effective_state,
    coalesce(o.accepted_at, o.dispatch_started_at, o.created_at),
    o.created_at, o.accepted_at,
    jsonb_array_length(o.attachments),
    o.state = 'accepted' and o.effects_applied_at is null,
    o.error_code is not distinct from 'gmail_send_thread_mismatch'
  from public.gmail_outbound_messages o
  cross join lateral (select case when o.state = 'sending' and o.dispatch_started_at < v_stale_before
    then 'unknown' else o.state end as effective_state) s
  left join public.clients c on c.id = o.client_id
  left join public.users u on u.id = o.actor_id
  where public.gmail_inbox_actor_can_read(p_actor_id, o.client_id)
    and (p_status = 'all' or s.effective_state = case p_status when 'sent' then 'accepted' else p_status end)
    and (v_query = '' or o.recipient_email ilike v_pattern escape '\' or o.subject ilike v_pattern escape '\')
    and (p_from is null or coalesce(o.accepted_at, o.dispatch_started_at, o.created_at) >= p_from)
    and (p_to is null or coalesce(o.accepted_at, o.dispatch_started_at, o.created_at) < p_to)
  order by coalesce(o.accepted_at, o.dispatch_started_at, o.created_at) desc, o.id desc
  limit 51 offset p_offset;
end;
$$;

revoke all on function public.list_agency_outbound_email(uuid, text, text, timestamptz, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.list_agency_outbound_email(uuid, text, text, timestamptz, timestamptz, integer) to service_role;
