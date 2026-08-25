-- 0037 carrier rate catalog — source-dated, published rates only.
--
-- The original 0009 catalog was illustrative. Preserve it for referenced historical records,
-- but deactivate it so it cannot be selected for new business. This migration deliberately does
-- not calculate semi-annual instalments or proposal prices: only brochure-published values are
-- represented below.

alter table public.products
  add column source_key text,
  add column quote_only boolean not null default false;
create unique index products_source_key_key on public.products (source_key) where source_key is not null;

alter table public.product_versions
  add column source_key text,
  add column source_document text,
  add column source_confirmed_current_date date;
create unique index product_versions_source_key_key on public.product_versions (source_key) where source_key is not null;

alter table public.plan_options add column source_key text;
create unique index plan_options_source_key_key on public.plan_options (source_key) where source_key is not null;

alter table public.add_ons add column source_key text;
create unique index add_ons_source_key_key on public.add_ons (source_key) where source_key is not null;

alter table public.discount_rules
  add column source_key text,
  add column source_notes text;
create unique index discount_rules_source_key_key on public.discount_rules (source_key) where source_key is not null;

alter table public.premium_tables
  add column source_key text,
  add column add_on_id uuid references public.add_ons (id) on delete cascade,
  add column age_min smallint,
  add column age_max smallint,
  add column trip_type text check (trip_type in ('Single Trip','Multi-Trip')),
  add column travel_days_max smallint,
  add column insured_type text check (insured_type in ('Individual','Family')),
  add column rate_basis text not null default 'Per Year'
    check (rate_basis in ('Per Year','Per Trip','Per Coverage Unit')),
  add column coverage_amount numeric,
  add column coverage_unit numeric,
  add column source_document text,
  add column source_page text,
  add column source_effective_date date,
  add column source_confirmed_current_date date,
  add column source_notes text,
  add constraint premium_tables_nonnegative_age check (
    (age_min is null or age_min >= 0) and
    (age_max is null or age_max >= 0) and
    (age_min is null or age_max is null or age_min <= age_max)
  ),
  add constraint premium_tables_positive_rate check (base_premium is null or base_premium >= 0),
  add constraint premium_tables_positive_days check (travel_days_max is null or travel_days_max > 0);
create unique index premium_tables_source_key_key on public.premium_tables (source_key) where source_key is not null;
create index premium_tables_add_on_id_idx on public.premium_tables (add_on_id);

-- Preserve every referenced illustrative row, but retire it from new-business selectors.
update public.product_versions set status = 'Inactive' where source_key is null;
update public.plan_options set status = 'Inactive' where source_key is null;
update public.products set status = 'Inactive' where name = 'Travel Insurance' and source_key is null;

-- Production may no longer contain the illustrative 0009 seed rows. Reuse a matching product
-- when it exists, but create the canonical carrier product when it does not.
insert into public.products (name, category, provider, status)
select seed.name, seed.category, 'Pacific Cross', 'Active'
from (values
  ('Select', 'Primary Medical'),
  ('Blue Royale', 'Primary Medical'),
  ('FlexiShield', 'Second-Layer Medical'),
  ('BC Flexi', 'Group Medical'),
  ('TravelSafe', 'Travel Insurance')
) seed(name, category)
where not exists (select 1 from public.products p where p.name = seed.name);

update public.products
set category = 'Primary Medical', description = 'Pacific Cross Select medical insurance',
    source_key = 'pacific-cross-select', quote_only = false, status = 'Active'
where id = (select id from public.products where name = 'Select' order by created_at limit 1);
update public.products
set category = 'Primary Medical', description = 'Pacific Cross Blue Royale worldwide medical dollar plan',
    source_key = 'pacific-cross-blue-royale', quote_only = false, status = 'Active'
where id = (select id from public.products where name = 'Blue Royale' order by created_at limit 1);
update public.products
set category = 'Second-Layer Medical', description = 'Pacific Cross second-layer cover above a first-layer HMO',
    source_key = 'pacific-cross-flexishield', quote_only = false, status = 'Active'
where id = (select id from public.products where name = 'FlexiShield' order by created_at limit 1);
update public.products
set category = 'Group Medical', description = 'Pacific Cross group HMO; premiums supplied by carrier quote',
    source_key = 'pacific-cross-bc-flexi', quote_only = true, status = 'Active'
where id = (select id from public.products where name = 'BC Flexi' order by created_at limit 1);
update public.products
set category = 'Travel Insurance', provider = 'Pacific Cross',
    description = 'Pacific Cross TravelSafe single-trip and multi-trip travel insurance',
    source_key = 'pacific-cross-travelsafe', quote_only = false, status = 'Active'
where id = (select id from public.products where name = 'TravelSafe' order by created_at limit 1);

