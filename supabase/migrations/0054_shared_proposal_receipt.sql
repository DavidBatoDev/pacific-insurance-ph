-- Shared proposal receipt transaction for portal upload-back and incoming evidence.
create function public.register_proposal_receipt(p_input jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := (p_input->>'actorId')::uuid; actor_role text;
  kind text := p_input->>'targetKind'; target uuid := (p_input->>'targetId')::uuid;
  source_client uuid; lead public.clients%rowtype; application_status text;
  path text := p_input->>'storagePath'; name text := p_input->>'name';
  doc uuid; old_doc record;
begin
  select role into actor_role from public.users where id=actor and status='Active' and role in ('Owner','Admin','Assistant','Viewer');
  if not found then
    raise exception 'proposal_receipt_forbidden' using errcode='42501';
  end if;
  if kind='client' then source_client:=target;
  elsif kind='application' then select client_id into source_client from public.applications where id=target;
  else raise exception 'proposal_receipt_invalid_source' using errcode='22023'; end if;
  select * into lead from public.clients where id=source_client for update;
  if not found then raise exception 'proposal_receipt_source_unavailable' using errcode='22023'; end if;
  if actor_role='Viewer' and lead.assigned_user_id is distinct from actor then
    raise exception 'proposal_receipt_forbidden' using errcode='42501';
  end if;
  if kind='application' then
    select status into application_status from public.applications where id=target and client_id=source_client for update;
    if not found or application_status='Lead' then raise exception 'proposal_receipt_source_unavailable' using errcode='22023'; end if;
  end if;
  -- A repeated upload result never resets a later decision or reactivates a replaced original.
  select d.id into doc from public.documents d where d.client_id=source_client and d.file_path=path
    and d.document_type='Illustrative Proposal'
    and ((kind='client' and d.application_id is null) or (kind='application' and d.application_id=target))
    order by d.created_at,d.id limit 1;
  if found then return doc; end if;
  if kind='client' then
    if lead.lifecycle_stage<>'Lead' or (lead.proposal_status is not null and lead.proposal_status<>'Requested') then
      raise exception 'proposal_receipt_not_receivable' using errcode='22023';
    end if;
  end if;
  if path is null or left(path,length(source_client::text)+1)<>source_client::text||'/' or path !~ '\.(pdf|png|jpg)$'
    or name is null or length(name) not between 1 and 1024 then
    raise exception 'proposal_receipt_invalid_document' using errcode='22023';
  end if;
  insert into public.documents(client_id,application_id,document_type,name,file_path,uploaded_by,visibility,status)
    values(source_client,case when kind='application' then target end,'Illustrative Proposal',name,path,actor,'Internal Only','Uploaded') returning id into doc;
  if kind='client' then update public.clients set proposal_status='Received',proposal_decision=null where id=source_client;
  else
    for old_doc in select id,status from public.documents where client_id=source_client and document_type='Illustrative Proposal' and status<>'Replaced' and id<>doc for update loop
      update public.documents set status='Replaced' where id=old_doc.id;
      insert into public.audit_logs(actor_id,action,table_name,record_id,previous_value,new_value)
        values(actor,'update','documents',old_doc.id,jsonb_build_object('status',old_doc.status),jsonb_build_object('status','Replaced','replacedBy',doc));
    end loop;
  end if;
  insert into public.audit_logs(actor_id,action,table_name,record_id,new_value)
    values(actor,'proposal.received','documents',doc,jsonb_build_object('target_kind',kind,'target_id',target,'document_type','Illustrative Proposal'));
  insert into public.activity_timeline(scope_type,scope_id,activity_type,summary,actor_id,metadata)
    values('client',source_client,case when kind='client' then 'lead.proposal' else 'application.proposal_received' end,
      'Illustrative proposal received and filed',actor,jsonb_build_object('document_id',doc,'target_kind',kind,'target_id',target));
  return doc;
end;
$$;
revoke all on function public.register_proposal_receipt(jsonb) from public, anon, authenticated;
grant execute on function public.register_proposal_receipt(jsonb) to service_role;

create or replace function public.file_gmail_inbox_attachment(p_input jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  m public.gmail_inbox_messages%rowtype; prior public.gmail_inbox_filings%rowtype;
  actor uuid := (p_input->>'actorId')::uuid; part text := p_input->>'partId'; purpose text := p_input->>'purpose';
  requirement uuid := (p_input->>'requirementId')::uuid; supplied_requirement uuid := (p_input->>'requirementId')::uuid;
  path text := p_input->>'storagePath'; filename text := p_input->>'fileName'; doc uuid; doc_type text;
  app_requirement uuid; claim_requirement uuid; travel_requirement uuid; source_status text; req_status text;
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
  perform 1 from public.clients where id = m.client_id for update;
  if not found or not public.lock_gmail_inbox_target(m.target_kind, m.target_id, m.client_id) then
    raise exception 'inbox_target_unavailable' using errcode = '22023';
  end if;
  if purpose not in ('application_requirement','claim_requirement','travel_requirement','travel_policy') and requirement is not null then
    raise exception 'inbox_invalid_requirement' using errcode = '22023';
  end if;
  doc_type := 'Incoming Email Attachment';
  if purpose = 'application_requirement' then
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
  if purpose = 'proposal' then
    doc := public.register_proposal_receipt(jsonb_build_object('actorId',actor,'targetKind',m.target_kind,'targetId',m.target_id,'storagePath',path,'name',filename));
  else
  insert into public.documents(client_id, application_id, claim_id, renewal_id, travel_request_id, policy_id,
    application_requirement_id, claim_requirement_id, travel_requirement_id, document_type, name, file_path, uploaded_by, visibility, status)
  values(m.client_id, case when m.target_kind = 'application' then m.target_id end, case when m.target_kind = 'claim' then m.target_id end,
    case when m.target_kind = 'renewal' then m.target_id end, case when m.target_kind = 'travel' then m.target_id end,
    case when m.target_kind = 'policy' then m.target_id end, app_requirement, claim_requirement, travel_requirement,
    doc_type, filename, path, actor, 'Internal Only', 'Uploaded') returning id into doc;
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
  if purpose <> 'proposal' then
  insert into public.activity_timeline(scope_type, scope_id, activity_type, summary, actor_id, metadata)
    values('client', m.client_id, 'document.uploaded',
      'Incoming Gmail attachment filed by staff', actor, jsonb_build_object('document_id', doc, 'message_id', m.id, 'purpose', purpose));
  end if;
  return doc;
end;
$$;
