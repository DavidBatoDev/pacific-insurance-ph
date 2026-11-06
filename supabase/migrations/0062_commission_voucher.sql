-- Carrier originals are independent from commission payment. Historical rows
-- deliberately retain null voucher metadata and their existing financial values.
alter table public.documents
  add column commission_id uuid references public.commissions(id) on delete restrict;
create index documents_commission_id_idx on public.documents(commission_id)
  where commission_id is not null;
create index documents_file_path_idx on public.documents(file_path)
  where file_path is not null;

alter table public.commissions
  add column voucher_document_id uuid references public.documents(id) on delete restrict,
  add column voucher_reference text,
  add column voucher_received_at timestamptz;
create unique index commissions_voucher_document_id_idx on public.commissions(voucher_document_id)
  where voucher_document_id is not null;

alter table public.documents
  add constraint documents_commission_voucher_check check (
    (commission_id is null and document_type is distinct from 'Commission Voucher')
    or (
      commission_id is not null and document_type is not distinct from 'Commission Voucher'
      and client_id is not null
      and num_nonnulls(policy_id, application_id, claim_id, renewal_id, travel_request_id,
        application_requirement_id, claim_requirement_id, travel_requirement_id, source_library_document_id) = 0
      and visibility = 'Internal Only' and status in ('Uploaded', 'Replaced')
      and file_path is not null
      and file_path ~ ('^' || client_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$')
    )
  );
alter table public.commissions
  add constraint commissions_voucher_metadata_check check (
    (voucher_document_id is null and voucher_reference is null and voucher_received_at is null)
    or (voucher_document_id is not null and client_id is not null and voucher_received_at is not null
      and (voucher_reference is null or (length(voucher_reference) between 1 and 200 and voucher_reference = btrim(voucher_reference))))
  );

-- Composite foreign keys enforce scope even for direct service-role writes:
-- every retained original belongs to the commission's client, and a current
-- pointer must identify an original of that exact commission and client.
alter table public.commissions
  add constraint commissions_id_client_id_key unique(id, client_id);
alter table public.documents
  add constraint documents_id_commission_client_key unique(id, commission_id, client_id),
  add constraint documents_commission_client_fkey foreign key(commission_id, client_id)
    references public.commissions(id, client_id) on delete restrict;
alter table public.commissions
  add constraint commissions_voucher_document_scope_fkey foreign key(voucher_document_id, id, client_id)
    references public.documents(id, commission_id, client_id) on delete restrict;

-- Generic document finalizers must not create an unguarded alias for a voucher
-- path. Serialize both directions, without changing ordinary shared-file use.
create function public.guard_commission_voucher_path()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.file_path is null then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.file_path, 0));
  if exists(
    select 1 from public.documents d where d.file_path = new.file_path and d.id is distinct from new.id
      and (new.commission_id is not null or new.document_type = 'Commission Voucher'
        or d.commission_id is not null or d.document_type = 'Commission Voucher')
  ) then
    raise exception 'Commission voucher files cannot be shared with other documents.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger commission_voucher_path before insert or update of file_path, document_type, commission_id on public.documents
  for each row execute function public.guard_commission_voucher_path();

-- Neither a generic edit nor a deletion may turn an original into a different
-- document. Replacement changes status only; the old bytes and identity remain.
create function public.protect_commission_voucher_original()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.commission_id is not null or old.document_type = 'Commission Voucher' then
    if tg_op = 'DELETE' then
      raise exception 'Commission voucher originals cannot be deleted. Replace the voucher from Commissions.' using errcode = '22023';
    end if;
  elsif tg_op = 'DELETE' then
    return old;
  elsif new.commission_id is null and new.document_type is distinct from 'Commission Voucher' then
    return new;
  end if;
  if row(new.id, new.client_id, new.commission_id, new.document_type, new.name, new.file_path,
      new.uploaded_by, new.uploaded_at, new.visibility, new.policy_id, new.application_id, new.claim_id,
      new.renewal_id, new.travel_request_id, new.application_requirement_id, new.claim_requirement_id,
      new.travel_requirement_id, new.source_library_document_id)
    is distinct from row(old.id, old.client_id, old.commission_id, old.document_type, old.name, old.file_path,
      old.uploaded_by, old.uploaded_at, old.visibility, old.policy_id, old.application_id, old.claim_id,
      old.renewal_id, old.travel_request_id, old.application_requirement_id, old.claim_requirement_id,
      old.travel_requirement_id, old.source_library_document_id)
    or (new.status is distinct from old.status and not (old.status = 'Uploaded' and new.status = 'Replaced')) then
    raise exception 'Commission voucher originals cannot be changed. Replace the voucher from Commissions.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger immutable_commission_voucher_original before update or delete on public.documents
  for each row execute function public.protect_commission_voucher_original();

