-- Demo operations data (design data.jsx seeds) so the wired Applications /
-- Policies / Renewals / Claims / Travel screens render meaningfully.
-- Idempotent: clients keyed by @client.demo email; child rows keyed by notes tag.

-- Demo clients (lifecycle Client)
insert into public.clients
  (first_name, last_name, email, mobile_number, client_type, lifecycle_stage, status)
select * from (values
  ('Ramon','Velasco','ramon.velasco@client.demo','+63 917 200 0001','Individual Client','Client','Active'),
  ('Sofia','Reyes','sofia.reyes@client.demo','+63 917 200 0002','Family Client','Client','Active'),
  ('Miguel','Torres','miguel.torres@client.demo','+63 917 200 0003','Individual Client','Client','Active'),
  ('Grace','Castillo','grace.castillo@client.demo','+63 917 200 0004','Individual Client','Client','Active'),
  ('Cristina','Flores','cristina.flores@client.demo','+63 917 200 0005','Individual Client','Client','Active'),
  ('Edgar','Domingo','edgar.domingo@client.demo','+63 917 200 0006','Family Client','Client','Active'),
  ('Liza','Gomez','liza.gomez@client.demo','+63 917 200 0007','Individual Client','Client','Active'),
  ('Renato','Dizon','renato.dizon@client.demo','+63 917 200 0008','Individual Client','Client','Active'),
  ('Teresa','Mendoza','teresa.mendoza@client.demo','+63 917 200 0009','Individual Client','Client','Active'),
  ('Roberto','Pascual','roberto.pascual@client.demo','+63 917 200 0010','Individual Client','Client','Active'),
  ('Katrina','Bautista','katrina.bautista@client.demo','+63 917 200 0011','Individual Client','Client','Active'),
  ('Hannah','Villamor','hannah.villamor@client.demo','+63 917 200 0012','Individual Client','Client','Active'),
  ('Oliver','Chua','oliver.chua@client.demo','+63 917 200 0013','Individual Client','Client','Active'),
  ('Carmela','Tan','carmela.tan@client.demo','+63 917 200 0014','Individual Client','Client','Active')
) as v(first_name,last_name,email,mobile_number,client_type,lifecycle_stage,status)
where not exists (select 1 from public.clients c where c.email = v.email);

-- Helper: resolve a demo client id by email
create or replace function pg_temp.demo_client(p_email text) returns uuid as
$$ select id from public.clients where email = p_email $$ language sql;
create or replace function pg_temp.pv(p_product text) returns uuid as
$$ select pv.id from public.product_versions pv join public.products p on p.id = pv.product_id where p.name = p_product limit 1 $$ language sql;

-- Policies
insert into public.policies (client_id, product_version_id, policy_number, status, effective_date, expiry_date, renewal_date, premium_amount, payment_mode, notes)
select * from (values
  (pg_temp.demo_client('ramon.velasco@client.demo'),  pg_temp.pv('Blue Royale'), 'PC-118820', 'Active',  date '2024-03-01', current_date + 260, current_date + 230, 185000::numeric, 'Annual', 'seed:pol-1'),
  (pg_temp.demo_client('sofia.reyes@client.demo'),    pg_temp.pv('Select'),      'PC-044170', 'Active',  date '2022-01-15', current_date + 190, current_date + 160, 148000::numeric, 'Annual', 'seed:pol-2'),
  (pg_temp.demo_client('cristina.flores@client.demo'),pg_temp.pv('BC Flexi'),    'PC-077120', 'Active',  date '2024-06-01', current_date + 320, current_date + 290, 110000::numeric, 'Annual', 'seed:pol-3'),
  (pg_temp.demo_client('grace.castillo@client.demo'), pg_temp.pv('Select'),      'PC-033900', 'Active',  date '2021-11-01', current_date + 12,  current_date - 1,  73000::numeric,  'Annual', 'seed:pol-4'),
  (pg_temp.demo_client('edgar.domingo@client.demo'),  pg_temp.pv('Blue Royale'), 'PC-088560', 'Active',  date '2023-02-10', current_date + 21,  current_date + 18, 132000::numeric, 'Semi-Annual', 'seed:pol-5'),
  (pg_temp.demo_client('miguel.torres@client.demo'),  pg_temp.pv('FlexiShield'), 'PC-011830', 'Active',  date '2022-06-20', current_date + 45,  current_date + 22, 95000::numeric,  'Annual', 'seed:pol-6')
) as v(client_id, product_version_id, policy_number, status, effective_date, expiry_date, renewal_date, premium_amount, payment_mode, notes)
where not exists (select 1 from public.policies p where p.notes = v.notes);