insert into public.product_versions
  (product_id, version_name, effective_date, status, notes, source_key, source_document, source_confirmed_current_date)
values
  ((select id from public.products where source_key = 'pacific-cross-select'),
   'Rates effective 1 November 2025', date '2025-11-01', 'Active',
   'Annual brochure premiums only. Published metadata: DST is PHP150 for Ward and PHP200 for all other plans; semi-annual mode carries an 8% surcharge and DST, but instalment amounts are not published and are not catalogued.',
   'select-2025-11-01', 'Select Brochure 2025.pdf', null),
  ((select id from public.products where source_key = 'pacific-cross-blue-royale'),
   'Rates effective 1 November 2025', date '2025-11-01', 'Active',
   'Annual brochure premiums only. Published metadata: DST is USD4; semi-annual mode carries an 8% surcharge and DST, but instalment amounts are not published and are not catalogued.',
   'blue-royale-2025-11-01', 'Blue Royale Brochure 2025.pdf', null),
  ((select id from public.products where source_key = 'pacific-cross-flexishield'),
   'Rates effective 1 April 2024', date '2024-04-01', 'Active',
   'Published annual premiums; subject to underwriting assessment.',
   'flexishield-2024-04-01', 'FlexiShiled Brochure.pdf', null),
  ((select id from public.products where source_key = 'pacific-cross-travelsafe'),
   'Rates effective 15 October 2023', date '2023-10-15', 'Active',
   'Published premiums for issue ages 0–75; current edition confirmed by Eman on 24 August 2026.',
   'travelsafe-2023-10-15', 'Travel Brochure 2024.pdf', date '2026-08-24'),
  ((select id from public.products where source_key = 'pacific-cross-bc-flexi'),
   'Quote-only — confirmed 24 August 2026', null, 'Active',
   'Group Medical product. No published rate table; obtain a carrier quote.',
   'bc-flexi-quote-only-2026-08-24', null, date '2026-08-24');

insert into public.plan_options
  (product_version_id, plan_name, plan_family, coverage_tier, coverage_currency,
   maximum_coverage, coverage_description, deductible_range, source_key)
values
  ((select id from public.product_versions where source_key='select-2025-11-01'),'Select Plus Ward','Select Plus','Ward','PHP',1000000,'Core benefits with Travel+','Ward','select-plus-ward'),
  ((select id from public.product_versions where source_key='select-2025-11-01'),'Select Plus Semi-Private','Select Plus','Semi-Private','PHP',1500000,'Core benefits with Travel+','Semi-Private','select-plus-semi-private'),
  ((select id from public.product_versions where source_key='select-2025-11-01'),'Select Plus Private 2M','Select Plus','Private 2M','PHP',2000000,'Core benefits with Travel+','Private','select-plus-private-2m'),
  ((select id from public.product_versions where source_key='select-2025-11-01'),'Select Plus Private 3M','Select Plus','Private 3M','PHP',3000000,'Core benefits with Travel+','Private','select-plus-private-3m'),
  ((select id from public.product_versions where source_key='select-2025-11-01'),'Select Plus Private 5M','Select Plus','Private 5M','PHP',5000000,'Core benefits with Travel+','Private','select-plus-private-5m'),
  ((select id from public.product_versions where source_key='select-2025-11-01'),'Select Standard Ward','Select Standard','Ward','PHP',1000000,'Core benefits with Travel+','Ward','select-standard-ward'),
  ((select id from public.product_versions where source_key='select-2025-11-01'),'Select Standard Semi-Private','Select Standard','Semi-Private','PHP',1500000,'Core benefits with Travel+','Semi-Private','select-standard-semi-private'),
  ((select id from public.product_versions where source_key='select-2025-11-01'),'Select Standard Private 2M','Select Standard','Private 2M','PHP',2000000,'Core benefits with Travel+','Private','select-standard-private-2m'),
  ((select id from public.product_versions where source_key='blue-royale-2025-11-01'),'Blue Royale Plan A','Blue Royale','Plan A','USD',500000,'Core benefits with Travel+',null,'blue-royale-plan-a'),
  ((select id from public.product_versions where source_key='blue-royale-2025-11-01'),'Blue Royale Plan B','Blue Royale','Plan B','USD',1000000,'Core benefits with Travel+',null,'blue-royale-plan-b'),
  ((select id from public.product_versions where source_key='blue-royale-2025-11-01'),'Blue Royale Plan C','Blue Royale','Plan C','USD',2000000,'Core benefits with Travel+; Dental and Vision included',null,'blue-royale-plan-c'),
  ((select id from public.product_versions where source_key='flexishield-2024-04-01'),'FlexiShield 150','FlexiShield','150','PHP',2000000,'Maximum benefit per disability per year','PHP150,000 to PHP199,000','flexishield-150'),
  ((select id from public.product_versions where source_key='flexishield-2024-04-01'),'FlexiShield 200','FlexiShield','200','PHP',2000000,'Maximum benefit per disability per year','PHP200,000 and up','flexishield-200'),
  ((select id from public.product_versions where source_key='travelsafe-2023-10-15'),'Worldwide Elite Dollar','Worldwide Elite','Dollar','USD',50000,'Including Schengen','Worldwide','travelsafe-worldwide-dollar'),
  ((select id from public.product_versions where source_key='travelsafe-2023-10-15'),'Worldwide Elite Euro 45K','Worldwide Elite','Euro 45K','EUR',45000,'Including Schengen; single-trip only','Worldwide','travelsafe-worldwide-euro-45'),
  ((select id from public.product_versions where source_key='travelsafe-2023-10-15'),'Worldwide Elite Euro 60K','Worldwide Elite','Euro 60K','EUR',60000,'Including Schengen; single-trip only','Worldwide','travelsafe-worldwide-euro-60'),
  ((select id from public.product_versions where source_key='travelsafe-2023-10-15'),'Asia and Oceania Dollar','Asia and Oceania','Dollar','USD',50000,'Asia and Oceania','Asia and Oceania','travelsafe-asia-dollar'),
  ((select id from public.product_versions where source_key='travelsafe-2023-10-15'),'Asia and Oceania Peso','Asia and Oceania','Peso','PHP',1500000,'Asia and Oceania','Asia and Oceania','travelsafe-asia-peso'),
  ((select id from public.product_versions where source_key='travelsafe-2023-10-15'),'Domestic Gold','Domestic','Gold','PHP',2500000,'Domestic medical limit','Domestic','travelsafe-domestic-gold'),
  ((select id from public.product_versions where source_key='travelsafe-2023-10-15'),'Domestic Silver','Domestic','Silver','PHP',1500000,'Domestic medical limit','Domestic','travelsafe-domestic-silver'),
  ((select id from public.product_versions where source_key='travelsafe-2023-10-15'),'Domestic Bronze','Domestic','Bronze','PHP',500000,'Domestic medical limit; single-trip only','Domestic','travelsafe-domestic-bronze');

