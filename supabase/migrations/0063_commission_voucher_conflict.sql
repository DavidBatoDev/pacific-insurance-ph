-- A stale expected pointer is a business conflict, not a retryable serialization failure.
-- PostgREST retries SQLSTATE 40001; use invalid_parameter_value to return the conflict immediately.
create or replace function public.file_commission_voucher(
  p_actor_id uuid,
  p_commission_id uuid,
  p_storage_path text,
  p_file_name text,
  p_voucher_reference text,
  p_expected_document_id uuid
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  actor public.users%rowtype;
  commission public.commissions%rowtype;
  client public.clients%rowtype;
  current_document public.documents%rowtype;
  document_id uuid;
  reference text := nullif(btrim(p_voucher_reference), '');
  filed_at timestamptz := clock_timestamp();
begin
  if p_actor_id is null then raise exception 'Not authenticated.' using errcode = '42501'; end if;
  select * into actor from public.users where id = p_actor_id for share;
  if not found then raise exception 'Not authenticated.' using errcode = '42501'; end if;
  if actor.status <> 'Active' then raise exception 'Your account is inactive.' using errcode = '42501'; end if;
  if actor.role not in ('Owner', 'Admin', 'Assistant') then
    raise exception 'Commission not found.' using errcode = '42501';
  end if;

  select * into commission from public.commissions where id = p_commission_id for update;
  if not found then raise exception 'Commission not found.' using errcode = '42501'; end if;
  if commission.client_id is not null then
    select * into client from public.clients where id = commission.client_id for share;
  end if;
  if actor.role = 'Assistant' and (client.id is null or client.assigned_user_id is distinct from p_actor_id) then
    raise exception 'Commission not found.' using errcode = '42501';
  end if;
  if client.id is null then
    raise exception 'This commission has no client; voucher cannot be filed.' using errcode = '22023';
  end if;
  if p_storage_path is null or p_storage_path !~ ('^' || client.id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$') then
    raise exception 'Invalid upload path.' using errcode = '22023';
  end if;
  if p_file_name is null or length(btrim(p_file_name)) not between 1 and 1024 or p_file_name ~ '[/\\[:cntrl:]]' then
    raise exception 'Invalid voucher filename.' using errcode = '22023';
  end if;
  if length(reference) > 200 then
    raise exception 'Carrier voucher number must be 200 characters or fewer.' using errcode = '22023';
  end if;

  select * into current_document from public.documents where id = commission.voucher_document_id;
  -- A lost-response replay succeeds even though the caller still has the old
  -- expected pointer. It neither duplicates evidence nor resets receipt dates.
  if current_document.id is not null and current_document.file_path = p_storage_path
      and commission.voucher_reference is not distinct from reference then
    return current_document.id;
  end if;
  if commission.voucher_document_id is distinct from p_expected_document_id then
    raise exception 'The voucher changed. Reload before replacing it.' using errcode = '22023';
  end if;

  insert into public.documents(client_id, commission_id, document_type, name, file_path, uploaded_by,
    uploaded_at, visibility, status)
  values(client.id, commission.id, 'Commission Voucher', p_file_name, p_storage_path, p_actor_id,
    filed_at, 'Internal Only', 'Uploaded') returning id into document_id;
  if commission.voucher_document_id is not null then
    update public.documents set status = 'Replaced' where id = commission.voucher_document_id;
  end if;
  update public.commissions set
    voucher_document_id = document_id,
    voucher_reference = reference,
    voucher_received_at = filed_at,
    voucher_status = case when commission.voucher_status = 'Paid' then 'Paid' else 'Received' end,
    received_date = case when commission.voucher_status = 'Paid' then commission.received_date else current_date end
  where id = commission.id;

  insert into public.audit_logs(actor_id, action, table_name, record_id, previous_value, new_value)
  values(p_actor_id, 'commission.voucher_filed', 'commissions', commission.id,
    jsonb_build_object('commission_id', commission.id, 'document_id', commission.voucher_document_id,
      'voucher_document_id', commission.voucher_document_id, 'voucher_reference', commission.voucher_reference,
      'voucher_received_at', commission.voucher_received_at, 'voucher_status', commission.voucher_status,
      'received_date', commission.received_date),
    jsonb_build_object('commission_id', commission.id, 'document_id', document_id,
      'voucher_document_id', document_id, 'voucher_reference', reference, 'voucher_received_at', filed_at,
      'previous_document_id', commission.voucher_document_id, 'previous_voucher_reference', commission.voucher_reference,
      'voucher_status', case when commission.voucher_status = 'Paid' then 'Paid' else 'Received' end,
      'received_date', case when commission.voucher_status = 'Paid' then commission.received_date else current_date end));
  insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id, client_visible, metadata)
  values('client', client.id, 'commission.voucher_filed',
    case when commission.voucher_document_id is null then 'Carrier commission voucher filed' else 'Carrier commission voucher replaced' end,
    p_actor_id, false, jsonb_build_object('commission_id', commission.id, 'document_id', document_id,
      'previous_document_id', commission.voucher_document_id, 'voucher_reference', reference));
  return document_id;
end;
$$;

