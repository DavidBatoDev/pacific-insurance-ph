-- Retain MIME evidence metadata independently from the 25 MB binary download/filing limit.
alter table public.gmail_inbox_messages
  drop constraint gmail_inbox_messages_attachments_check,
  add constraint gmail_inbox_messages_attachments_check check (jsonb_typeof(attachments)='array' and jsonb_array_length(attachments)<=250),
  drop constraint gmail_inbox_messages_from_address_check,
  add constraint gmail_inbox_messages_from_address_check check (length(from_address) between 0 and 320),
  drop constraint gmail_inbox_messages_from_name_check,
  add constraint gmail_inbox_messages_from_name_check check (octet_length(from_name)<=262144),
  drop constraint gmail_inbox_messages_subject_check,
  add constraint gmail_inbox_messages_subject_check check (octet_length(subject)<=262144),
  drop constraint gmail_inbox_messages_authentication_results_check,
  add constraint gmail_inbox_messages_authentication_results_check check (octet_length(authentication_results)<=262144),
  drop constraint gmail_inbox_messages_check1,
  add constraint gmail_inbox_messages_header_arrays_check check (cardinality(message_references)<=16384 and cardinality(to_addresses)<=16384 and cardinality(cc_addresses)<=16384),
  drop constraint gmail_inbox_messages_gmail_message_id_check,
  add constraint gmail_inbox_messages_gmail_message_id_check check (length(gmail_message_id) between 1 and 256 and gmail_message_id ~ '^[a-zA-Z0-9_-]+$'),
  drop constraint gmail_inbox_messages_gmail_thread_id_check,
  add constraint gmail_inbox_messages_gmail_thread_id_check check (length(gmail_thread_id) between 1 and 256 and gmail_thread_id ~ '^[a-zA-Z0-9_-]+$');

create or replace function public.commit_gmail_inbox_sync(p_input jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare s public.gmail_inbox_sync%rowtype; m jsonb; attachment jsonb; done boolean; next_history text;
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
      or jsonb_array_length(m->'attachments') > 250 then
      raise exception 'inbox_invalid_message' using errcode = '22023';
    end if;
    for attachment in select value from jsonb_array_elements(m->'attachments') loop
      if jsonb_typeof(attachment) is distinct from 'object' or attachment->>'partId' is null or length(attachment->>'partId') > 255
        or coalesce(length(attachment->>'fileName'), 0) not between 1 and 1024 or coalesce(length(attachment->>'mimeType'), 0) not between 1 and 255
        or (attachment->>'size') is null or (attachment->>'size')::bigint not between 0 and 9007199254740991
        or length(attachment->>'attachmentId') > 2048 or attachment ? 'data' then
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