insert into public.add_ons
  (product_version_id, name, description, eligibility_rule, premium_rule, source_key)
values
  ((select id from public.product_versions where source_key='select-2025-11-01'),'Out-Patient Standard','Reimbursement outpatient benefit; PHP25,000 annual limit','Available through age 80','Age-banded annual premium','select-addon-outpatient-standard'),
  ((select id from public.product_versions where source_key='select-2025-11-01'),'Out-Patient Executive','Reimbursement outpatient benefit; PHP50,000 annual limit','Available through age 80','Age-banded annual premium','select-addon-outpatient-executive'),
  ((select id from public.product_versions where source_key='select-2025-11-01'),'Dental','80% reimbursement; published annual limits apply','Available through age 100','Annual premium varies by child/adult and individual/group','select-addon-dental'),
  ((select id from public.product_versions where source_key='select-2025-11-01'),'Additional Personal Accident','Death, dismemberment, total and permanent disablement; Occupational Class I','New business age 16–60; renewable through age 65','Fixed annual premium by published sum assured','select-addon-pa'),
  ((select id from public.product_versions where source_key='blue-royale-2025-11-01'),'Personal Accident','Optional death, dismemberment, total and permanent disablement coverage','New policyholder age 16–60; renewable through age 65; Class 1 occupation','USD1.32 per USD1,000 coverage; USD100,000–500,000','blue-addon-pa'),
  ((select id from public.product_versions where source_key='blue-royale-2025-11-01'),'Dental','80% reimbursement; published annual limits apply','Optional for Plans A and B; included in Plan C','Annual premium by age band','blue-addon-dental'),
  ((select id from public.product_versions where source_key='blue-royale-2025-11-01'),'Vision','80% reimbursement; USD700 annual limit','Plan B groups of 21 or more, all members opt in; included in Plan C','USD165 annual premium','blue-addon-vision');

insert into public.discount_rules
  (product_version_id, plan_option_id, name, discount_type, discount_value,
   eligibility_rule, applies_to, source_key, source_notes)
values
  ((select id from public.product_versions where source_key='select-2025-11-01'),null,'80/20 Co-Payment','Percent',25,'Available for Semi-Private and Private plans','Core Benefits only','select-discount-copay-25','Pacific Cross pays 80% of claimed amount.'),
  ((select id from public.product_versions where source_key='select-2025-11-01'),null,'Group Discount — 7 to 15','Percent',5,'7–15 insured persons; new business only; one policy','Medical Core Benefits and optional Out-Patient Benefits','select-discount-group-7-15','Published group tier.'),
  ((select id from public.product_versions where source_key='select-2025-11-01'),null,'Group Discount — 16 or more','Percent',10,'16 or more insured persons; new business only; one policy','Medical Core Benefits and optional Out-Patient Benefits','select-discount-group-16-plus','Published group tier.');

