-- Rolled-back test of supabase/pending/20261109000000_phase5_activity_feed_duplicates.sql. Run as: the migration file, then this block, in one request.
do $test$
declare
  admin_id uuid; stranger uuid := gen_random_uuid();
  r text := ''; n bigint; n2 bigint; expected bigint; pair record; k1 text; k2 text; x uuid;
begin
  select id into admin_id from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  set local role authenticated;

  -- 1. one row per record, in every module
  select count(*) into n from activity_feed(null, null, null, false);
  select (select count(*) from expenses) + (select count(*) from expense_reimbursements) + (select count(*) from vendor_bills) + (select count(*) from vendor_bill_payments)
       + (select count(*) from vendor_advances) + (select count(*) from invoices) + (select count(*) from invoice_payments) + (select count(*) from invoice_notes)
       + (select count(*) from transfers) + (select count(*) from loans) + (select count(*) from loan_payments) + (select count(*) from capital_transactions)
       + (select count(*) from other_receipts) + (select count(*) from wage_payments) + (select count(*) from wage_accruals) + (select count(*) from staff_imprest_transactions)
       + (select count(*) from staff_salary_advances) + (select count(*) from trips) + (select count(*) from account_openings) into expected;
  r := r || case when n = expected then format('1:ok(%s) ', n) else format('1:FAIL(%s vs %s) ', n, expected) end;

  -- 2. for a person, it holds everything the older function returned
  select entered_by into x from activity_feed(null, null, null, false) group by entered_by order by count(*) desc limit 1;
  select count(*) into n from activity_feed(x, null, null, false);
  select count(*) into n2 from activity_by_user(x, null, null, false);
  r := r || case when n >= n2 and n2 > 0 then format('2:ok(%s>=%s) ', n, n2) else format('2:FAIL(%s vs %s) ', n, n2) end;

  -- 3. newest entered first
  select count(*) into n from (select recorded_at, lag(recorded_at) over (order by ordinality) prev from activity_feed(null, null, null, false) with ordinality) t where prev < recorded_at;
  r := r || case when n = 0 then '3:ok ' else '3:FAIL ' end;

  -- 4. a checked tick shows up
  insert into record_reviews (table_name, record_id) select 'expenses', source_id from activity_feed(null, null, null, false) where source_table = 'expenses' limit 1;
  select count(*) into n from activity_feed(null, null, null, false) where checked_at is not null;
  r := r || case when n = 1 then '4:ok ' else '4:FAIL ' end;

  -- 5. possible duplicates run, and a dismissal flags a pair
  select count(*) into n from possible_duplicates();
  r := r || format('5a:ok(%s pairs) ', n);
  select a_table || ':' || a_id as ka, b_table || ':' || b_id as kb into pair from possible_duplicates() limit 1;
  if pair.ka is not null then
    insert into duplicate_dismissals (key_a, key_b) values (pair.ka, pair.kb);
    select count(*) into n from possible_duplicates() where dismissed;
    r := r || case when n = 1 then '5b:ok ' else '5b:FAIL ' end;
  else
    r := r || '5b:skipped(no pairs) ';
  end if;

  -- 6. someone outside the back office gets nothing
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', stranger::text, true);
  set local role authenticated;
  select count(*) into n from activity_feed(null, null, null, false);
  select count(*) into n2 from possible_duplicates();
  r := r || case when n = 0 and n2 = 0 then '6:ok' else '6:FAIL' end;
  reset role;

  raise exception '% %', case when r like '%FAIL%' then 'FAIL' else 'PASS' end, r;
end $test$;
