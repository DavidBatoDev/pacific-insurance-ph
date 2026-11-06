-- Cover the complete scope FK keys introduced by 0062, not only their first column.
create index commissions_voucher_document_scope_idx
  on public.commissions(voucher_document_id, id, client_id)
  where voucher_document_id is not null;
create index documents_commission_client_idx
  on public.documents(commission_id, client_id)
  where commission_id is not null;
drop index public.documents_commission_id_idx;