insert into public.discount_rules
  (product_version_id, plan_option_id, name, discount_type, discount_value,
   eligibility_rule, applies_to, source_key, source_notes)
select (select id from public.product_versions where source_key='blue-royale-2025-11-01'), po.id,
       d.name, 'Percent', d.value, d.eligibility, 'Core Benefits only', d.source_key,
       case when d.name = 'Treatment Area Limitation'
         then 'Not applicable to optional benefits. Excludes treatment in Canada; USA, its dependent territories and the Caribbean Islands; Japan; People''s Republic of China; Hong Kong; and Singapore.'
         else 'Not applicable to optional benefits. Deductible is per annum and applies to all In-Patient Benefits; in-patient Organ Transplant, Mental and Nervous Disorder, Congenital Conditions and HIV/AIDS; and Plan A Major Out-Patient Care available as 90-day post-hospitalization follow-up.'
       end
from (values
  ('blue-royale-plan-a','USD1,000 Deductible',15::numeric,'Plan A','blue-discount-a-deductible-1000'),
  ('blue-royale-plan-a','USD2,500 Deductible',30::numeric,'Plan A','blue-discount-a-deductible-2500'),
  ('blue-royale-plan-b','USD2,500 Deductible',18::numeric,'Plan B','blue-discount-b-deductible-2500'),
  ('blue-royale-plan-c','USD2,500 Deductible',18::numeric,'Plan C','blue-discount-c-deductible-2500'),
  ('blue-royale-plan-a','USD5,000 Deductible',40::numeric,'Plan A','blue-discount-a-deductible-5000'),
  ('blue-royale-plan-b','USD5,000 Deductible',24::numeric,'Plan B','blue-discount-b-deductible-5000'),
  ('blue-royale-plan-c','USD5,000 Deductible',24::numeric,'Plan C','blue-discount-c-deductible-5000'),
  ('blue-royale-plan-a','Treatment Area Limitation',25::numeric,'Plan A','blue-discount-a-tal'),
  ('blue-royale-plan-b','Treatment Area Limitation',25::numeric,'Plan B','blue-discount-b-tal'),
  ('blue-royale-plan-c','Treatment Area Limitation',25::numeric,'Plan C','blue-discount-c-tal')
) d(plan_key,name,value,eligibility,source_key)
join public.plan_options po on po.source_key=d.plan_key;

-- Core annual medical rates. Each array is copied from the corresponding brochure column.
with ages(age_band,age_min,age_max,ord) as (values
 ('0-3',0,3,1),('4-10',4,10,2),('11-20',11,20,3),('21-25',21,25,4),('26-30',26,30,5),
 ('31-35',31,35,6),('36-40',36,40,7),('41-45',41,45,8),('46-50',46,50,9),('51-55',51,55,10),
 ('56-60',56,60,11),('61-65',61,65,12),('66',66,66,13),('67',67,67,14),('68',68,68,15),
 ('69',69,69,16),('70',70,70,17),('71',71,71,18),('72',72,72,19),('73',73,73,20),
 ('74',74,74,21),('75',75,75,22),('76-80',76,80,23),('81-85',81,85,24),('86-100',86,100,25)
), columns(plan_key,rates) as (values
 ('select-plus-ward',array[11789,11316,10844,11416,12446,13133,14277,16566,20000,22289,29156,36309,54192,59370,64635,69900,75164,82604,90043,97482,104921,112361,119228,130673,152189]::numeric[]),
 ('select-plus-semi-private',array[14680,14086,13492,18182,19750,20535,22102,25895,29129,32436,42508,52999,79228,86823,94545,102266,109988,120899,131810,142720,153631,164542,174614,191400,222958]::numeric[]),
 ('select-plus-private-2m',array[21428,20550,19673,30720,33716,35391,38127,43837,52427,59371,76843,95918,143606,157416,171455,185494,199533,219371,239209,259047,278885,298723,317035,347555,404933]::numeric[]),
 ('select-plus-private-3m',array[22681,21750,20820,32530,35706,37483,40383,46434,55540,62901,81421,101641,152189,166828,181710,196591,211473,232502,253530,274558,295586,316615,336025,368377,429196]::numeric[]),
 ('select-plus-private-5m',array[24143,23151,22160,34643,38028,39923,43014,49464,59172,67019,86762,108317,162204,177810,193674,209537,225402,247819,270236,292653,315070,337487,358180,392667,457504]::numeric[]),
 ('select-standard-ward',array[11253,10803,10353,10898,11879,12533,13623,15803,19073,21253,27793,34606,51637,56569,61583,66597,71611,78696,85781,92866,99951,107036,113576,124476,144968]::numeric[]),
 ('select-standard-semi-private',array[13395,12855,12315,15040,16413,17329,18855,21907,26485,29537,38693,48231,72074,78979,85999,93019,100038,109957,119876,129795,139714,149633,158789,174049,202738]::numeric[]),
 ('select-standard-private-2m',array[17251,16549,15847,24684,27081,28422,30611,35178,42050,46933,61583,76843,114993,126041,137273,148504,159735,175606,191476,207347,223217,239087,253737,278153,324055]::numeric[])
), expanded as (
 select c.plan_key,a.age_band,a.age_min,a.age_max,c.rates[a.ord] amount
 from columns c cross join ages a
)
insert into public.premium_tables
 (product_version_id,plan_option_id,age_band,age_min,age_max,currency,base_premium,payment_mode,
  effective_date,rate_basis,source_key,source_document,source_page,source_effective_date,source_notes)
