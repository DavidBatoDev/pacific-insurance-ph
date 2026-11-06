-- H1b: Select remains one product/commission configuration. Only catalog metadata is backfilled.
begin;

alter table public.plan_options
  add column limit_basis text
  check (limit_basis in ('Aggregate, annual reset', 'Per illness, depleting'));

update public.plan_options as plan
set limit_basis = case plan.plan_family
  when 'Select Plus' then 'Aggregate, annual reset'
  when 'Select Standard' then 'Per illness, depleting'
end
from public.product_versions as version
join public.products as product on product.id = version.product_id
where plan.product_version_id = version.id
  and lower(btrim(product.name)) = 'select'
  and plan.plan_family in ('Select Plus', 'Select Standard');

-- IS NOT DISTINCT FROM rejects NULL for these exact families as well as reversed meanings.
alter table public.plan_options add constraint plan_options_select_family_limit_basis_check check (
  case plan_family
    when 'Select Plus' then limit_basis is not distinct from 'Aggregate, annual reset'
    when 'Select Standard' then limit_basis is not distinct from 'Per illness, depleting'
    else true
  end
);

-- An ambiguous historical interest/tier is not evidence of the person's explicit choice.
alter table public.clients add column select_variant text
  check (select_variant in ('Select Plus', 'Select Standard'));

comment on column public.plan_options.limit_basis is
  'Catalog limit semantics; does not change the selected plan maximum_coverage.';
comment on column public.clients.select_variant is
  'Explicit Select discovery preference, independent of room tier. Policy variant derives from its selected plan.';

commit;
