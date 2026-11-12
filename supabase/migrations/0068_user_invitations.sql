-- Phase I: Owner-initiated staff invitations. A users row exists from the moment the Owner
-- invites; it becomes Active only when the invitee sets their own password. Invited rows are
-- the single permitted hard delete (revoke) because nothing has referenced the account yet.

alter table public.users drop constraint users_status_check;
alter table public.users add constraint users_status_check
  check (status in ('Active','Inactive','Invited'));

alter table public.users
  add column invited_by   uuid references public.users (id),
  add column invited_at   timestamptz,
  add column activated_at timestamptz;

create index users_invited_by_idx on public.users (invited_by);
