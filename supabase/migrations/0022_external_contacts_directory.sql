alter table public.external_contacts
  add column if not exists last_verified_date date;

update public.external_contacts
set status = 'Inactive', end_date = coalesce(end_date, current_date),
    notes = concat_ws(E'\n', notes, 'Replaced by the verified Pacific Cross directory supplied by Eman on 2026-08-01.')
where organization = 'Pacific Cross' and email in ('tsm@pacificcross.example', 'claims@pacificcross.example');

insert into public.external_contacts
  (name, organization, role, contact_type, department, email, status, effective_date, last_verified_date, notes)
values
  ('Glynne Cortes','Pacific Cross','Territory Sales Manager','Pacific Cross Territory Sales Manager','New Business','glynne.cortes@pacificcross.com.ph','Active','2026-08-01','2026-08-01','Supplied by Eman.'),
  ('Edzen Almario','Pacific Cross','New Business Officer','Other','New Business','edzen_almario@pacificcross.com.ph','Active','2026-08-01','2026-08-01','Supplied by Eman.'),
  ('PC Sales Support','Pacific Cross','Sales Support Mailbox','Other','New Business','newbiz@pacificcross.com.ph','Active','2026-08-01','2026-08-01','Supplied by Eman.'),
  ('Luzon Support','Pacific Cross','Sales Support Mailbox','Other','New Business','luzon.support@pacificcross.com.ph','Active','2026-08-01','2026-08-01','Supplied by Eman.'),
  ('Thea Opura','Pacific Cross','Renewal Contact','Other','Renewal','thea.opura@pacificcross.com.ph','Active','2026-08-01','2026-08-01','Supplied by Eman.'),
  ('Joanna Salting','Pacific Cross','Renewal Contact','Other','Renewal','joanna_salting@pacificcross.com.ph','Active','2026-08-01','2026-08-01','Supplied by Eman.'),
  ('Medical Sales Renewal Telemarketer','Pacific Cross','Renewal Telemarketer','Other','Renewal','renewal_telemarketer@pacificcross.com.ph','Active','2026-08-01','2026-08-01','Supplied by Eman.'),
  ('Client Services','Pacific Cross','Client Services Mailbox','Other','Customer Service','client_services@pacificcross.com.ph','Active','2026-08-01','2026-08-01','Supplied by Eman.'),
  ('Claims Document Management','Pacific Cross','Claims Document Management','Claims Contact','Claims','claims@pacificcross.com.ph','Active','2026-08-01','2026-08-01','Supplied by Eman.'),
  ('Maria Nina Felizardo','Pacific Cross','Claims/Customer Service Officer','Claims Contact','Claims and Customer Service','marianina_javier@pacificcross.com.ph','Active','2026-08-01','2026-08-01','Supplied by Eman.'),
  ('Nepthale Llagas Jr.','Pacific Cross','Claims/Customer Service Officer','Claims Contact','Claims and Customer Service','nepthale_llagas@pacificcross.com.ph','Active','2026-08-01','2026-08-01','Supplied by Eman.'),
  ('Rose Anne Llaga','Pacific Cross','Commission Contact','Commission Contact','Commission','roseanne.llaga@pacificcross.com','Inactive',null,null,'Do not use until current role and email are verified with Pacific Cross.')
on conflict do nothing;