select (select id from public.product_versions where source_key='select-2025-11-01'),po.id,e.age_band,e.age_min,e.age_max,
       'PHP',e.amount,'Annual',date '2025-11-01','Per Year','select-rate-'||e.plan_key||'-'||e.age_min||'-'||e.age_max,
       'Select Brochure 2025.pdf',case when e.plan_key like 'select-plus%' then '12' else '13' end,date '2025-11-01',
       'Published annual premium; inclusive of applicable taxes.'
from expanded e join public.plan_options po on po.source_key=e.plan_key;

with ages(age_band,age_min,age_max,ord) as (values
 ('0-3',0,3,1),('4-18',4,18,2),('19-25',19,25,3),('26-30',26,30,4),('31-35',31,35,5),
 ('36-40',36,40,6),('41-45',41,45,7),('46-50',46,50,8),('51-55',51,55,9),('56-60',56,60,10),
 ('61-65',61,65,11),('66',66,66,12),('67',67,67,13),('68',68,68,14),('69',69,69,15),
 ('70',70,70,16),('71',71,71,17),('72',72,72,18),('73',73,73,19),('74',74,74,20),
 ('75',75,75,21),('76-80',76,80,22),('81-85',81,85,23),('86-90',86,90,24),('91-95',91,95,25),('96-100',96,100,26)
), columns(plan_key,rates) as (values
 ('blue-royale-plan-a',array[1712,1789,1822,2005,2154,2358,2831,3023,3435,3652,3941,4173,4399,4627,4856,5084,5289,5781,6213,6519,6829,8522,11635,14629,20601,28755]::numeric[]),
 ('blue-royale-plan-b',array[2055,2176,2936,3681,4036,4425,4767,5106,5344,5836,6757,9329,10039,10668,11308,11957,12910,14118,15178,15934,16690,20792,28016,35457,49542,61543]::numeric[]),
 ('blue-royale-plan-c',array[2568,3166,3642,4608,4936,5238,5454,5732,5955,6483,7529,10310,11056,11717,12388,13070,14071,15339,16452,17245,18040,22347,29932,37745,52534,65136]::numeric[])
), expanded as (
 select c.plan_key,a.age_band,a.age_min,a.age_max,c.rates[a.ord] amount from columns c cross join ages a
)
insert into public.premium_tables
 (product_version_id,plan_option_id,age_band,age_min,age_max,currency,base_premium,payment_mode,effective_date,
  rate_basis,source_key,source_document,source_page,source_effective_date,source_notes)
select (select id from public.product_versions where source_key='blue-royale-2025-11-01'),po.id,e.age_band,e.age_min,e.age_max,
       'USD',e.amount,'Annual',date '2025-11-01','Per Year','blue-rate-'||e.plan_key||'-'||e.age_min||'-'||e.age_max,
       'Blue Royale Brochure 2025.pdf','10',date '2025-11-01','Published annual premium; inclusive of applicable taxes.'
from expanded e join public.plan_options po on po.source_key=e.plan_key;

with ages(age_band,age_min,age_max,ord) as (values
 ('0-20',0,20,1),('21-35',21,35,2),('36-45',36,45,3),('46-55',46,55,4),
 ('56-65',56,65,5),('66-70',66,70,6),('71-75',71,75,7)
), columns(plan_key,rates) as (values
 ('flexishield-150',array[8019,10517,15131,22702,35549,44442,53330]::numeric[]),
 ('flexishield-200',array[7291,8400,11693,17685,27093,33891,40669]::numeric[])
), expanded as (
 select c.plan_key,a.age_band,a.age_min,a.age_max,c.rates[a.ord] amount from columns c cross join ages a
)
insert into public.premium_tables
 (product_version_id,plan_option_id,age_band,age_min,age_max,currency,base_premium,payment_mode,effective_date,
  rate_basis,source_key,source_document,source_page,source_effective_date,source_notes)
