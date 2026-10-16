-- Transfers keep the books right: posting, editing and deleting. Rolled back on purpose: the last statement always raises.
do $$
declare
  v_admin uuid; v_a uuid; v_b uuid; v_id uuid; v_n numeric; v_cnt int; v_dr numeric; v_cr numeric;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  select id into v_a from bank_accounts where name = 'Kotak';
  select id into v_b from bank_accounts where name = 'CBI';

  -- 1. A transfer moves money out of one account and into the other.
  insert into transfers (from_account_id, to_account_id, amount, date) values (v_a, v_b, 1000, '2026-10-05') returning id into v_id;
  select coalesce(sum(l.debit), 0) into v_n from journal_lines l join journal_entries je on je.id = l.entry_id where je.source_table = 'transfers' and je.source_id = v_id and l.bank_account_id = v_b;
  if v_n <> 1000 then raise exception 'FAIL: the receiving account should be debited 1000, got %', v_n; end if;
  select coalesce(sum(l.credit), 0) into v_n from journal_lines l join journal_entries je on je.id = l.entry_id where je.source_table = 'transfers' and je.source_id = v_id and l.bank_account_id = v_a;
  if v_n <> 1000 then raise exception 'FAIL: the sending account should be credited 1000, got %', v_n; end if;

  -- 2. Changing the amount posts it again, once.
  update transfers set amount = 1500, date = '2026-10-06' where id = v_id;
  select coalesce(sum(l.debit), 0) into v_n from journal_lines l join journal_entries je on je.id = l.entry_id where je.source_table = 'transfers' and je.source_id = v_id;
  if v_n <> 1500 then raise exception 'FAIL: the edited transfer should post 1500, got %', v_n; end if;
  select count(*) into v_cnt from journal_entries where source_table = 'transfers' and source_id = v_id and date = '2026-10-06';
  if v_cnt <> 1 then raise exception 'FAIL: there should be one entry, dated 6 Oct'; end if;

  -- 3. Deleting the transfer takes its entry out of the books.
  delete from transfers where id = v_id;
  select count(*) into v_cnt from journal_entries where source_table = 'transfers' and source_id = v_id;
  if v_cnt <> 0 then raise exception 'FAIL: a deleted transfer left its entry in the books'; end if;

  -- 4. No entry is left without its transfer, and the ledger balances.
  select count(*) into v_cnt from journal_entries je where je.source_table = 'transfers' and not exists (select 1 from transfers t where t.id = je.source_id);
  if v_cnt <> 0 then raise exception 'FAIL: % entries are left behind by deleted transfers', v_cnt; end if;
  select sum(debit), sum(credit) into v_dr, v_cr from journal_lines;
  if v_dr <> v_cr then raise exception 'FAIL: ledger out of balance (dr %, cr %)', v_dr, v_cr; end if;

  -- 5. Loans are not readable by a supervisor.
  -- Sign in as a supervisor: both settings, or the database still sees the admin.
  select id into v_admin from profiles where role = 'supervisor' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  select count(*) into v_cnt from loans;
  if v_cnt <> 0 then raise exception 'FAIL: a supervisor can read % loans', v_cnt; end if;

  raise exception 'PASS: transfers post, repost and clear cleanly, and loans are closed to supervisors';
end;
$$;
