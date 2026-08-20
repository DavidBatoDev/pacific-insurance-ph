-- Corporate Enrollment Template (CET) fields on group members.
--
-- Pacific Cross's CET (`docs/attachments/BC_FLEXI_Requirements/CET*.xlsx`) wants
-- roughly 19 fields per member across its Principal/Dependent/Inclusion/Deletion
-- sheets. `group_members` (0016_group_accounts.sql:31-46) held four usable ones --
-- full_name, relationship, coverage_tier, join_date -- so a submittable CET could
-- not be produced from what the app stores. That is a data-model gap, not an
-- export feature. See TO-BE-UPDATE-PLAN.md Phase G, item G7.
--
-- Every column is nullable: existing member rows predate the CET and must survive.
--
-- Deliberately no CHECK constraints on gender / civil_status / room_and_board_plan.
-- The CET carries a 21-entry legend defining each field's accepted format, and we
-- have not confirmed those value lists against the carrier yet (TO-BE-UPDATE-PLAN.md
-- :1083-1084). Inventing enum values that disagree with the legend would be worse
-- than free text; tighten these once Eman confirms.

alter table public.group_members
  add column last_name              text,
  add column first_name             text,
  add column middle_initial         text,
  add column gender                 text,
  add column civil_status           text,
  add column nationality            text,
  add column birth_date             date,
  add column place_of_birth         text,
  add column effective_date         date,
  add column occupation_grade       text,
  add column room_and_board_plan    text,
  add column maximum_benefit_limit  numeric,
  add column philhealth_member      boolean,
  add column address                text,
  add column email                  text,
  add column mobile_number          text,
  add column landline_number        text,
  add column beneficiary_name       text,
  add column beneficiary_birth_date date;

comment on column public.group_members.effective_date is
  'CET coverage effective date. Distinct from join_date, which records when the member joined the group account.';
comment on column public.group_members.maximum_benefit_limit is
  'CET MBL per member. Same figure the claims workflow reads as claims.hmo_mbl_amount.';
comment on column public.group_members.last_name is
  'CET splits the name into last / first / M.I. full_name is retained as the display name and stays authoritative for existing rows.';
