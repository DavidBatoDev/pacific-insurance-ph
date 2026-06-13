-- 0009 seed — initial configurable data. Idempotent only on a fresh database.
-- Uses subqueries to resolve foreign keys (no hardcoded generated IDs).

-- Products
insert into public.products (name, category, description) values
  ('Select',           'Primary Medical',      'Pacific Cross Select health plan'),
  ('Blue Royale',      'Primary Medical',      'Pacific Cross Blue Royale premium health plan'),
  ('BC Flexi',         'Primary Medical',      'Pacific Cross BC Flexi flexible health plan'),
  ('FlexiShield',      'Second-Layer Medical', 'Second-layer cover on top of an existing HMO'),
  ('Travel Insurance', 'Travel Insurance',     'Pacific Cross travel insurance');

-- Product versions (2026 cycle)
insert into public.product_versions (product_id, version_name, effective_date, status)
select id, name || ' 2026', date '2026-01-01', 'Active' from public.products;

-- Plan options
insert into public.plan_options (product_version_id, plan_name, plan_family, coverage_tier, maximum_coverage)
select pv.id, x.plan_name, x.plan_family, x.coverage_tier, x.maximum_coverage
from public.product_versions pv
join public.products p on p.id = pv.product_id
cross join lateral (values
  ('Select',           'Select Plus Ward',          'Select',      'Ward',     2000000),
  ('Select',           'Select Plus Private 5M',    'Select',      'Private',  5000000),
  ('Select',           'Select Standard Private 2M','Select',      'Private',  2000000),
  ('Blue Royale',      'Blue Royale Plan A',        'Blue Royale', 'A',       10000000),
  ('Blue Royale',      'Blue Royale Plan B',        'Blue Royale', 'B',        7000000),
  ('Blue Royale',      'Blue Royale Plan C',        'Blue Royale', 'C',        5000000),
  ('BC Flexi',         'BC Flexi Standard',         'BC Flexi',    'Standard', 3000000),
  ('FlexiShield',      'FlexiShield 150',           'FlexiShield', '150',      1000000),
  ('FlexiShield',      'FlexiShield 200',           'FlexiShield', '200',      1500000),
  ('Travel Insurance', 'Travel Standard',           'Travel',      'Standard', 1000000),
  ('Travel Insurance', 'Travel Premium',            'Travel',      'Premium',  3000000)
) as x(product_name, plan_name, plan_family, coverage_tier, maximum_coverage)
where x.product_name = p.name;

update public.plan_options set deductible_range = 'PHP150,000 to PHP199,000' where plan_name = 'FlexiShield 150';
update public.plan_options set deductible_range = 'PHP200,000 and up'       where plan_name = 'FlexiShield 200';

-- Workflow templates (all 8; steps seeded for the V1 set)
insert into public.workflow_templates (name, description, product_category) values
  ('New Business Standard', 'Standard new business application (Select/Blue Royale, ages 0-70)', 'Primary Medical'),
  ('New Business Medical',  'New business requiring medical underwriting',                       'Primary Medical'),
  ('Senior Application',    'Applicant age 71-100; full medical exam',                           'Primary Medical'),
  ('Renewal Standard',      'Standard policy renewal',                                           'Primary Medical'),
  ('Renewal Amendment',     'Renewal with policy changes',                                       'Primary Medical'),
  ('Reinstatement',         'Restore an expired or lapsed policy',                               'Primary Medical'),
  ('Claims Assistance',     'Claim coordination with Pacific Cross',                             'Primary Medical'),
  ('Travel Insurance',      'Travel insurance fulfillment',                                      'Travel Insurance');

insert into public.workflow_steps (workflow_template_id, step_name, step_order)
select t.id, s.step_name, s.ord
from public.workflow_templates t
cross join unnest(array[
  'Lead','Discovery','Product Recommendation','Application Package Sent','Requirements Received',
  'Internal Review','Submitted to Pacific Cross','Under Review','Illustrative Proposal',
  'Awaiting Payment','Payment Confirmed','Policy Processing','Policy Issued','Active Client'
]) with ordinality as s(step_name, ord)
where t.name = 'New Business Standard';

