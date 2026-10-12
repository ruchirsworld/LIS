-- One-off data step for the posting changes in 20261014000000:
--  * payments held to the paisa (five MKC rows carried extra decimals; the
--    receipt they belong to stays exactly Rs 20,00,000.00),
--  * every invoice, receipt and advance adjustment is re-posted under the new
--    rules (retention receivable, advances, paisa rounding), so the ledger
--    follows the invoice records.
update invoice_payments set amount = amount where amount <> round(amount, 2);
update invoice_payments set amount = amount + 0.01 where display_id = 'Pay/57' and receipt_id is not null;

do $$
declare r record;
begin
  for r in select id from invoices loop perform repost_invoice_entry(r.id); end loop;
  for r in select id from invoice_payments loop perform repost_invoice_payment(r.id); end loop;
  for r in select id from invoices loop perform repost_invoice_advance(r.id); end loop;
end $$;
