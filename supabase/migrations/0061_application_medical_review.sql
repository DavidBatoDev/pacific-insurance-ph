-- Internal agency review is separate from carrier underwriting and the application lifecycle.
-- No historical checklist rewrite, clearance backfill, or inferred reviewer.
alter table public.application_requirements
  add column section text check (section in ('Basic intake', 'Application documents', 'Medical requirements')),
  add column medical_review_subject text check (medical_review_subject = 'principal'
    or medical_review_subject ~ '^dependent:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
alter table public.applications
  add column medical_class text check (medical_class is null or (medical_class = btrim(medical_class) and length(medical_class) between 1 and 500)),
  add column medical_review_cleared_at timestamptz,
  add column medical_review_cleared_by uuid references public.users(id);
create index application_requirements_medical_subject_idx
  on public.application_requirements(application_id, medical_review_subject) where medical_review_subject is not null;

-- Persisted sections win. Legacy fallback is an exact allowlist, never a medical substring.
create function public.application_requirement_is_medical(p_section text, p_name text)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select case when p_section is not null then p_section = 'Medical requirements' else p_name in (
    'Senior medical examination / physician statement',
    'Medical questionnaire or supporting records',
    'Medical questionnaire or supporting medical records',
    'Chest X-ray taken within the last 6 months',
    'Lipid Profile, HbA1c, Creatinine, BUN, Uric Acid, SGOT, SGPT and GGT',
    'ECG', 'TMST (treadmill stress test)') end;
$$;

alter table public.application_requirements add constraint application_requirement_questionnaire_subject
  check (medical_review_subject is null or (
    document_name in ('Medical questionnaire or supporting records', 'Medical questionnaire or supporting medical records')
    and (section is null or section = 'Medical requirements')));

-- The one SQL eligibility predicate: exact individual-health product and persisted Yes declarations.
create function public.application_medical_review_subjects(p_application_id uuid)
returns table(subject text) language sql stable security invoker set search_path = '' as $$
  with eligible as (
    select a.id, a.pre_existing_status from public.applications a
      join public.product_versions v on v.id = a.product_version_id
      join public.products p on p.id = v.product_id
      where a.id = p_application_id
        and lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g')) in ('select', 'blue royale', 'flexishield')
  )
  select 'principal'::text from eligible where pre_existing_status = 'Yes'
  union all
  select 'dependent:' || d.dependent_id::text from eligible e
    join public.application_dependents d on d.application_id = e.id where d.pre_existing_status = 'Yes';
$$;
-- Explicit, idempotent staff recovery for older senior-Yes applications that have no questionnaire.
-- Creates no document or verification. The insured identity comes from the persisted Yes set.
create function public.add_application_medical_questionnaire(p_actor_id uuid, p_application_id uuid, p_subject_key text)
returns public.applications language plpgsql security invoker set search_path = '' as $$
declare app public.applications%rowtype; person_name text; next_order integer; requirement_id uuid;
begin
  if not exists(select 1 from public.users where id = p_actor_id and status = 'Active' and role in ('Owner','Admin','Assistant')) then
    raise exception 'medical_review_forbidden' using errcode = '42501';
  end if;
  select * into app from public.applications where id = p_application_id for update;
  if app.id is null or app.status in ('Lead','Draft') then raise exception 'medical_review_unavailable' using errcode = '22023'; end if;
  if not exists(select 1 from public.application_medical_review_subjects(app.id) s where s.subject = p_subject_key) then
    raise exception 'medical_review_mapping_invalid' using errcode = '22023';
  end if;
  if exists(select 1 from public.application_requirements r where r.application_id = app.id and r.medical_review_subject = p_subject_key
    and public.application_requirement_is_medical(r.section,r.document_name)
    and r.document_name in ('Medical questionnaire or supporting records', 'Medical questionnaire or supporting medical records')) then return app; end if;
  if p_subject_key = 'principal' then
    select concat_ws(' ',first_name,last_name) into person_name from public.clients where id = app.client_id;
  else
    select d.full_name into person_name from public.application_dependents ad join public.dependents d on d.id = ad.dependent_id
      where ad.application_id = app.id and 'dependent:' || ad.dependent_id::text = p_subject_key;
  end if;
  select coalesce(max(sort_order),0) + 10 into next_order from public.application_requirements where application_id = app.id;
  insert into public.application_requirements(application_id,document_name,applies_to,notes,is_required,status,sort_order,section,medical_review_subject)
    values(app.id,'Medical questionnaire or supporting records',person_name,
      'Internal agency review: upload the appropriate original supporting questionnaire or medical records for staff verification.',
      true,'Pending',next_order,'Medical requirements',p_subject_key) returning id into requirement_id;
  insert into public.audit_logs(actor_id,action,table_name,record_id,new_value)
    values(p_actor_id,'application.medical_questionnaire_added','application_requirements',requirement_id,
      jsonb_build_object('application_id',app.id,'medical_review_subject',p_subject_key,'status','Pending'));
  insert into public.activity_timeline(scope_type,scope_id,activity_type,summary,actor_id,metadata)
    values('client',app.client_id,'application.medical_questionnaire_added',
      'Medical questionnaire checklist item added for ' || coalesce(app.reference_no,'application'),p_actor_id,
      jsonb_build_object('application_id',app.id,'requirement_id',requirement_id));
  select * into app from public.applications where id = app.id;
  return app;
end;
$$;


create function public.application_medical_original_exists(p_requirement_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.application_requirements r
    join public.applications a on a.id = r.application_id
    join public.documents d on d.application_requirement_id = r.id and d.application_id = a.id and d.client_id = a.client_id
    where r.id = p_requirement_id and nullif(btrim(d.file_path), '') is not null and d.status not in ('Draft','Archived','Replaced'));
$$;

create function public.application_medical_review_evidence_valid(p_application_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select not exists(select 1 from public.application_requirements r
    where r.application_id = p_application_id and r.is_required
      and public.application_requirement_is_medical(r.section, r.document_name)
      and (r.status <> 'Verified' or not public.application_medical_original_exists(r.id)))
    and not exists(select 1 from public.application_medical_review_subjects(p_application_id) s
      where (select count(*) from public.application_requirements r
        where r.application_id = p_application_id and r.medical_review_subject = s.subject
          and public.application_requirement_is_medical(r.section, r.document_name)
          and r.document_name in ('Medical questionnaire or supporting records', 'Medical questionnaire or supporting medical records')
          and r.status = 'Verified' and public.application_medical_original_exists(r.id)) <> 1);
$$;

create function public.application_medical_review_problem(p_application_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select case when not exists(select 1 from public.application_medical_review_subjects(p_application_id)) then null
    when exists(select 1 from public.applications a where a.id = p_application_id
      and a.medical_review_cleared_at is not null and a.medical_review_cleared_by is not null
      and length(btrim(a.medical_class)) between 1 and 500
      and public.application_medical_review_evidence_valid(a.id)) then null
    else 'outbound_medical_review_required' end;
$$;

create function public.clear_application_medical_review(
  p_actor_id uuid, p_application_id uuid, p_medical_class text, p_expected_updated_at timestamptz,
  p_questionnaire_requirements jsonb)
returns public.applications language plpgsql security invoker set search_path = '' as $$
declare
  app public.applications%rowtype;
  result public.applications%rowtype;
  assessment text := btrim(p_medical_class);
  association record;
  requirement public.application_requirements%rowtype;
  exact_mapping boolean;
begin
  if not exists(select 1 from public.users where id = p_actor_id and status = 'Active' and role in ('Owner','Admin','Assistant')) then
    raise exception 'medical_review_forbidden' using errcode = '42501';
  end if;
  -- Shared source lock with invalidation and dispatch claim, always before review writes.
  select * into app from public.applications where id = p_application_id for update;
  if app.id is null or app.status in ('Lead','Draft') then
    raise exception 'medical_review_unavailable' using errcode = '22023';
  end if;
  if not exists(select 1 from public.application_medical_review_subjects(app.id)) then
    raise exception 'medical_review_not_required' using errcode = '22023';
  end if;
  if assessment is null or length(assessment) not between 1 and 500 then
    raise exception 'medical_review_class_invalid' using errcode = '22023';
  end if;
  if p_expected_updated_at is null then raise exception 'medical_review_stale' using errcode = '22023'; end if;
  if p_questionnaire_requirements is null or jsonb_typeof(p_questionnaire_requirements) <> 'object' then
    raise exception 'medical_review_mapping_invalid' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_each(p_questionnaire_requirements)) <> (select count(*) from public.application_medical_review_subjects(app.id))
    or exists(select 1 from jsonb_each(p_questionnaire_requirements) m
      where not exists(select 1 from public.application_medical_review_subjects(app.id) s where s.subject = m.key)
        or jsonb_typeof(m.value) <> 'string'
        or (m.value #>> '{}') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
    or (select count(distinct lower(value)) from jsonb_each_text(p_questionnaire_requirements)) <> (select count(*) from jsonb_each(p_questionnaire_requirements)) then
    raise exception 'medical_review_mapping_invalid' using errcode = '22023';
  end if;
  select not exists(select 1 from jsonb_each_text(p_questionnaire_requirements) m
    where not exists(select 1 from public.application_requirements r
      where r.id = m.value::uuid and r.application_id = app.id and r.medical_review_subject = m.key))
    and not exists(select 1 from public.application_requirements r where r.application_id = app.id
      and r.medical_review_subject is not null
      and not exists(select 1 from jsonb_each_text(p_questionnaire_requirements) m where m.key = r.medical_review_subject and m.value::uuid = r.id))
    into exact_mapping;
  -- A replay of the same already-valid review is a read-only no-op, even with its original revision.
  if app.medical_class = assessment and exact_mapping and app.medical_review_cleared_at is not null
    and public.application_medical_review_problem(app.id) is null then return app; end if;
  if app.updated_at is distinct from p_expected_updated_at then
    raise exception 'medical_review_stale' using errcode = '22023';
  end if;
  -- Validate the complete mapping before touching any association. Never infer a person from a name.
  for association in select key, value from jsonb_each_text(p_questionnaire_requirements) order by key loop
    select * into requirement from public.application_requirements where id = association.value::uuid and application_id = app.id;
    if requirement.id is null or not public.application_requirement_is_medical(requirement.section, requirement.document_name)
      or requirement.document_name not in ('Medical questionnaire or supporting records', 'Medical questionnaire or supporting medical records') then
      raise exception 'medical_review_mapping_invalid' using errcode = '22023';
    end if;
    if requirement.status <> 'Verified' or not public.application_medical_original_exists(requirement.id) then
      raise exception 'medical_review_originals_required' using errcode = '22023';
    end if;
  end loop;
  if exists(select 1 from public.application_requirements r where r.application_id = app.id and r.is_required
    and public.application_requirement_is_medical(r.section, r.document_name)
    and (r.status <> 'Verified' or not public.application_medical_original_exists(r.id))) then
    raise exception 'medical_review_originals_required' using errcode = '22023';
  end if;
  update public.application_requirements r set medical_review_subject = null
    where r.application_id = app.id and r.medical_review_subject is not null
      and not exists(select 1 from jsonb_each_text(p_questionnaire_requirements) m where m.key = r.medical_review_subject and m.value::uuid = r.id);
  update public.application_requirements r set medical_review_subject = m.key
    from jsonb_each_text(p_questionnaire_requirements) m
    where r.application_id = app.id and r.id = m.value::uuid and r.medical_review_subject is distinct from m.key;
  -- Class edits invalidate like every material input; stamp clearance only after those triggers finish.
  update public.applications set medical_class = assessment where id = app.id and medical_class is distinct from assessment;
  if not public.application_medical_review_evidence_valid(app.id) then
    raise exception 'medical_review_originals_required' using errcode = '22023';
  end if;
  update public.applications set medical_review_cleared_at = clock_timestamp(), medical_review_cleared_by = p_actor_id
    where id = app.id returning * into result;
  insert into public.audit_logs(actor_id, action, table_name, record_id, previous_value, new_value)
    values(p_actor_id, 'application.medical_review_cleared', 'applications', app.id,
      jsonb_build_object('medical_class',app.medical_class,'cleared_at',app.medical_review_cleared_at,'cleared_by',app.medical_review_cleared_by),
      jsonb_build_object('medical_class',result.medical_class,'cleared_at',result.medical_review_cleared_at,
        'cleared_by',result.medical_review_cleared_by,'questionnaire_requirements',p_questionnaire_requirements));
  insert into public.activity_timeline(scope_type,scope_id,activity_type,summary,actor_id,metadata)
    values('client',app.client_id,'application.medical_review_cleared',
      'Internal medical review cleared for ' || coalesce(app.reference_no,'application'),p_actor_id,jsonb_build_object('application_id',app.id));
  return result;
end;
$$;

-- All child changes take the same application lock used by review and claim. A concurrent child
-- write is either visible before review/claim, or commits afterwards and invalidates that review.
-- PostgreSQL may abort a child-row/app-row lock inversion; the transaction rolls back in full.
create function public.invalidate_application_medical_review(p_application_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.applications where id = p_application_id for update;
  update public.applications set medical_review_cleared_at = null, medical_review_cleared_by = null
    where id = p_application_id;
end;
$$;

create function public.invalidate_application_medical_inputs()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if row(new.client_id,new.product_version_id,new.plan_option_id,new.pre_existing_status,
      nullif(btrim(new.medical_notes),''),new.smoker_status,new.height_inches,new.weight_lbs,nullif(btrim(new.medical_class),''))
    is distinct from row(old.client_id,old.product_version_id,old.plan_option_id,old.pre_existing_status,
      nullif(btrim(old.medical_notes),''),old.smoker_status,old.height_inches,old.weight_lbs,nullif(btrim(old.medical_class),'')) then
    new.medical_review_cleared_at := null;
    new.medical_review_cleared_by := null;
  end if;
  -- Run after the legacy now()-based timestamp trigger. A review revision must also advance
  -- across multiple material writes in one transaction, not only across transaction starts.
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
create trigger zz_application_medical_inputs before update on public.applications
  for each row execute function public.invalidate_application_medical_inputs();

create function public.invalidate_dependent_medical_inputs()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target uuid;
begin
  if tg_op = 'UPDATE' and row(new.application_id,new.dependent_id,new.pre_existing_status,
      nullif(btrim(new.medical_notes),''),new.smoker_status,new.height_inches,new.weight_lbs)
    is not distinct from row(old.application_id,old.dependent_id,old.pre_existing_status,
      nullif(btrim(old.medical_notes),''),old.smoker_status,old.height_inches,old.weight_lbs) then return new; end if;
  for target in select distinct id from unnest(array[
    case when tg_op <> 'INSERT' then old.application_id end,
    case when tg_op <> 'DELETE' then new.application_id end]) id where id is not null order by id loop
    perform public.invalidate_application_medical_review(target);
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger dependent_medical_inputs before insert or update or delete on public.application_dependents
  for each row execute function public.invalidate_dependent_medical_inputs();

create function public.invalidate_medical_requirement_inputs()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target uuid; old_medical boolean := false; new_medical boolean := false;
begin
  if tg_op <> 'INSERT' then old_medical := public.application_requirement_is_medical(old.section,old.document_name); end if;
  if tg_op <> 'DELETE' then new_medical := public.application_requirement_is_medical(new.section,new.document_name); end if;
  if not old_medical and not new_medical then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and row(new.application_id,new.section,new.document_name,new.is_required,new.status,new.medical_review_subject,nullif(btrim(new.notes),''))
    is not distinct from row(old.application_id,old.section,old.document_name,old.is_required,old.status,old.medical_review_subject,nullif(btrim(old.notes),'')) then return new; end if;
  for target in select distinct id from unnest(array[
    case when old_medical then old.application_id end,
    case when new_medical then new.application_id end]) id where id is not null order by id loop
    perform public.invalidate_application_medical_review(target);
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger medical_requirement_inputs before insert or update or delete on public.application_requirements
  for each row execute function public.invalidate_medical_requirement_inputs();

create function public.invalidate_medical_original_inputs()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target uuid; requirement_ids uuid[]; document_ids uuid[];
begin
  if tg_op = 'UPDATE' and row(new.application_requirement_id,new.application_id,new.client_id,nullif(btrim(new.file_path),''),new.status,new.version,new.source_library_document_id)
    is not distinct from row(old.application_requirement_id,old.application_id,old.client_id,nullif(btrim(old.file_path),''),old.status,old.version,old.source_library_document_id) then return new; end if;
  requirement_ids := array[case when tg_op <> 'INSERT' then old.application_requirement_id end,
    case when tg_op <> 'DELETE' then new.application_requirement_id end];
  document_ids := array[case when tg_op <> 'INSERT' then old.id end,case when tg_op <> 'DELETE' then new.id end];
  for target in select distinct r.application_id from public.application_requirements r
    where public.application_requirement_is_medical(r.section,r.document_name) and (
      r.id = any(requirement_ids) or exists(select 1 from public.requirement_attachment_usages u
        left join public.requirement_attachment_sources s on s.id = u.source_id
        where u.application_requirement_id = r.id and (u.document_id = any(document_ids) or s.original_document_id = any(document_ids))))
    order by r.application_id loop
    perform public.invalidate_application_medical_review(target);
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger medical_original_inputs before insert or update or delete on public.documents
  for each row execute function public.invalidate_medical_original_inputs();

create function public.invalidate_medical_attachment_inputs()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target uuid; requirement_ids uuid[]; source_ids uuid[];
begin
  if tg_table_name = 'requirement_attachment_usages' then
    if tg_op = 'UPDATE' and row(new.application_requirement_id,new.document_id,new.source_id,new.upload_path)
      is not distinct from row(old.application_requirement_id,old.document_id,old.source_id,old.upload_path) then return new; end if;
    requirement_ids := array[case when tg_op <> 'INSERT' then old.application_requirement_id end,
      case when tg_op <> 'DELETE' then new.application_requirement_id end];
  else
    if tg_op = 'UPDATE' and row(new.original_document_id,new.storage_path)
      is not distinct from row(old.original_document_id,old.storage_path) then return new; end if;
    source_ids := array[case when tg_op <> 'INSERT' then old.id end,case when tg_op <> 'DELETE' then new.id end];
    select array_agg(u.application_requirement_id) into requirement_ids from public.requirement_attachment_usages u where u.source_id = any(source_ids);
  end if;
  for target in select distinct r.application_id from public.application_requirements r
    where r.id = any(requirement_ids) and public.application_requirement_is_medical(r.section,r.document_name) order by r.application_id loop
    perform public.invalidate_application_medical_review(target);
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger medical_attachment_usage_inputs before insert or update or delete on public.requirement_attachment_usages
  for each row execute function public.invalidate_medical_attachment_inputs();
create trigger medical_attachment_source_inputs before update or delete on public.requirement_attachment_sources
  for each row execute function public.invalidate_medical_attachment_inputs();

-- Age determines senior medical evidence, so persisted birthdate changes also invalidate clearance.
create function public.invalidate_medical_birthdate_inputs()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target uuid;
begin
  if new.date_of_birth is not distinct from old.date_of_birth then return new; end if;
  if tg_table_name = 'clients' then
    for target in select id from public.applications where client_id = new.id order by id loop
      perform public.invalidate_application_medical_review(target);
    end loop;
  else
    for target in select application_id from public.application_dependents where dependent_id = new.id order by application_id loop
      perform public.invalidate_application_medical_review(target);
    end loop;
  end if;
  return new;
end;
$$;
create trigger medical_principal_birthdate_inputs before update on public.clients
  for each row execute function public.invalidate_medical_birthdate_inputs();
create trigger medical_dependent_birthdate_inputs before update on public.dependents
  for each row execute function public.invalidate_medical_birthdate_inputs();

-- Full existing source validation is preserved; only application submission adds the review gate.
create or replace function public.gmail_outbound_source_problem(
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
      if public.application_medical_review_problem(source) is not null then return 'outbound_medical_review_required'; end if;
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

create or replace function public.gmail_outbound_lock_source(p_origin jsonb)
returns void language plpgsql volatile security invoker set search_path = '' as $$
declare draft_id uuid;
begin
  -- Lock order: application -> outbound, or renewal -> draft -> outbound. Keep renewal branches intact.
  if p_origin->>'type' = 'submission' and p_origin->>'kind' = 'application' then
    perform 1 from public.applications where id = (p_origin->>'id')::uuid for update;
  elsif p_origin->>'type' = 'renewal_draft' then
    draft_id := (p_origin->>'id')::uuid;
    perform 1 from public.renewals r join public.renewal_email_drafts d on d.renewal_id = r.id where d.id = draft_id for update of r;
    perform 1 from public.renewal_email_drafts d where d.id = draft_id for update;
  end if;
end;
$$;

revoke execute on function
  public.application_requirement_is_medical(text,text), public.application_medical_review_subjects(uuid),
  public.application_medical_original_exists(uuid), public.application_medical_review_evidence_valid(uuid),
  public.application_medical_review_problem(uuid), public.clear_application_medical_review(uuid,uuid,text,timestamptz,jsonb),
  public.add_application_medical_questionnaire(uuid,uuid,text),
  public.invalidate_application_medical_review(uuid), public.invalidate_application_medical_inputs(),
  public.invalidate_dependent_medical_inputs(), public.invalidate_medical_requirement_inputs(),
  public.invalidate_medical_original_inputs(), public.invalidate_medical_attachment_inputs(), public.invalidate_medical_birthdate_inputs(),
  public.gmail_outbound_source_problem(jsonb,uuid,text,uuid,text,uuid,jsonb,uuid,uuid,text), public.gmail_outbound_lock_source(jsonb)
from public, anon, authenticated;
grant execute on function
  public.application_requirement_is_medical(text,text), public.application_medical_review_subjects(uuid),
  public.application_medical_original_exists(uuid), public.application_medical_review_evidence_valid(uuid),
  public.application_medical_review_problem(uuid), public.clear_application_medical_review(uuid,uuid,text,timestamptz,jsonb),
  public.add_application_medical_questionnaire(uuid,uuid,text),
  public.invalidate_application_medical_review(uuid), public.invalidate_application_medical_inputs(),
  public.invalidate_dependent_medical_inputs(), public.invalidate_medical_requirement_inputs(),
  public.invalidate_medical_original_inputs(), public.invalidate_medical_attachment_inputs(), public.invalidate_medical_birthdate_inputs(),
  public.gmail_outbound_source_problem(jsonb,uuid,text,uuid,text,uuid,jsonb,uuid,uuid,text), public.gmail_outbound_lock_source(jsonb)
to service_role;
