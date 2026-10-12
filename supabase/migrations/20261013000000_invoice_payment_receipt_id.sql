-- One money receipt from a client can be split across several invoices (one
-- invoice_payments row each). receipt_id ties those rows back together so the
-- app can show them as the single receipt they are. Null = a stand-alone payment.
alter table invoice_payments add column if not exists receipt_id uuid;
create index if not exists invoice_payments_receipt_id_idx on invoice_payments (receipt_id) where receipt_id is not null;

-- MKC's Rs 20,00,000 receipt of 23 Apr 2026, recorded as six payments (Pay/52 to Pay/57).
with g as (select gen_random_uuid() as id)
update invoice_payments p
set receipt_id = g.id
from g
where p.display_id in ('Pay/52', 'Pay/53', 'Pay/54', 'Pay/55', 'Pay/56', 'Pay/57')
  and p.date = '2026-04-23'
  and p.receipt_id is null;
