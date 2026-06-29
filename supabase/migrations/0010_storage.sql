-- 0010 storage — private bucket for client/policy documents.
-- Access is service-role only (server actions); downloads use short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
