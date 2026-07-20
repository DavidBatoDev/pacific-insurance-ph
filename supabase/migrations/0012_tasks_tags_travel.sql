-- Tasks board sync (design add-task.jsx / new-modals.md §10).
-- Widen task_type to the design's tag taxonomy (keeping the original workflow
-- values for compatibility) and add the Travel linked-record FK.

alter table public.tasks drop constraint if exists tasks_task_type_check;
alter table public.tasks add constraint tasks_task_type_check
  check (task_type in (
    -- design tags (Add Task modal)
    'Application','Documents','Renewal','Travel','Claim','Relationship','Commission','General',
    -- original workflow-era values (kept for compatibility)
    'Follow-Up','Missing Document','Renewal Reminder','Claim Follow-Up',
    'Payment Follow-Up','Commission Follow-Up','Relationship Activity'));

alter table public.tasks
  add column if not exists travel_request_id uuid references public.travel_requests (id) on delete set null;