select (select id from public.product_versions where source_key='flexishield-2024-04-01'),po.id,e.age_band,e.age_min,e.age_max,
       'PHP',e.amount,'Annual',date '2024-04-01','Per Year','flexi-rate-'||e.plan_key||'-'||e.age_min||'-'||e.age_max,
       'FlexiShiled Brochure.pdf','7',date '2024-04-01','Published annual premium; inclusive of applicable taxes; subject to underwriting.'
from expanded e join public.plan_options po on po.source_key=e.plan_key;

-- Published add-on premium rows.
insert into public.premium_tables
 (product_version_id,add_on_id,age_band,age_min,age_max,currency,base_premium,payment_mode,effective_date,
  rate_basis,coverage_amount,coverage_unit,insured_type,source_key,source_document,source_page,source_effective_date,source_notes)
select pv.id,ao.id,x.age_band,x.age_min,x.age_max,x.currency,x.amount,'Annual',pv.effective_date,x.rate_basis,
       x.coverage_amount,x.coverage_unit,x.insured_type,x.source_key,pv.source_document,x.source_page,pv.effective_date,x.notes
from (values
 ('select-addon-outpatient-standard','Child-20',0,20,'PHP',5962::numeric,'Per Year',25000::numeric,null::numeric,null,'select-addon-op-standard-0-20','14','80% reimbursement'),
 ('select-addon-outpatient-standard','21-40',21,40,'PHP',5600,'Per Year',25000,null,null,'select-addon-op-standard-21-40','14','80% reimbursement'),
 ('select-addon-outpatient-standard','41-50',41,50,'PHP',8137,'Per Year',25000,null,null,'select-addon-op-standard-41-50','14','80% reimbursement'),
 ('select-addon-outpatient-standard','51-65',51,65,'PHP',10164,'Per Year',25000,null,null,'select-addon-op-standard-51-65','14','80% reimbursement'),
 ('select-addon-outpatient-standard','66-70',66,70,'PHP',16160,'Per Year',25000,null,null,'select-addon-op-standard-66-70','14','50% reimbursement'),
 ('select-addon-outpatient-standard','71-75',71,75,'PHP',16512,'Per Year',25000,null,null,'select-addon-op-standard-71-75','14','50% reimbursement'),
 ('select-addon-outpatient-standard','76-80',76,80,'PHP',18284,'Per Year',25000,null,null,'select-addon-op-standard-76-80','14','50% reimbursement'),
 ('select-addon-outpatient-executive','Child-20',0,20,'PHP',12308,'Per Year',50000,null,null,'select-addon-op-executive-0-20','14','80% reimbursement'),
 ('select-addon-outpatient-executive','21-40',21,40,'PHP',11900,'Per Year',50000,null,null,'select-addon-op-executive-21-40','14','80% reimbursement'),
 ('select-addon-outpatient-executive','41-50',41,50,'PHP',18964,'Per Year',50000,null,null,'select-addon-op-executive-41-50','14','80% reimbursement'),
 ('select-addon-outpatient-executive','51-65',51,65,'PHP',24693,'Per Year',50000,null,null,'select-addon-op-executive-51-65','14','80% reimbursement'),
 ('select-addon-outpatient-executive','66-70',66,70,'PHP',20463,'Per Year',50000,null,null,'select-addon-op-executive-66-70','14','50% reimbursement'),
 ('select-addon-outpatient-executive','71-75',71,75,'PHP',21128,'Per Year',50000,null,null,'select-addon-op-executive-71-75','14','50% reimbursement'),
 ('select-addon-outpatient-executive','76-80',76,80,'PHP',23555,'Per Year',50000,null,null,'select-addon-op-executive-76-80','14','50% reimbursement'),
 ('select-addon-dental','Child',0,18,'PHP',2770,'Per Year',10000,null,'Individual','select-addon-dental-child-individual','14','Individual/family under 4/group under 4'),
 ('select-addon-dental','Child',0,18,'PHP',1623,'Per Year',10000,null,'Family','select-addon-dental-child-group','14','Group/family with at least 4'),
 ('select-addon-dental','Adult',19,100,'PHP',3808,'Per Year',10000,null,'Individual','select-addon-dental-adult-individual','14','Individual/family under 4/group under 4'),
 ('select-addon-dental','Adult',19,100,'PHP',2232,'Per Year',10000,null,'Family','select-addon-dental-adult-group','14','Group/family with at least 4'),
 ('select-addon-pa','16-60',16,60,'PHP',835,'Per Year',500000,null,null,'select-addon-pa-500k','14','Occupational Class I; new business'),
 ('select-addon-pa','16-60',16,60,'PHP',1670,'Per Year',1000000,null,null,'select-addon-pa-1m','14','Occupational Class I; new business'),
 ('blue-addon-pa','16-60',16,60,'USD',1.32,'Per Coverage Unit',null,1000,null,'blue-addon-pa-per-1000','9','Coverage range USD100,000–500,000; Class 1 occupation'),
 ('blue-addon-dental','0-3',0,3,'USD',310,'Per Year',1000,null,null,'blue-addon-dental-0-3','11','Optional for Plans A and B'),
 ('blue-addon-dental','4-100',4,100,'USD',634,'Per Year',1000,null,null,'blue-addon-dental-4-100','11','Optional for Plans A and B'),
 ('blue-addon-vision','0-100',0,100,'USD',165,'Per Year',700,null,null,'blue-addon-vision-0-100','11','Plan B groups of 21 or more; all opt in')
) x(addon_key,age_band,age_min,age_max,currency,amount,rate_basis,coverage_amount,coverage_unit,insured_type,source_key,source_page,notes)
join public.add_ons ao on ao.source_key=x.addon_key
join public.product_versions pv on pv.id=ao.product_version_id;

