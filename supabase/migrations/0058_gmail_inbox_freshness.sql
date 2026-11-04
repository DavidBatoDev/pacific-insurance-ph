-- Membership revision only: no correspondence metadata or mailbox-global state.
create function public.get_gmail_inbox_revision(p_actor_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select pg_catalog.md5(coalesce(pg_catalog.string_agg(m.id::text, ',' order by m.id), ''))
  from public.gmail_inbox_messages m
  where public.gmail_inbox_actor_can_read(p_actor_id, m.client_id);
$$;

revoke execute on function public.get_gmail_inbox_revision(uuid) from public, anon, authenticated;
grant execute on function public.get_gmail_inbox_revision(uuid) to service_role;
