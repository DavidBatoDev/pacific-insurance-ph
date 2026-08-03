-- Durable, per-application snapshots of configurable requirement templates.

create table public.application_requirements (
  id                          uuid primary key default gen_random_uuid(),
  application_id              uuid not null references public.applications (id) on delete cascade,
  required_document_item_id   uuid references public.required_document_items (id) on delete set null,
  document_name               text not null,
  applies_to                  text,
  notes                       text,
  is_required                 boolean not null default true,
  status                      text not null default 'Pending'
                              check (status in ('Pending', 'Received', 'Incomplete', 'Verified')),
  sort_order                  integer not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (application_id, required_document_item_id)
);

alter table public.application_requirements enable row level security;
create trigger trg_application_requirements_updated before update on public.application_requirements
  for each row execute function public.set_updated_at();
create index application_requirements_application_status_idx
  on public.application_requirements (application_id, status, sort_order);

-- Conservative editable baseline for standard new-business applications. Product-specific
-- templates can be added later without changing instance data.
insert into public.required_document_templates (template_name, description, status)
select 'Standard new-business baseline', 'Confirmed baseline requirements for a standard Pacific Cross new-business application.', 'Active'
where not exists (
  select 1 from public.required_document_templates where template_name = 'Standard new-business baseline'
);

insert into public.required_document_items (requirement_template_id, document_name, is_required, applies_to, notes, sort_order)
select t.id, item.document_name, item.is_required, item.applies_to, item.notes, item.sort_order
from public.required_document_templates t
cross join (
  values
    ('Completed application form', true, null::text, null::text, 10),
    ('Valid government-issued ID', true, null::text, null::text, 20),
    ('Attestation letter with specimen signatures', true, null::text, null::text, 30),
    ('Advisor declaration / remote-selling confirmation', false, 'For remote or online submissions', null::text, 40),
    ('Medical questionnaire or supporting medical records', false, 'If requested by Pacific Cross underwriting', null::text, 50)
) as item(document_name, is_required, applies_to, notes, sort_order)
where t.template_name = 'Standard new-business baseline'
  and not exists (
    select 1 from public.required_document_items i
    where i.requirement_template_id = t.id and i.document_name = item.document_name
  );
