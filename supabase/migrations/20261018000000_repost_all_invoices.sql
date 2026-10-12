-- Re-posts every invoice, receipt, advance adjustment and note under the
-- current rules — used after the company GSTIN is entered or changed, so past
-- invoices pick up the CGST / SGST / IGST split. Admin only; refuses to touch
-- anything inside a locked period (the lock trigger raises).
create or replace function repost_all_invoices() returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  r record;
  n integer := 0;
begin
  if current_user_role() is distinct from 'admin'::user_role then
    raise exception 'Only an Admin can re-post the ledger.';
  end if;
  for r in select id from invoices loop
    perform repost_invoice_entry(r.id);
    n := n + 1;
  end loop;
  for r in select id from invoice_payments loop perform repost_invoice_payment(r.id); end loop;
  for r in select id from invoices loop perform repost_invoice_advance(r.id); end loop;
  for r in select id from invoice_notes loop perform repost_invoice_note(r.id); end loop;
  return n;
end;
$$;
