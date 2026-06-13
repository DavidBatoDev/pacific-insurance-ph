-- 0004 workflow config — templates, steps, document checklists, email/message templates.

create table public.workflow_templates (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text,
  product_category text,
  status           text not null default 'Active' check (status in ('Active','Inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.workflow_templates enable row level security;
create trigger trg_workflow_templates_updated before update on public.workflow_templates
  for each row execute function public.set_updated_at();

create table public.workflow_steps (
  id                     uuid primary key default gen_random_uuid(),
  workflow_template_id   uuid not null references public.workflow_templates (id) on delete cascade,
  step_name              text not null,
  step_order             integer not null default 0,
  description            text,
  default_assigned_role  text,
  default_due_days       integer,
  required_document_rule text,
  status                 text not null default 'Active' check (status in ('Active','Inactive')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
alter table public.workflow_steps enable row level security;
create trigger trg_workflow_steps_updated before update on public.workflow_steps
  for each row execute function public.set_updated_at();
create index on public.workflow_steps (workflow_template_id, step_order);

create table public.required_document_templates (
  id                   uuid primary key default gen_random_uuid(),
  template_name        text not null,
  product_version_id   uuid references public.product_versions (id) on delete set null,
  workflow_template_id uuid references public.workflow_templates (id) on delete set null,
  description          text,
  status               text not null default 'Active' check (status in ('Active','Inactive')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.required_document_templates enable row level security;
create trigger trg_required_document_templates_updated before update on public.required_document_templates
  for each row execute function public.set_updated_at();

create table public.required_document_items (
  id                      uuid primary key default gen_random_uuid(),
  requirement_template_id uuid not null references public.required_document_templates (id) on delete cascade,
  document_name           text not null,
  is_required             boolean not null default true,
  applies_to              text,
  notes                   text,
  sort_order              integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
alter table public.required_document_items enable row level security;
create trigger trg_required_document_items_updated before update on public.required_document_items
  for each row execute function public.set_updated_at();
create index on public.required_document_items (requirement_template_id, sort_order);

create table public.email_templates (
  id                   uuid primary key default gen_random_uuid(),
  template_name        text not null,
  product_version_id   uuid references public.product_versions (id) on delete set null,
  workflow_template_id uuid references public.workflow_templates (id) on delete set null,
  workflow_step_id     uuid references public.workflow_steps (id) on delete set null,
  subject              text,
  body                 text,
  status               text not null default 'Active' check (status in ('Active','Inactive')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.email_templates enable row level security;
create trigger trg_email_templates_updated before update on public.email_templates
  for each row execute function public.set_updated_at();

-- Channel-agnostic message templates (WhatsApp/SMS/Viber via Evolution; email uses email_templates).
create table public.message_templates (
  id                   uuid primary key default gen_random_uuid(),
  template_name        text not null,
  channel              text not null check (channel in ('WhatsApp','SMS','Viber')),
  workflow_template_id uuid references public.workflow_templates (id) on delete set null,
  workflow_step_id     uuid references public.workflow_steps (id) on delete set null,
  body                 text,
  status               text not null default 'Active' check (status in ('Active','Inactive')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.message_templates enable row level security;
create trigger trg_message_templates_updated before update on public.message_templates
  for each row execute function public.set_updated_at();
