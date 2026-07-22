-- 0018: Supabase linter 0014 — extensions don't belong in public.
-- Guarded so a fresh database (where 0017 already installs pg_trgm into the
-- extensions schema) applies cleanly. Existing trigram indexes track the
-- operator classes by OID, so they stay valid.
do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm' and n.nspname = 'public'
  ) then
    alter extension pg_trgm set schema extensions;
  end if;
end $$;
