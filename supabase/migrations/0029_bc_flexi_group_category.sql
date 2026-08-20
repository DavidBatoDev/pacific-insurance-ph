-- BC Flexi is an HMO group product; route it to the group workflow.
--
-- Eman's 2026-08-18 requirement list is explicit that BC Flexi is an HMO group
-- product with a two-phase corporate requirement set (PIS, CET, Franchise Form,
-- Utilization Report for proposal; COR/AOI/GIS/KYC and six signed corporate
-- forms once the group agrees).
--
-- `categoryForProduct()` (components/hub/overlays/wizard/wizard-data.ts) matches
-- `hmo` on a `Group Medical` category or an `hmo`/`group` token in the name.
-- BC Flexi was seeded as `Primary Medical` (0009_seed.sql:8) and its name carries
-- neither token, so it fell through to `health` and generated the INDIVIDUAL
-- checklist. The wizard's whole group branch -- company details, member list,
-- member information sheets -- was unreachable for the only product that needs it.
--
-- Fix the product row rather than widening `categoryForProduct()`: the row is the
-- source of truth, and the function is already correct for FlexiShield's
-- `Second-Layer Medical`. See TO-BE-UPDATE-PLAN.md Phase G, item G1.

update public.products
   set category = 'Group Medical'
 where name = 'BC Flexi'
   and category = 'Primary Medical';
