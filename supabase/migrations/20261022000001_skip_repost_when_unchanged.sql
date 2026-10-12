-- Re-post an invoice or receipt only when something that reaches the ledger
-- changed. Tracker fields (GSTR-3B dates, GST-held flag, the GST part of a
-- payment) are not accounting, so updating them must not rebuild the entry —
-- which would also be refused for anything inside a locked period.
create or replace function post_invoice() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'UPDATE'
     and (old.amount, old.gst_pct, old.tds_pct, old.retention_pct, old.client_id, old.project_id, old.invoice_number, old.invoice_date, old.status)
         is not distinct from
         (new.amount, new.gst_pct, new.tds_pct, new.retention_pct, new.client_id, new.project_id, new.invoice_number, new.invoice_date, new.status)
  then
    return new;
  end if;
  perform repost_invoice_entry(new.id);
  return new;
end;
$$;

create or replace function post_invoice_payment() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'UPDATE'
     and (old.invoice_id, old.date, old.amount, old.bank_account_id, old.payment_mode, old.is_retention_release)
         is not distinct from
         (new.invoice_id, new.date, new.amount, new.bank_account_id, new.payment_mode, new.is_retention_release)
  then
    return new;
  end if;
  perform repost_invoice_payment(new.id);
  perform repost_invoice_advance(new.invoice_id);
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    perform repost_invoice_advance(old.invoice_id);
  end if;
  return new;
end;
$$;
