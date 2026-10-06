-- 0043: Phase H H1d — Archived client status.
--
-- Clients who have left (e.g. a departed policyholder flagged in Eman's staging sheet) are kept
-- for history rather than deleted. Archived clients are hidden from active lists, pickers and
-- counts but stay searchable and open normally. clients.status was free text with no CHECK
-- (0002_identity.sql); only 'Active' was ever written, so normalise anything else first.

update public.clients
set status = 'Active'
where status is null or status not in ('Active', 'Archived');

alter table public.clients drop constraint if exists clients_status_check;
alter table public.clients
  add constraint clients_status_check check (status in ('Active', 'Archived'));

create index if not exists clients_active_idx
  on public.clients (created_at desc)
  where status = 'Active';
