-- Requirements checklist for claims.
--
-- The schema had `application_requirements` (0024) and `travel_request_requirements`
-- (0025) but no claims equivalent, so claim documents attached only through the
-- generic `documents` table with nothing to check them against. The medical
-- Notification of Claim's page-4 list is the first fully-specified, conditional
-- requirement set we have for claims. See TO-BE-UPDATE-PLAN.md Phase G, item G8.
--
-- Shape copied from application_requirements (0024:3-17) so the existing
-- template/instance pattern from C4 carries over unchanged: an item may either
-- point at a configurable `required_document_items` row or stand alone with a
-- literal document_name.
--
-- SCOPE NOTE: this covers claims only. Pre-approvals still have no entity of their
-- own -- no table, no status, no reference series -- and giving them one means
-- modelling a workflow that precedes a claim (procedure, diagnosis, assessment
-- outcome), not just a checklist. Attaching pre-approval requirements to a claim_id
-- would be semantically wrong, so that is left as follow-up work rather than
-- guessed at here.

create table if not exists public.claim_requirements (
  id                        uuid primary key default gen_random_uuid(),
  claim_id                  uuid not null references public.claims (id) on delete cascade,
  required_document_item_id uuid references public.required_document_items (id) on delete set null,
  document_name             text not null,
  applies_to                text,
  notes                     text,
  is_required               boolean not null default true,
  status                    text not null default 'Pending'
                              check (status in ('Pending','Received','Incomplete','Verified')),
  sort_order                integer not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (claim_id, required_document_item_id)
);
alter table public.claim_requirements enable row level security;
create trigger trg_claim_requirements_updated before update on public.claim_requirements
  for each row execute function public.set_updated_at();
create index if not exists claim_requirements_claim_idx
  on public.claim_requirements (claim_id, status, sort_order);

-- `documents` links a file to at most one requirement. The original constraint
-- (0025:109-115) spelled that out for two FKs as "a is null or b is null", which
-- does not generalise; with three, state the invariant directly.
alter table public.documents
  add column claim_requirement_id uuid references public.claim_requirements (id) on delete set null;

alter table public.documents
  drop constraint documents_one_requirement_check;

alter table public.documents
  add constraint documents_one_requirement_check check (
    (case when application_requirement_id is null then 0 else 1 end)
  + (case when travel_requirement_id      is null then 0 else 1 end)
  + (case when claim_requirement_id       is null then 0 else 1 end) <= 1
  );

create index if not exists documents_claim_requirement_idx
  on public.documents (claim_requirement_id);
