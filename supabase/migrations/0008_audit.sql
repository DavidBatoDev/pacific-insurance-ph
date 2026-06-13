-- 0008 audit — immutable audit trail + human-friendly activity timeline.

-- Compliance record: every meaningful change. Append-only by convention.
create table public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid references public.users (id),
  action         text not null,
  table_name     text,
  record_id      uuid,
  previous_value jsonb,
  new_value      jsonb,
  ip_address     text,
  created_at     timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create index on public.audit_logs (table_name, record_id);
create index on public.audit_logs (actor_id);
create index on public.audit_logs (created_at);

-- Operational memory: human-readable entries scoped to a record. client_visible gates Client Hub.
create table public.activity_timeline (
  id             uuid primary key default gen_random_uuid(),
  scope_type     text not null,   -- client | application | policy | renewal | claim | travel_request | document | payment | relationship_activity
  scope_id       uuid not null,
  activity_type  text not null,
  summary        text not null,
  actor_id       uuid references public.users (id),
  client_visible boolean not null default false,
  metadata       jsonb,
  created_at     timestamptz not null default now()
);
alter table public.activity_timeline enable row level security;
create index on public.activity_timeline (scope_type, scope_id, created_at desc);
create index on public.activity_timeline (client_visible);