create function public.file_commission_voucher(
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
    raise exception 'The voucher changed. Reload before replacing it.' using errcode = '40001';
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

create function public.transition_commission(p_actor_id uuid, p_commission_id uuid, p_step text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  actor public.users%rowtype;
  commission public.commissions%rowtype;
  client public.clients%rowtype;
  next_status text;
  next_paid_date date;
  next_follow_up_date date;
  summary text;
begin
  if p_actor_id is null then raise exception 'Not authenticated.' using errcode = '42501'; end if;
  select * into actor from public.users where id = p_actor_id for share;
  if not found then raise exception 'Not authenticated.' using errcode = '42501'; end if;
  if actor.status <> 'Active' then raise exception 'Your account is inactive.' using errcode = '42501'; end if;
  if actor.role not in ('Owner', 'Admin', 'Assistant') then
    raise exception 'Commission not found.' using errcode = '42501';
  end if;
  if p_step is null or p_step not in ('requested', 'follow-up', 'paid') then
    raise exception 'Invalid commission step.' using errcode = '22023';
  end if;

  select * into commission from public.commissions where id = p_commission_id for update;
  if not found then raise exception 'Commission not found.' using errcode = '42501'; end if;
  if commission.client_id is not null then
    select * into client from public.clients where id = commission.client_id for share;
  end if;
  if actor.role = 'Assistant' and (client.id is null or client.assigned_user_id is distinct from p_actor_id) then
    raise exception 'Commission not found.' using errcode = '42501';
  end if;

  next_paid_date := commission.paid_date;
  next_follow_up_date := commission.follow_up_date;
  if p_step = 'paid' then
    if commission.voucher_status = 'Paid' then return commission.id; end if;
    next_status := 'Paid';
    next_paid_date := coalesce(commission.paid_date, current_date);
    summary := 'Commission payment recorded';
  else
    next_follow_up_date := current_date;
    next_status := case
      when commission.voucher_status = 'Paid' then 'Paid'
      when commission.voucher_document_id is not null then 'Received'
      when p_step = 'requested' then 'Voucher Pending'
      else 'Issue / Follow-Up Required'
    end;
    summary := case when p_step = 'requested' then 'Commission voucher requested' else 'Commission follow-up logged' end;
  end if;
  update public.commissions set voucher_status = next_status, paid_date = next_paid_date,
    follow_up_date = next_follow_up_date where id = commission.id;

  insert into public.audit_logs(actor_id, action, table_name, record_id, previous_value, new_value)
  values(p_actor_id, 'commission.' || p_step, 'commissions', commission.id,
    jsonb_build_object('voucher_status', commission.voucher_status, 'paid_date', commission.paid_date,
      'follow_up_date', commission.follow_up_date),
    jsonb_build_object('commission_id', commission.id, 'voucher_status', next_status, 'paid_date', next_paid_date,
      'follow_up_date', next_follow_up_date));
  if commission.client_id is not null then
    insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id, client_visible, metadata)
    values('client', commission.client_id, 'commission.' || p_step,
      summary || ' — OR ' || coalesce(commission.or_number, '—'), p_actor_id, false,
      jsonb_build_object('commission_id', commission.id, 'voucher_status', next_status));
  end if;
  return commission.id;
end;
$$;

-- Preserve every existing non-voucher deletion branch from 0057. Voucher
-- replacement, never destructive deletion, is the correction path for originals.
create or replace function public.delete_document_safely(p_actor_id uuid, p_document_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare d public.documents%rowtype; path text; preserved boolean := false;
begin
  if not exists(select 1 from public.users u where u.id = p_actor_id and u.status = 'Active' and u.role in ('Owner','Admin')) then
    raise exception 'attachment_forbidden' using errcode = '42501';
  end if;
  select * into d from public.documents where id = p_document_id for update;
  if d.id is null then return jsonb_build_object('storagePath',null); end if;
  if d.commission_id is not null or d.document_type = 'Commission Voucher' then
    raise exception 'Commission voucher originals cannot be deleted. Replace the voucher from Commissions.' using errcode = '22023';
  end if;
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

revoke all on function public.guard_commission_voucher_path(), public.protect_commission_voucher_original(),
  public.file_commission_voucher(uuid, uuid, text, text, text, uuid),
  public.transition_commission(uuid, uuid, text), public.delete_document_safely(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.guard_commission_voucher_path(), public.protect_commission_voucher_original(),
  public.file_commission_voucher(uuid, uuid, text, text, text, uuid),
  public.transition_commission(uuid, uuid, text), public.delete_document_safely(uuid, uuid)
  to service_role;