insert into public.workflow_steps (workflow_template_id, step_name, step_order)
select t.id, s.step_name, s.ord
from public.workflow_templates t
cross join unnest(array[
  'Renewal Upcoming','Renewal Notice Received','Renewal Review','Renewal Sent to Client',
  'Awaiting Client Decision','Awaiting Payment','Payment Received','Payment Confirmed',
  'Renewal Processing','Renewed','Relationship Follow-Up'
]) with ordinality as s(step_name, ord)
where t.name = 'Renewal Standard';

insert into public.workflow_steps (workflow_template_id, step_name, step_order)
select t.id, s.step_name, s.ord
from public.workflow_templates t
cross join unnest(array[
  'Claim Inquiry','Claim Assessment','Requirements Sent','Requirements Received','Internal Review',
  'Submitted to Pacific Cross','Claim Review','Compliance Required','Additional Documents Submitted',
  'Claim Decision Received','Client Notified','Claim Closed'
]) with ordinality as s(step_name, ord)
where t.name = 'Claims Assistance';

insert into public.workflow_steps (workflow_template_id, step_name, step_order)
select t.id, s.step_name, s.ord
from public.workflow_templates t
cross join unnest(array[
  'Travel Request Created','Travel Details Collected','Eligibility Validated','Quote Confirmed',
  'Payment Request Sent','Awaiting Payment','Payment Verified','Payment Acknowledged',
  'Portal Purchase Pending','Portal Purchase Completed','Policy Delivered','Closed'
]) with ordinality as s(step_name, ord)
where t.name = 'Travel Insurance';

-- Email templates
insert into public.email_templates (template_name, subject, body, workflow_template_id)
select 'Send Application Package', 'Your Pacific Cross application package',
       'Hi {{client_first_name}}, please find attached your application package and the list of requirements.',
       id from public.workflow_templates where name = 'New Business Standard';
insert into public.email_templates (template_name, subject, body) values
  ('Payment Request',   'Payment request - {{reference_no}}', 'Hi {{client_first_name}}, your payment request {{reference_no}} for {{amount}} is ready.'),
  ('Policy Issued',     'Your policy is issued - {{policy_number}}', 'Hi {{client_first_name}}, your policy {{policy_number}} has been issued. Documents are attached.'),
  ('Renewal Reminder',  'Renewal reminder - {{policy_number}}', 'Hi {{client_first_name}}, your policy {{policy_number}} is due for renewal on {{renewal_due_date}}.');

-- Message templates (WhatsApp via Evolution)
insert into public.message_templates (template_name, channel, body) values
  ('Payment Request (WhatsApp)',  'WhatsApp', 'Hi {{client_first_name}}, your payment request {{reference_no}} for {{amount}} is ready. Reply here if you have questions.'),
  ('Renewal Reminder (WhatsApp)', 'WhatsApp', 'Hi {{client_first_name}}, your policy {{policy_number}} is up for renewal on {{renewal_due_date}}.'),
  ('Travel Policy Delivered (WhatsApp)', 'WhatsApp', 'Hi {{client_first_name}}, your travel policy {{policy_number}} for {{destination}} has been issued.');

-- External (Pacific Cross) contacts
insert into public.external_contacts (name, organization, role, contact_type, email, status) values
  ('Pacific Cross TSM',    'Pacific Cross', 'Territory Sales Manager', 'Pacific Cross Territory Sales Manager', 'tsm@pacificcross.example',    'Active'),
  ('Pacific Cross Claims', 'Pacific Cross', 'Claims Officer',          'Claims Contact',                       'claims@pacificcross.example', 'Active');

-- Relationship event types
insert into public.relationship_event_types (event_name, description, trigger_type, default_timing, default_action) values
  ('Birthday',                'Client birthday greeting',          'Birthday',         'On birthday',     'Email'),
  ('Welcome Client',          'Welcome on first policy issued',    'Policy Issued',    'On first policy', 'Email'),
  ('Policy Anniversary',      'Annual policy anniversary',         'Anniversary',      'On anniversary',  'Email'),
  ('Renewal Thank You',       'Thank client after renewal',        'Renewal Completed','After renewal',   'Email'),
  ('Referral Thank You',      'Thank client for a referral',       'Manual',           'On referral',     'Card'),
  ('Claim Approval Follow-Up','Follow up after claim approval',     'Claim Closed',     'After claim',     'Call');