-- Applications
insert into public.applications (client_id, product_version_id, application_type, status, assigned_user_id, date_started, notes)
select v.client_id, v.pv, v.application_type, v.status, null, v.date_started, v.notes from (values
  (pg_temp.demo_client('liza.gomez@client.demo'),    pg_temp.pv('Select'),      'Standard',           'Awaiting Payment',     current_date - 9,  'seed:app-1'),
  (pg_temp.demo_client('renato.dizon@client.demo'),  pg_temp.pv('Blue Royale'), 'Medical Evaluation', 'Under Review',         current_date - 14, 'seed:app-2'),
  (pg_temp.demo_client('carmela.tan@client.demo'),   pg_temp.pv('Select'),      'Standard',           'Under Review',         current_date - 6,  'seed:app-3'),
  (pg_temp.demo_client('roberto.pascual@client.demo'),pg_temp.pv('Blue Royale'),'Standard',           'Missing Requirements', current_date - 20, 'seed:app-4'),
  (pg_temp.demo_client('oliver.chua@client.demo'),   pg_temp.pv('BC Flexi'),    'Standard',           'Awaiting Payment',     current_date - 4,  'seed:app-5'),
  (pg_temp.demo_client('teresa.mendoza@client.demo'),pg_temp.pv('Select'),      'Standard',           'Approved',             current_date - 30, 'seed:app-6')
) as v(client_id, pv, application_type, status, date_started, notes)
where not exists (select 1 from public.applications a where a.notes = v.notes);

-- Renewals (linked to seeded policies)
insert into public.renewals (policy_id, client_id, renewal_notice_date, policy_expiry_date, renewal_due_date, status, notes)
select p.id, p.client_id, current_date - 20, p.expiry_date, p.renewal_date, v.status, v.notes
from (values
  ('seed:pol-4', 'Awaiting Payment', 'seed:ren-1'),
  ('seed:pol-5', 'Reminder Sent',    'seed:ren-2'),
  ('seed:pol-6', 'Upcoming',         'seed:ren-3'),
  ('seed:pol-2', 'Notice Received',  'seed:ren-4'),
  ('seed:pol-3', 'Upcoming',         'seed:ren-5')
) as v(pol_tag, status, notes)
join public.policies p on p.notes = v.pol_tag
where not exists (select 1 from public.renewals r where r.notes = v.notes);

-- Claims
insert into public.claims (client_id, policy_id, claim_type, incident_date, status, amount_claimed, notes)
select v.client_id, p.id, v.claim_type, v.incident_date, v.status, v.amount, v.notes
from (values
  (pg_temp.demo_client('teresa.mendoza@client.demo'), 'seed:pol-4', 'Hospitalization', current_date - 12, 'Documents Pending', 48000::numeric,  'seed:clm-1'),
  (pg_temp.demo_client('roberto.pascual@client.demo'),'seed:pol-1', 'Hospitalization', current_date - 8,  'Pending Review',    120000::numeric, 'seed:clm-2'),
  (pg_temp.demo_client('miguel.torres@client.demo'),  'seed:pol-6', 'Outpatient',      current_date - 5,  'Submitted',         62000::numeric,  'seed:clm-3'),
  (pg_temp.demo_client('cristina.flores@client.demo'),'seed:pol-3', 'Reimbursement',   current_date - 30, 'Approved',          32000::numeric,  'seed:clm-4')
) as v(client_id, pol_tag, claim_type, incident_date, status, amount, notes)
left join public.policies p on p.notes = v.pol_tag
where not exists (select 1 from public.claims c where c.notes = v.notes);

-- Travel requests
insert into public.travel_requests (client_id, product_version_id, destination, departure_date, return_date, traveler_count, status, quoted_premium, notes)
select * from (values
  (pg_temp.demo_client('katrina.bautista@client.demo'), pg_temp.pv('Travel Insurance'), 'Japan',         current_date + 10, current_date + 18, 1, 'Awaiting Payment', 18000::numeric, 'seed:trv-1'),
  (pg_temp.demo_client('hannah.villamor@client.demo'),  pg_temp.pv('Travel Insurance'), 'Singapore',     current_date + 2,  current_date + 6,  1, 'Policy Issued',    9800::numeric,  'seed:trv-2'),
  (pg_temp.demo_client('oliver.chua@client.demo'),      pg_temp.pv('Travel Insurance'), 'United States', current_date + 22, current_date + 38, 2, 'Awaiting Payment', 31000::numeric, 'seed:trv-3'),
  (pg_temp.demo_client('carmela.tan@client.demo'),      pg_temp.pv('Travel Insurance'), 'Australia',     current_date + 15, current_date + 25, 1, 'Under Review',     22000::numeric, 'seed:trv-4')
) as v(client_id, product_version_id, destination, departure_date, return_date, traveler_count, status, quoted_premium, notes)
where not exists (select 1 from public.travel_requests t where t.notes = v.notes);
