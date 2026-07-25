-- Persist a resumable New Application wizard draft on its application row.
alter table public.applications
  add column if not exists wizard_state jsonb;
