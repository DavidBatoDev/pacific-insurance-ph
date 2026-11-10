-- Inbox correction must not remove the existing Admin-only ability to detach a
-- checklist attachment without changing a correctly linked email. Restore the
-- established deletion contract; immutable Gmail originals, shared bytes and
-- commission-voucher protections remain unchanged. Email relinking itself still
-- requires the new locked impact-review transaction.
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
revoke all on function public.delete_document_safely(uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_document_safely(uuid,uuid) to service_role;
