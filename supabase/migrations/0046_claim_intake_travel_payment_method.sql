-- 0046: Phase H quick wins — claim intake (H7f) and travel payment method (H6f).
--
-- claims.submission_mode / documents_received_date: how the client's claim arrived (hard or soft
--   copy) and when — distinct from claim_submitted_date, which is when it went to Pacific Cross.
-- travel_requests.portal_payment_method: how the TravelSafe portal payment was made. Eman usually
--   pays on the client's behalf by card, GCash or over the counter.

alter table public.claims add column if not exists submission_mode text;
alter table public.claims drop constraint if exists claims_submission_mode_check;
alter table public.claims
  add constraint claims_submission_mode_check
  check (submission_mode is null or submission_mode in ('Hard copy', 'Soft copy'));
alter table public.claims add column if not exists documents_received_date date;

alter table public.travel_requests add column if not exists portal_payment_method text;
alter table public.travel_requests drop constraint if exists travel_requests_portal_payment_method_check;
alter table public.travel_requests
  add constraint travel_requests_portal_payment_method_check
  check (portal_payment_method is null or portal_payment_method in ('Card', 'GCash', 'Over the counter'));
