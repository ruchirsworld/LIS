-- Opening balances of cash and bank accounts. Rolled back on purpose: the last statement always raises.
do $$
declare
  v_admin uuid; v_bank uuid; v_id uuid; v_id2 uuid; v_n numeric; v_cnt int; v_dr numeric; v_cr numeric; v_before numeric;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;

  select id into v_bank from bank_accounts where name = 'Kotak';
  select coalesce(sum(l.debit - l.credit), 0) into v_before from journal_lines l join gl_accounts g on g.id = l.gl_account_id where g.code = '1020' and l.bank_account_id = v_bank;

  -- 1. An opening balance posts Dr bank / Cr Opening Balance Equity, on its date.
  insert into account_openings (bank_account_id, as_on, amount) values (v_bank, '2026-06-01', 50000) returning id into v_id;
  select coalesce(sum(l.debit), 0) into v_n from journal_lines l join journal_entries je on je.id = l.entry_id join gl_accounts g on g.id = l.gl_account_id
    where je.source_table = 'account_openings' and je.source_id = v_id and g.code = '1020' and l.bank_account_id = v_bank;
  if v_n <> 50000 then raise exception 'FAIL: the bank should be debited 50000, got %', v_n; end if;
  select coalesce(sum(l.credit), 0) into v_n from journal_lines l join journal_entries je on je.id = l.entry_id join gl_accounts g on g.id = l.gl_account_id
    where je.source_table = 'account_openings' and je.source_id = v_id and g.code = '3020';
  if v_n <> 50000 then raise exception 'FAIL: Opening Balance Equity should be credited 50000, got %', v_n; end if;
  select count(*) into v_cnt from journal_entries where source_table = 'account_openings' and source_id = v_id and date = '2026-06-01';
  if v_cnt <> 1 then raise exception 'FAIL: the entry should be dated 1 Jun'; end if;

  -- 2. The account balance rises by it.
  select coalesce(sum(l.debit - l.credit), 0) into v_n from journal_lines l join gl_accounts g on g.id = l.gl_account_id where g.code = '1020' and l.bank_account_id = v_bank;
  if v_n <> v_before + 50000 then raise exception 'FAIL: the balance should rise by 50000'; end if;

  -- 3. Only one opening per account.
  begin
    insert into account_openings (bank_account_id, as_on, amount) values (v_bank, '2026-05-01', 1);
    raise exception 'FAIL: a second opening for one account was accepted';
  exception when unique_violation then null; end;

  -- 4. Changing it re-posts the same entry with the new amount and date.
  update account_openings set amount = 40000, as_on = '2026-05-01' where id = v_id;
  select coalesce(sum(l.debit), 0) into v_n from journal_lines l join journal_entries je on je.id = l.entry_id join gl_accounts g on g.id = l.gl_account_id
    where je.source_table = 'account_openings' and je.source_id = v_id and g.code = '1020';
  if v_n <> 40000 then raise exception 'FAIL: the changed opening should be 40000, got %', v_n; end if;
  select count(*) into v_cnt from journal_entries where source_table = 'account_openings' and source_id = v_id;
  if v_cnt <> 1 then raise exception 'FAIL: there should still be one entry'; end if;

  -- 5. An overdraft opening runs the other way.
  insert into account_openings (bank_account_id, as_on, amount) values (null, '2026-06-01', -2000) returning id into v_id2;
  select coalesce(sum(l.credit), 0) into v_n from journal_lines l join journal_entries je on je.id = l.entry_id join gl_accounts g on g.id = l.gl_account_id
    where je.source_table = 'account_openings' and je.source_id = v_id2 and g.code = '1010';
  if v_n <> 2000 then raise exception 'FAIL: an overdraft should credit cash 2000, got %', v_n; end if;

  -- 6. Statement month balances must be the first of a month, and are not posted.
  begin
    insert into account_month_balances (bank_account_id, month, balance) values (v_bank, '2026-09-15', 1);
    raise exception 'FAIL: a mid-month date was accepted';
  exception when check_violation then null; end;
  insert into account_month_balances (bank_account_id, month, balance) values (v_bank, '2026-09-01', 12345);
  select count(*) into v_cnt from journal_entries where source_table = 'account_month_balances';
  if v_cnt <> 0 then raise exception 'FAIL: a monthly balance must not be posted'; end if;

  -- 7. Removing the opening takes its entry away, and the ledger balances.
  delete from account_openings where id = v_id;
  select count(*) into v_cnt from journal_entries where source_table = 'account_openings' and source_id = v_id;
  if v_cnt <> 0 then raise exception 'FAIL: the entry should go with the opening'; end if;
  select sum(debit), sum(credit) into v_dr, v_cr from journal_lines;
  if v_dr <> v_cr then raise exception 'FAIL: ledger out of balance (dr %, cr %)', v_dr, v_cr; end if;

  raise exception 'PASS: openings post to the bank and Opening Balance Equity, change and clear cleanly, and monthly balances are not posted';
end;
$$;
