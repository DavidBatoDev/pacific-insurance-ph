-- 0044: Phase H H2a / H2b — lead fields the Pacific Cross proposal portal asks for.
--
-- payment_frequency: the portal's Generate step asks Annual or Semi-annual (H2a); captured on
--   Generate Proposal and carried into the application wizard. Wizard-only values such as
--   "Deferred Credit Card" stay on applications.preferred_payment_mode, not here.
-- gender: the portal requires gender per principal (H2b) and nothing stored it for the main
--   applicant. No CHECK, matching 0030's stance on gender; values come from WIZ_OPTS.gender.

alter table public.clients add column if not exists payment_frequency text;
alter table public.clients drop constraint if exists clients_payment_frequency_check;
alter table public.clients
  add constraint clients_payment_frequency_check
  check (payment_frequency is null or payment_frequency in ('Annual', 'Semi-annual'));

alter table public.clients add column if not exists gender text;
