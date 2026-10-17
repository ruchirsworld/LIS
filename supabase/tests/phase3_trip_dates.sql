-- Rolled-back test of supabase/pending/20261107000000_phase3_on_behalf_trip_dates.sql.
-- It applies the migration inside a transaction, exercises the trip date trigger on existing rows, and ALWAYS ends with an exception,
-- so nothing is kept. The exception text starts with PASS when every check held, FAIL otherwise.
do $test$
declare
  admin_id uuid;
  e_in record;     -- an existing entry inside its trip's dates
  e_out record;    -- an existing entry already outside its trip's dates (old data the rule must leave alone)
  t_in record;
  t_out record;
  results text := '';
  ok boolean;
  before_rows bigint;
  after_rows bigint;
begin
  select count(*) into before_rows from expenses;

  -- 1. The migration, as written.
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

  -- 2. Existing rows to test with.
  select e.id, e.date, e.description into e_in
    from expenses e join trips t on t.id = e.trip_id
    where t.end_date is not null and e.date between t.start_date and t.end_date limit 1;
  select t.start_date, t.end_date into t_in from expenses e join trips t on t.id = e.trip_id where e.id = e_in.id;
  select e.id, e.date into e_out
    from expenses e join trips t on t.id = e.trip_id
    where e.date < t.start_date limit 1;
  select t.start_date, t.end_date into t_out from expenses e join trips t on t.id = e.trip_id where e.id = e_out.id;

  select id into admin_id from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  set local role authenticated;

  -- a. editing something other than the date on an OLD out-of-range entry must still work
  begin
    update expenses set remarks = coalesce(remarks, '') where id = e_out.id;
    results := results || 'a:ok ';
  exception when others then results := results || 'a:FAIL(' || sqlerrm || ') ';
  end;

  -- b. saving the same date again on that old entry must still work
  begin
    update expenses set date = e_out.date where id = e_out.id;
    results := results || 'b:ok ';
  exception when others then results := results || 'b:FAIL(' || sqlerrm || ') ';
  end;

  -- c. moving an entry to before the trip starts must be refused
  ok := false;
  begin
    update expenses set date = t_in.start_date - 1 where id = e_in.id;
  exception when check_violation then ok := true;
  end;
  results := results || case when ok then 'c:ok ' else 'c:FAIL ' end;

  -- d. moving an entry to after the trip ends must be refused
  ok := false;
  begin
    update expenses set date = t_in.end_date + 1 where id = e_in.id;
  exception when check_violation then ok := true;
  end;
  results := results || case when ok then 'd:ok ' else 'd:FAIL ' end;

  -- e. moving an entry to a date inside the trip must work
  begin
    update expenses set date = t_in.start_date where id = e_in.id;
    results := results || 'e:ok ';
  exception when others then results := results || 'e:FAIL(' || sqlerrm || ') ';
  end;

  -- f. editing the date of the old out-of-range entry to another out-of-range date must be refused (it is an edited entry now)
  ok := false;
  begin
    update expenses set date = t_out.start_date - 5 where id = e_out.id;
  exception when check_violation then ok := true;
  end;
  results := results || case when ok then 'f:ok ' else 'f:FAIL ' end;

  reset role;

  -- g. the new columns exist and every existing row is empty in them; no rows were added or removed
  select count(*) into after_rows from expenses;
  results := results || case when (select count(*) from expenses where on_behalf_of is not null or duplicate_reason is not null) = 0 and before_rows = after_rows then 'g:ok' else 'g:FAIL' end;

  raise exception '% %', case when results like '%FAIL%' then 'FAIL' else 'PASS' end, results;
end;
$test$;
