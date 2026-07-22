-- 0017: trigram indexes for global search
--
-- The topbar dropdown / ⌘K palette / /search page match with leading-wildcard
-- ilike ('%term%'), which btree indexes cannot serve. pg_trgm GIN indexes make
-- those predicates index scans instead of sequential scans per keystroke.

create extension if not exists pg_trgm schema extensions;

-- Clients: name / email / mobile / reference (ClientsRepository.search).
create index if not exists idx_clients_first_name_trgm on public.clients using gin (first_name gin_trgm_ops);
create index if not exists idx_clients_last_name_trgm on public.clients using gin (last_name gin_trgm_ops);
create index if not exists idx_clients_email_trgm on public.clients using gin (email gin_trgm_ops);
create index if not exists idx_clients_mobile_trgm on public.clients using gin (mobile_number gin_trgm_ops);
create index if not exists idx_clients_reference_trgm on public.clients using gin (reference_no gin_trgm_ops);

-- Operational registers: reference / policy number / destination / group name
-- (lib/queries/global-search.ts).
create index if not exists idx_policies_reference_trgm on public.policies using gin (reference_no gin_trgm_ops);
create index if not exists idx_policies_policy_number_trgm on public.policies using gin (policy_number gin_trgm_ops);
create index if not exists idx_applications_reference_trgm on public.applications using gin (reference_no gin_trgm_ops);
create index if not exists idx_claims_reference_trgm on public.claims using gin (reference_no gin_trgm_ops);
create index if not exists idx_renewals_reference_trgm on public.renewals using gin (reference_no gin_trgm_ops);
create index if not exists idx_travel_requests_reference_trgm on public.travel_requests using gin (reference_no gin_trgm_ops);
create index if not exists idx_travel_requests_destination_trgm on public.travel_requests using gin (destination gin_trgm_ops);
create index if not exists idx_group_accounts_name_trgm on public.group_accounts using gin (name gin_trgm_ops);
create index if not exists idx_group_accounts_reference_trgm on public.group_accounts using gin (reference_no gin_trgm_ops);