-- TravelSafe single-trip table: 12 duration bands × 8 plan columns × Individual/Family.
with days(age_band,days_max,ord) as (values
 ('Up to 4 Days',4,1),('Up to 7 Days',7,2),('Up to 10 Days',10,3),('Up to 15 Days',15,4),
 ('Up to 24 Days',24,5),('Up to 31 Days',31,6),('Up to 45 Days',45,7),('Up to 60 Days',60,8),
 ('Up to 90 Days',90,9),('Up to 120 Days',120,10),('Up to 150 Days',150,11),('Up to 180 Days',180,12)
), columns(plan_key,insured_type,currency,rates) as (values
 ('travelsafe-worldwide-dollar','Individual','USD',array[29,44,53,56,67,78,100,123,146,169,192,215]::numeric[]),
 ('travelsafe-worldwide-dollar','Family','USD',array[66,104,125,133,160,190,244,302,359,416,473,530]::numeric[]),
 ('travelsafe-worldwide-euro-45','Individual','EUR',array[23,34,40,43,52,60,77,93,112,132,151,170]::numeric[]),
 ('travelsafe-worldwide-euro-45','Family','EUR',array[53,79,96,101,124,145,188,228,276,324,373,421]::numeric[]),
 ('travelsafe-worldwide-euro-60','Individual','EUR',array[24,35,42,44,53,62,80,96,116,136,155,175]::numeric[]),
 ('travelsafe-worldwide-euro-60','Family','EUR',array[54,82,99,105,128,150,195,236,285,334,383,432]::numeric[]),
 ('travelsafe-asia-dollar','Individual','USD',array[26,41,49,51,61,72,92,111,126,142,157,171]::numeric[]),
 ('travelsafe-asia-dollar','Family','USD',array[59,98,117,122,148,173,223,272,310,348,386,421]::numeric[]),
 ('travelsafe-asia-peso','Individual','PHP',array[542,852,1009,1108,1301,1482,1858,2246,2668,3090,3512,3897]::numeric[]),
 ('travelsafe-asia-peso','Family','PHP',array[1054,1830,2223,2470,2952,3405,4346,5315,6370,7424,8479,9443]::numeric[]),
 ('travelsafe-domestic-gold','Individual','PHP',array[687,1084,1298,1436,1971,2316,3048,3728,4214,4700,5186,5673]::numeric[]),
 ('travelsafe-domestic-gold','Family','PHP',array[1418,2410,2946,3290,4626,5489,7319,9019,10235,11450,12666,13882]::numeric[]),
 ('travelsafe-domestic-silver','Individual','PHP',array[509,775,914,1001,1172,1331,1676,2020,2426,2833,3239,3646]::numeric[]),
 ('travelsafe-domestic-silver','Family','PHP',array[974,1639,1985,2202,2631,3028,3889,4750,5766,6782,7798,8814]::numeric[]),
 ('travelsafe-domestic-bronze','Individual','PHP',array[260,436,532,599,764,929,1251,1578,1780,1982,2184,2386]::numeric[]),
 ('travelsafe-domestic-bronze','Family','PHP',array[575,1015,1255,1423,1835,2247,3053,3871,4376,4881,5386,5890]::numeric[])
), expanded as (
 select c.plan_key,c.insured_type,c.currency,d.age_band,d.days_max,c.rates[d.ord] amount from columns c cross join days d
)
insert into public.premium_tables
 (product_version_id,plan_option_id,age_band,age_min,age_max,currency,base_premium,trip_type,travel_days_max,
  insured_type,rate_basis,source_key,source_document,source_page,source_effective_date,source_confirmed_current_date,source_notes)
