-- Phase 3 (additive only). Nothing here updates, deletes or backfills an existing row.
--  1. "Entered on behalf of": a new nullable column on the tables people enter money into. Old rows stay empty.
--  2. A note for a duplicate that was saved anyway: a new nullable column on expenses.
--  3. Trip date rule: an entry on a trip must fall inside the trip's dates (an ongoing trip: from its start to today).
--     It is a trigger that checks NEW and EDITED entries only (insert, or an update that changes the date or the trip).
--     Existing rows are never checked or changed.

alter table expenses add column if not exists on_behalf_of uuid references profiles(id);
alter table expenses add column if not exists duplicate_reason text;
alter table vendor_bills add column if not exists on_behalf_of uuid references profiles(id);
alter table vendor_bill_payments add column if not exists on_behalf_of uuid references profiles(id);
alter table vendor_advances add column if not exists on_behalf_of uuid references profiles(id);
alter table invoices add column if not exists on_behalf_of uuid references profiles(id);
alter table invoice_payments add column if not exists on_behalf_of uuid references profiles(id);
alter table loans add column if not exists on_behalf_of uuid references profiles(id);
alter table loan_payments add column if not exists on_behalf_of uuid references profiles(id);
alter table capital_transactions add column if not exists on_behalf_of uuid references profiles(id);
alter table transfers add column if not exists on_behalf_of uuid references profiles(id);
alter table other_receipts add column if not exists on_behalf_of uuid references profiles(id);

create index if not exists expenses_on_behalf_of_idx on expenses (on_behalf_of) where on_behalf_of is not null;

create or replace function check_trip_entry_date() returns trigger
language plpgsql
as $$
declare
  t record;
begin
  if new.trip_id is null then
    return new;
  end if;
  -- An edit that touches neither the date nor the trip is not re-checked, so old entries can still be edited.
  if tg_op = 'UPDATE' and new.date is not distinct from old.date and new.trip_id is not distinct from old.trip_id then
    return new;
  end if;
  select start_date, end_date into t from trips where id = new.trip_id;
  if not found then
    return new;
  end if;
  if new.date < t.start_date then
    raise exception 'The date % is before the trip started on %.', new.date, t.start_date using errcode = 'check_violation';
  end if;
  if t.end_date is not null and new.date > t.end_date then
    raise exception 'The date % is after the trip ended on %.', new.date, t.end_date using errcode = 'check_violation';
  end if;
  if t.end_date is null and new.date > current_date then
    raise exception 'The date % is in the future. An ongoing trip takes entries up to today.', new.date using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_trip_entry_date on expenses;
create trigger trg_check_trip_entry_date
  before insert or update of date, trip_id on expenses
  for each row execute function check_trip_entry_date();
