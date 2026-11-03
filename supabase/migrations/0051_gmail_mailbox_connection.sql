-- Gmail connection only: no email delivery, inbox access, or changes to email logging.
-- All credential access is server-side through the service-role repository.
create table public.gmail_connections (
  id text primary key default 'agency' check (id = 'agency'),
  mailbox_email text not null check (mailbox_email = 'admin@pacificinsuranceph.com'),
  google_subject text not null check (google_subject = btrim(google_subject) and length(google_subject) between 1 and 255),
  oauth_client_id text not null check (oauth_client_id = btrim(oauth_client_id) and length(oauth_client_id) between 1 and 255),
  granted_scopes text[] not null check (
    array_ndims(granted_scopes) = 1
    and array_position(granted_scopes, null) is null
    and array_position(granted_scopes, '') is null
    and granted_scopes @> array['https://www.googleapis.com/auth/gmail.send']::text[]
  ),
  refresh_token_ciphertext text not null check (length(btrim(refresh_token_ciphertext)) > 0),
  refresh_token_expires_at timestamptz,
  status text not null check (status in ('connected', 'reconnect_required')),
  connected_by uuid not null references public.users (id),
  connected_at timestamptz not null,
  last_checked_at timestamptz not null,
  last_auth_error_code text check (last_auth_error_code ~ '^[a-zA-Z0-9_-]{1,64}$'),
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now(),
  check (status <> 'connected' or last_auth_error_code is null)
);
alter table public.gmail_connections enable row level security;
revoke all on table public.gmail_connections from public, anon, authenticated;
grant select, insert, update on table public.gmail_connections to service_role;

create table public.gmail_oauth_attempts (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  initiating_actor_id uuid not null references public.users (id),
  browser_binding_hash text not null check (browser_binding_hash ~ '^[0-9a-f]{64}$'),
  verifier_ciphertext text not null check (length(btrim(verifier_ciphertext)) > 0),
  nonce_hash text not null check (nonce_hash ~ '^[0-9a-f]{64}$'),
  redirect_uri text not null check (
    redirect_uri ~ '^https://[^/?#@[:space:]]+/api/integrations/gmail/callback$'
    or redirect_uri ~ '^http://localhost(:[0-9]{1,5})?/api/integrations/gmail/callback$'
  ),
  oauth_client_id text not null check (oauth_client_id = btrim(oauth_client_id) and length(oauth_client_id) between 1 and 255),
  baseline_revision integer not null check (baseline_revision >= 0),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '10 minutes'),
  check (consumed_at is null or consumed_at >= created_at)
);
alter table public.gmail_oauth_attempts enable row level security;
revoke all on table public.gmail_oauth_attempts from public, anon, authenticated;
grant select, insert, update on table public.gmail_oauth_attempts to service_role;
create index gmail_oauth_attempts_expires_at_idx on public.gmail_oauth_attempts (expires_at);

-- UPDATE takes the row lock and rechecks its predicate after a concurrent consume.
-- Returning no row covers expiry, actor/browser mismatch and replay alike.
create function public.consume_gmail_oauth_attempt(
  p_state_hash text,
  p_actor_id uuid,
  p_browser_binding_hash text
)
returns setof public.gmail_oauth_attempts
language sql volatile security invoker set search_path = '' as $$
  update public.gmail_oauth_attempts a
  set consumed_at = clock_timestamp()
  where a.state_hash = p_state_hash
    and a.initiating_actor_id = p_actor_id
    and a.browser_binding_hash = p_browser_binding_hash
    and a.consumed_at is null
    and a.expires_at > clock_timestamp()
    and exists (
      select 1 from public.users u
      where u.id = p_actor_id and u.status = 'Active' and u.role in ('Owner', 'Admin')
    )
  returning a.*;
$$;
revoke all on function public.consume_gmail_oauth_attempt(text, uuid, text) from public, anon, authenticated;
grant execute on function public.consume_gmail_oauth_attempt(text, uuid, text) to service_role;

-- The fixed advisory lock serializes first inserts as well as reconnects. The row
-- lock also coordinates with health checks; a stale consent/check never wins.
create function public.save_gmail_connection(
  p_connection jsonb,
  p_expected_revision integer,
  p_actor_id uuid
)
returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  previous_connection public.gmail_connections%rowtype;
  saved_connection public.gmail_connections%rowtype;
  next_revision integer;
  saved_at timestamptz;
