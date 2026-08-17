-- Proposal decision sub-state.
--
-- `proposal_status` ends at `Decision`, which records that an answer arrived but
-- never which one — "waiting on them" and "they're haggling" were identical.
-- `../../docs/web/data-model.md:75` already specced this column as
-- `null · Awaiting Decision · Negotiating`; it was simply never built.
--
-- `Declined` is a deliberate addition beyond that list (see
-- docs/development-alignment.md): a client who explicitly says no had nowhere to
-- go, because `Unresponsive` means *no reply* and `Lost` is only reachable
-- through it.

alter table public.clients
  add column proposal_decision text
    check (proposal_decision is null
           or proposal_decision in ('Awaiting Decision', 'Negotiating', 'Declined'));

-- Backstop, not the enforcement: setProposalStatusAction clears the sub-state
-- whenever the status leaves `Decision`, so this should never fire. It exists so
-- a future writer can't strand a decision on a proposal that moved on.
alter table public.clients
  add constraint clients_proposal_decision_scope
    check (proposal_decision is null or proposal_status = 'Decision');

comment on column public.clients.proposal_decision is
  'Sub-state of proposal_status = Decision: Awaiting Decision | Negotiating | Declined. Null at every other proposal step.';
