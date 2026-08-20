-- Smoker status and the BMI inputs, per insured person.
--
-- Pacific Cross's Select/Blue Royale requirement list names three conditional
-- medical panels (Eman, 2026-08-18):
--
--   Smoker         -> Chest X-ray taken within the last 6 months
--   BMI            -> Lipid Profile, HbA1c, Creatinine, BUN, Uric Acid, SGOT, SGPT, GGT
--   Obese Class 1  -> Chest X-ray / ECG / TMST
--
-- None of the inputs those rules key on existed anywhere: a repo-wide search for
-- smoker/bmi/body_mass returned zero hits, and there were no height or weight
-- fields in any form type or migration. The app could only emit one generic
-- "medical questionnaire or supporting records" line off age >= 71 or a
-- pre-existing-conditions answer. See TO-BE-UPDATE-PLAN.md Phase G, item G3.
--
-- UNITS follow the carrier's own application form, which asks for
-- `WEIGHT (lbs.)` and `HEIGHT (ft. & in.)`. Staff transcribe from that form, so
-- storing anything else would make them convert in their heads -- a needless
-- error source. Height is kept as total inches: lossless against the ft+in the
-- form asks for, and directly usable in the BMI formula.
--
-- BMI itself is deliberately NOT stored. It is a pure function of height and
-- weight, so persisting it would create a second source of truth that can fall
-- out of step with its own inputs. It is computed where needed.
--
-- Smoker is three-state because the form's question is "Have you ever been, or
-- are you currently a smoker?". The form's follow-ups (sticks per day, years
-- since quitting) are deliberately not mirrored here -- C7's rule is to keep the
-- carrier's form authoritative rather than re-key every underwriting answer.

alter table public.applications
  add column smoker_status  text check (smoker_status in ('Never', 'Former', 'Current')),
  add column height_inches  numeric check (height_inches > 0 and height_inches < 120),
  add column weight_lbs     numeric check (weight_lbs > 0 and weight_lbs < 1000);

alter table public.application_dependents
  add column smoker_status  text check (smoker_status in ('Never', 'Former', 'Current')),
  add column height_inches  numeric check (height_inches > 0 and height_inches < 120),
  add column weight_lbs     numeric check (weight_lbs > 0 and weight_lbs < 1000);

comment on column public.applications.height_inches is
  'Total inches, from the carrier form''s HEIGHT (ft. & in.). BMI = 703 * weight_lbs / height_inches^2, computed rather than stored.';
comment on column public.applications.smoker_status is
  'Never | Former | Current. Only Current triggers the carrier''s chest X-ray panel; Former is kept because the form asks for it and underwriting may care.';
