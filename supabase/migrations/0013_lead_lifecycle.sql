-- Lead Lifecycle two-axis model (web/data-model.md, web/lead-workflow.md §3-4).
-- One contact record per person: Leads are clients rows at lifecycle_stage='Lead'.

alter table public.clients
  add column if not exists lifecycle_stage text not null default 'Lead'
    check (lifecycle_stage in ('Lead','Applicant','Client','Policyholder','Renewal','Lost')),
  add column if not exists lead_stage text
    check (lead_stage in ('New Lead','Contacted','Discovery','Proposal','Product Selected',
                          'Application Started','Converted','Lost')),
  add column if not exists lead_status text
    check (lead_status in ('New','Attempted','Connected','Qualified','Nurturing','Unresponsive')),
  add column if not exists proposal_status text
    check (proposal_status in ('Requested','Received','Sent','Decision')),
  add column if not exists product_interest text,
  add column if not exists est_premium numeric,
  add column if not exists expected_close_date date,
  add column if not exists next_follow_up_date date,
  add column if not exists early_payer boolean not null default false,
  add column if not exists do_not_contact boolean not null default false;

-- Backfill: existing non-prospect records are Clients; prospects become Leads
-- at the top of the board.
update public.clients
  set lifecycle_stage = case when client_type = 'Prospect' then 'Lead' else 'Client' end
  where lifecycle_stage = 'Lead' and lead_stage is null;
update public.clients
  set lead_stage = 'New Lead', lead_status = 'New'
  where lifecycle_stage = 'Lead' and lead_stage is null;

create index if not exists idx_clients_lifecycle on public.clients (lifecycle_stage);
create index if not exists idx_clients_lead_stage on public.clients (lead_stage)
  where lifecycle_stage = 'Lead';

-- Demo leads (from the design prototype's seed board) so the Lead Lifecycle
-- screens render meaningfully. Idempotent by email.
insert into public.clients
  (first_name, last_name, email, mobile_number, client_type, lifecycle_stage,
   lead_stage, lead_status, proposal_status, product_interest, est_premium,
   expected_close_date, next_follow_up_date, lead_source)
select * from (values
  ('John','Santos','john.santos@lead.demo','+63 917 100 0501','Prospect','Lead','New Lead','New', null,'Blue Royale', 185000::numeric, (current_date + 75), (current_date + 1),'Website'),
  ('Anna','Cruz','anna.cruz@lead.demo','+63 917 100 0502','Prospect','Lead','New Lead','New', null,'Select', 92000::numeric, (current_date + 80), current_date,'Referral'),
  ('Kevin','Lao','kevin.lao@lead.demo','+63 917 100 0503','Prospect','Lead','New Lead','Attempted', null,'Travel Insurance', 18000::numeric, (current_date + 85), (current_date + 2),'Social media'),
  ('Maria','Cruz','maria.cruz@lead.demo','+63 917 100 0504','Prospect','Lead','Contacted','Attempted', null,'Blue Royale', 156000::numeric, (current_date + 50), (current_date - 1),'Referral'),
  ('Tonio','Reyes','tonio.reyes@lead.demo','+63 917 100 0505','Prospect','Lead','Contacted','Connected', null,'Family Shield', 132000::numeric, (current_date + 45), (current_date + 1),'Personal network'),
  ('Rita','Gonzales','rita.gonzales@lead.demo','+63 917 100 0517','Prospect','Lead','Contacted','Unresponsive', null,'Select', 64000::numeric, (current_date + 55), (current_date - 5),'Website'),
  ('Robert','Lim','robert.lim@lead.demo','+63 917 100 0507','Prospect','Lead','Discovery','Connected', null,'Premier Health', 240000::numeric, (current_date + 40), (current_date + 1),'Referral'),
  ('Carla','Mendez','carla.mendez@lead.demo','+63 917 100 0508','Prospect','Lead','Discovery','Qualified','Requested','Blue Royale', 168000::numeric, (current_date + 35), current_date,'Business network'),
  ('Daniel','Yu','daniel.yu@lead.demo','+63 917 100 0510','Prospect','Lead','Proposal','Connected','Sent','Premier Health', 265000::numeric, (current_date + 20), (current_date - 2),'Referral'),
  ('Grace','Tan','grace.tan@lead.demo','+63 917 100 0511','Prospect','Lead','Proposal','Connected','Received','Blue Royale', 198000::numeric, (current_date + 18), (current_date + 1),'Referral'),
  ('Marco','Cua','marco.cua@lead.demo','+63 917 100 0512','Prospect','Lead','Proposal','Nurturing','Sent','Select', 110000::numeric, (current_date + 25), current_date,'Website'),
  ('Patricia','Lim','patricia.lim@lead.demo','+63 917 100 0513','Prospect','Lead','Product Selected','Qualified', null,'Blue Royale', 185000::numeric, (current_date + 10), (current_date + 1),'Existing client'),
  ('Allan','Ong','allan.ong@lead.demo','+63 917 100 0514','Prospect','Lead','Product Selected','Connected', null,'Family Shield', 148000::numeric, (current_date + 12), (current_date + 2),'Referral'),
  ('Bianca','Sy','bianca.sy@lead.demo','+63 917 100 0515','Prospect','Lead','Application Started','Qualified', null,'Premier Health', 220000::numeric, (current_date + 5), current_date,'Referral'),
  ('Noel','Dela Paz','noel.delapaz@lead.demo','+63 917 100 0516','Prospect','Lead','Application Started','Qualified', null,'Blue Royale', 175000::numeric, (current_date + 7), (current_date + 1),'Business network')
) as v(first_name, last_name, email, mobile_number, client_type, lifecycle_stage,
       lead_stage, lead_status, proposal_status, product_interest, est_premium,
       expected_close_date, next_follow_up_date, lead_source)
where not exists (select 1 from public.clients c where c.email = v.email);
