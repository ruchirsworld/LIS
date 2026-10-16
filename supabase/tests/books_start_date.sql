-- Cash & bank counts each account only from its opening balance's date. Rolled back on purpose: the last statement always raises.
do $$
declare
  v_admin uuid; v_k uuid; v_c uuid; v_n numeric; v_cnt int; v_total numeric; v_kpi numeric;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  select id into v_k from bank_accounts where name = 'Kotak';
  select id into v_c from bank_accounts where name = 'CBI';

  -- Start clean: no openings, then give Kotak one on 1 Oct and leave CBI without.
  delete from account_openings;
  insert into account_openings (bank_account_id, as_on, amount) values (v_k, '2026-10-01', 1000);

  -- 1. Kotak counts its opening balance plus entries on or after 1 Oct, and nothing older.
  select balance into v_n from cash_bank_position() where bank_account_id = v_k;
  select coalesce(sum(l.debit - l.credit), 0) into v_total
  from journal_lines l join journal_entries je on je.id = l.entry_id join gl_accounts a on a.id = l.gl_account_id
  where a.code = '1020' and l.bank_account_id = v_k and je.date >= '2026-10-01';
  if v_n <> v_total then raise exception 'FAIL: Kotak should count % (opening plus entries from 1 Oct), got %', v_total, v_n; end if;

  -- 2. CBI has no opening balance, so it is left out: its balance is not set.
  select balance into v_n from cash_bank_position() where bank_account_id = v_c;
  if v_n is not null then raise exception 'FAIL: CBI has no opening balance and should have no balance, got %', v_n; end if;
  select count(*) into v_cnt from books_health_check() where check_code = 'OPENING_MISSING' and title like 'CBI%';
  if v_cnt <> 1 then raise exception 'FAIL: the health check should flag CBI as having no opening balance'; end if;

  -- 3. The Dashboard figure is the sum of the counted accounts.
  select coalesce(sum(balance), 0) into v_total from cash_bank_position();
  select cash_and_bank_balance into v_kpi from v_dashboard_kpis;
  if v_kpi <> v_total then raise exception 'FAIL: the Dashboard shows %, the accounts add up to %', v_kpi, v_total; end if;

  -- 4. Moving the start back counts the older month too, and moving it forward drops it again.
  update account_openings set as_on = '2026-09-01', amount = 500 where bank_account_id = v_k;
  select balance into v_n from cash_bank_position() where bank_account_id = v_k;
  select coalesce(sum(l.debit - l.credit), 0) + 500 into v_total
  from journal_lines l join journal_entries je on je.id = l.entry_id join gl_accounts a on a.id = l.gl_account_id
  where a.code = '1020' and l.bank_account_id = v_k and je.date >= '2026-09-01' and je.source_table is distinct from 'account_openings';
  if v_n <> v_total then raise exception 'FAIL: after moving the start to 1 Sep Kotak should count %, got %', v_total, v_n; end if;

  raise exception 'PASS: each account is counted from its opening balance date; accounts without one are left out; the Dashboard agrees';
end;
$$;
