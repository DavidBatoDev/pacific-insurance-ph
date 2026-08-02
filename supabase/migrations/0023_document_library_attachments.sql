alter table public.document_library
  add column version_label text,
  add column variant text,
  add column age_band text not null default 'All Ages'
    check (age_band in ('All Ages', '0-70', '71-100')),
  add column approval_status text not null default 'Draft'
    check (approval_status in ('Draft', 'Pending Approval', 'Approved', 'Rejected')),
  add column distribution_notes text,
  add column original_file_name text,
  add column mime_type text,
  add column file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  add column uploaded_by uuid references public.users (id) on delete set null;

update public.document_library set version_label = 'Legacy' where version_label is null;
alter table public.document_library alter column version_label set not null;

create table public.communication_library_documents (
  communication_id uuid not null references public.communications (id) on delete cascade,
  document_library_id uuid not null references public.document_library (id) on delete restrict,
  document_name_snapshot text not null,
  version_label_snapshot text not null,
  file_path_snapshot text not null,
  created_at timestamptz not null default now(),
  primary key (communication_id, document_library_id)
);
alter table public.communication_library_documents enable row level security;
create index on public.communication_library_documents (document_library_id);

create unique index document_library_one_approved_slot_idx
  on public.document_library (
    product_version_id,
    document_type,
    coalesce(variant, ''),
    age_band
  )
  where status = 'Active' and approval_status = 'Approved';

create or replace function public.approve_document_library_asset(p_asset_id uuid)
returns public.document_library
language plpgsql
security invoker
set search_path = public
as $$
declare
  target public.document_library;
begin
  select * into target from public.document_library where id = p_asset_id for update;
  if target.id is null then raise exception 'Library asset not found'; end if;
  if target.file_path is null then raise exception 'Library asset has no uploaded file'; end if;
  if target.product_version_id is null then raise exception 'Product version is required'; end if;

  update public.document_library
     set status = 'Inactive'
   where id <> target.id
     and product_version_id = target.product_version_id
     and document_type is not distinct from target.document_type
     and variant is not distinct from target.variant
     and age_band = target.age_band
     and status = 'Active'
     and approval_status = 'Approved';

  update public.document_library
     set status = 'Active', approval_status = 'Approved'
   where id = target.id
   returning * into target;
  return target;
end;
$$;

revoke execute on function public.approve_document_library_asset(uuid) from public, anon, authenticated;
grant execute on function public.approve_document_library_asset(uuid) to service_role;
