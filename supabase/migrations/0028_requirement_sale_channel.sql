-- Sale channel on requirement template items.
--
-- Pacific Cross requires exactly ONE proof-of-sale document, chosen by how the
-- sale happened (Eman, 2026-08-18 — stated for FlexiShield and for Select/Blue
-- Royale alike):
--
--   * Agent's Attestation   -- if face-to-face selling
--   * Advisor's Declaration -- if remote selling
--
-- They are alternatives, not a pair. The app treated them as a pair: the
-- attestation was emitted unconditionally and the advisor rows were *appended*
-- on remote sales, so a remote client was asked to sign a form the carrier does
-- not want. See `TO-BE-UPDATE-PLAN.md` Phase G, item G2.
--
-- The snapshot needs to know which template item belongs to which channel.
-- Matching on `document_name` would break silently the first time anyone edits
-- a template, so record it declaratively instead.
--
-- Null means "applies to both channels" — the correct default for every
-- existing row and for anything added later that isn't channel-specific.

alter table public.required_document_items
  add column sale_channel text
    check (sale_channel is null or sale_channel in ('Face-to-face', 'Remote'));

comment on column public.required_document_items.sale_channel is
  'Which sale channel this item applies to: Face-to-face | Remote. Null = both. Drives the mutually-exclusive Agent''s Attestation / Advisor''s Declaration pair.';

-- Tag the two channel-specific rows in the `Standard new-business baseline`
-- template seeded by 0024. Scoped by template name so a product-specific
-- template added later is left alone.

update public.required_document_items i
   set sale_channel = 'Face-to-face'
  from public.required_document_templates t
 where t.id = i.requirement_template_id
   and t.template_name = 'Standard new-business baseline'
   and i.document_name = 'Attestation letter with specimen signatures';

-- Rename rather than insert. 0024's seed is idempotent on `document_name`, so
-- inserting the new name would leave the old row sitting beside it.
--
-- `Remote-selling confirmation` is dropped from the wording: Eman describes a
-- single document -- "proof that an online or phone meeting with the client was
-- conducted" -- so the confirmation was a duplicate of the declaration itself.
--
-- `is_required` becomes true because it now means "required *when this channel
-- applies*"; the snapshot drops the row entirely on the other channel.

update public.required_document_items i
   set document_name = 'Advisor''s Declaration',
       applies_to    = 'Remote or online sale',
       is_required   = true,
       sale_channel  = 'Remote'
  from public.required_document_templates t
 where t.id = i.requirement_template_id
   and t.template_name = 'Standard new-business baseline'
   and i.document_name = 'Advisor declaration / remote-selling confirmation';

-- Existing `application_requirements` rows are immutable snapshots and keep
-- their original wording by design; nothing is backfilled here. Verified before
-- writing this migration: no application with remote_sale = true has a
-- requirements snapshot, so no live record carries the wrong pair.