select (select id from public.product_versions where source_key='travelsafe-2023-10-15'),po.id,e.age_band,0,75,e.currency,e.amount,
       'Single Trip',e.days_max,e.insured_type,'Per Trip',
       'travel-single-'||e.plan_key||'-'||lower(e.insured_type)||'-'||e.days_max,
       'Travel Brochure 2024.pdf','14–15',date '2023-10-15',date '2026-08-24','Published premiums are for issue ages 0–75.'
from expanded e join public.plan_options po on po.source_key=e.plan_key;

insert into public.premium_tables
 (product_version_id,plan_option_id,age_band,age_min,age_max,currency,base_premium,payment_mode,trip_type,
  travel_days_max,insured_type,rate_basis,source_key,source_document,source_page,source_effective_date,
  source_confirmed_current_date,source_notes)
select (select id from public.product_versions where source_key='travelsafe-2023-10-15'),po.id,'0-75',0,75,x.currency,x.amount,
       'Annual','Multi-Trip',90,'Individual','Per Year',x.source_key,'Travel Brochure 2024.pdf','14–15',date '2023-10-15',
       date '2026-08-24','Unlimited trips per year; maximum 90 days per trip; published individual premium.'
from (values
 ('travelsafe-worldwide-dollar','USD',296::numeric,'travel-multi-worldwide-dollar'),
 ('travelsafe-asia-dollar','USD',267::numeric,'travel-multi-asia-dollar'),
 ('travelsafe-asia-peso','PHP',7557::numeric,'travel-multi-asia-peso'),
 ('travelsafe-domestic-gold','PHP',7935::numeric,'travel-multi-domestic-gold'),
 ('travelsafe-domestic-silver','PHP',6729::numeric,'travel-multi-domestic-silver')
) x(plan_key,currency,amount,source_key)
join public.plan_options po on po.source_key=x.plan_key;

-- Operational control totals make brochure transcription drift visible without a proposal calculator.
create view public.carrier_catalog_control_totals
with (security_invoker = true) as
select p.name as product_name, pv.version_name, pv.source_key as version_source_key,
       coalesce(po.plan_count,0) as plan_count,
       coalesce(ao.add_on_count,0) as add_on_count,
       coalesce(dr.discount_count,0) as discount_count,
       coalesce(pt.rate_count,0) as rate_count,
       coalesce(pt.currency_count,0) as currency_count,
       coalesce(pt.published_rate_sums_by_currency,'{}'::jsonb) as published_rate_sums_by_currency
from public.product_versions pv
join public.products p on p.id=pv.product_id
left join (
  select product_version_id,count(*) plan_count from public.plan_options
  where source_key is not null group by product_version_id
) po on po.product_version_id=pv.id
left join (
  select product_version_id,count(*) add_on_count from public.add_ons
  where source_key is not null group by product_version_id
) ao on ao.product_version_id=pv.id
left join (
  select product_version_id,count(*) discount_count from public.discount_rules
  where source_key is not null group by product_version_id
) dr on dr.product_version_id=pv.id
left join (
  select product_version_id,sum(rate_count) rate_count,count(*) currency_count,
         jsonb_object_agg(currency,published_rate_sum order by currency) published_rate_sums_by_currency
  from (
    select product_version_id,coalesce(currency,'UNSPECIFIED') currency,
           count(*) rate_count,sum(base_premium) published_rate_sum
    from public.premium_tables where source_key is not null
    group by product_version_id,coalesce(currency,'UNSPECIFIED')
  ) currency_totals
  group by product_version_id
) pt on pt.product_version_id=pv.id
where pv.source_key is not null;

do $$
declare actual jsonb;
begin
  select jsonb_object_agg(version_source_key,rate_count)
  into actual
  from (
    select pv.source_key version_source_key,count(pt.id) rate_count
    from public.product_versions pv
    left join public.premium_tables pt on pt.product_version_id=pv.id and pt.source_key is not null
    where pv.source_key in ('select-2025-11-01','blue-royale-2025-11-01','flexishield-2024-04-01','travelsafe-2023-10-15','bc-flexi-quote-only-2026-08-24')
    group by pv.source_key
  ) totals;
  if actual <> '{"select-2025-11-01":220,"blue-royale-2025-11-01":82,"flexishield-2024-04-01":14,"travelsafe-2023-10-15":197,"bc-flexi-quote-only-2026-08-24":0}'::jsonb then
    raise exception 'carrier catalog control totals failed: %',actual;
  end if;
end $$;