begin
  if not exists (
    select 1 from public.users u
    where u.id = p_actor_id and u.status = 'Active' and u.role in ('Owner', 'Admin')
  ) then
    raise exception 'Gmail connection changes require an active Admin.' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'A valid Gmail connection revision is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_connection) is distinct from 'object'
    or (p_connection ->> 'connected_by')::uuid is distinct from p_actor_id then
    raise exception 'Invalid Gmail connection input.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(518107, 1);
  select c.* into previous_connection from public.gmail_connections c
    where c.id = 'agency' for update;
  if coalesce(previous_connection.revision, 0) <> p_expected_revision then
    return false;
  end if;
  next_revision := p_expected_revision + 1;
  saved_at := clock_timestamp();

  insert into public.gmail_connections (
    id, mailbox_email, google_subject, oauth_client_id, granted_scopes,
    refresh_token_ciphertext, refresh_token_expires_at, status, connected_by,
    connected_at, last_checked_at, last_auth_error_code, revision, updated_at
  ) values (
    'agency', p_connection ->> 'mailbox_email', p_connection ->> 'google_subject',
    p_connection ->> 'oauth_client_id',
    array(select jsonb_array_elements_text(p_connection -> 'granted_scopes')),
    p_connection ->> 'refresh_token_ciphertext',
    (p_connection ->> 'refresh_token_expires_at')::timestamptz,
    p_connection ->> 'status', p_actor_id,
    (p_connection ->> 'connected_at')::timestamptz,
    (p_connection ->> 'last_checked_at')::timestamptz,
    p_connection ->> 'last_auth_error_code', next_revision, saved_at
  )
  on conflict (id) do update set
    mailbox_email = excluded.mailbox_email,
    google_subject = excluded.google_subject,
    oauth_client_id = excluded.oauth_client_id,
    granted_scopes = excluded.granted_scopes,
    refresh_token_ciphertext = excluded.refresh_token_ciphertext,
    refresh_token_expires_at = excluded.refresh_token_expires_at,
    status = excluded.status,
    connected_by = excluded.connected_by,
    connected_at = excluded.connected_at,
    last_checked_at = excluded.last_checked_at,
    last_auth_error_code = excluded.last_auth_error_code,
    revision = excluded.revision,
    updated_at = excluded.updated_at
  returning * into saved_connection;

  -- Never serialize a credential row. Explicit allowlists keep tokens, OAuth
  -- codes, state, PKCE verifiers and provider error payloads out of the audit.
  insert into public.audit_logs (actor_id, action, table_name, previous_value, new_value)
  values (
    p_actor_id, 'gmail.connection.connected', 'gmail_connections',
    case when previous_connection.id is null then null else jsonb_build_object(
      'connection_id', 'agency', 'mailbox_email', previous_connection.mailbox_email,
      'status', previous_connection.status, 'revision', previous_connection.revision,
      'last_checked_at', previous_connection.last_checked_at,
      'last_auth_error_code', previous_connection.last_auth_error_code
    ) end,
    jsonb_build_object(
      'connection_id', 'agency', 'mailbox_email', saved_connection.mailbox_email,
      'status', saved_connection.status, 'revision', saved_connection.revision,
      'connected_by', saved_connection.connected_by, 'connected_at', saved_connection.connected_at,
      'last_checked_at', saved_connection.last_checked_at,
      'last_auth_error_code', saved_connection.last_auth_error_code
    )
  );
  return true;
end;
$$;
revoke all on function public.save_gmail_connection(jsonb, integer, uuid) from public, anon, authenticated;
grant execute on function public.save_gmail_connection(jsonb, integer, uuid) to service_role;

create function public.record_gmail_connection_check(
  p_expected_revision integer,
  p_actor_id uuid,
  p_status text,
  p_error_code text default null
)
returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  previous_connection public.gmail_connections%rowtype;
  checked_connection public.gmail_connections%rowtype;
  checked_at timestamptz;
begin
  if not exists (
    select 1 from public.users u
    where u.id = p_actor_id and u.status = 'Active' and u.role in ('Owner', 'Admin')
  ) then
    raise exception 'Gmail connection checks require an active Admin.' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'A valid Gmail connection revision is required.' using errcode = '22023';
  end if;

  select c.* into previous_connection from public.gmail_connections c
    where c.id = 'agency' for update;
  if previous_connection.id is null or previous_connection.revision <> p_expected_revision then
    return false;
  end if;
  checked_at := clock_timestamp();
  update public.gmail_connections c set
    status = p_status,
    last_auth_error_code = p_error_code,
    last_checked_at = checked_at,
    revision = c.revision + 1,
    updated_at = checked_at
  where c.id = 'agency' and c.revision = p_expected_revision
  returning c.* into checked_connection;

  insert into public.audit_logs (actor_id, action, table_name, previous_value, new_value)
  values (
    p_actor_id, 'gmail.connection.checked', 'gmail_connections',
    jsonb_build_object(
      'connection_id', 'agency', 'mailbox_email', previous_connection.mailbox_email,
      'status', previous_connection.status, 'revision', previous_connection.revision,
      'last_checked_at', previous_connection.last_checked_at,
      'last_auth_error_code', previous_connection.last_auth_error_code
    ),
    jsonb_build_object(
      'connection_id', 'agency', 'mailbox_email', checked_connection.mailbox_email,
      'status', checked_connection.status, 'revision', checked_connection.revision,
      'last_checked_at', checked_connection.last_checked_at,
      'last_auth_error_code', checked_connection.last_auth_error_code
    )
  );
  return true;
end;
$$;
revoke all on function public.record_gmail_connection_check(integer, uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_gmail_connection_check(integer, uuid, text, text) to service_role;
