-- Rolled-back test of supabase/pending/20261108000000_phase4_trash_and_reviews.sql.
-- Run as: the migration file, followed by this block, in one request. This block ends with an exception, so everything is rolled back.
do $test$
declare
  admin_id uuid;
  stranger uuid := gen_random_uuid();
  e1 uuid; e1_je int; e1_debit numeric; e1_lines int;
  e2 uuid; e2_children int; e2_je int; e2_child_je int;
  l1 uuid; l1_je int; l1_child_je int; l1_children int;
  rec_expense uuid;
  n bigint; n2 numeric;
  r text := '';
  ok boolean;
  before_exp bigint; before_total numeric; before_lines bigint; before_audit bigint;
begin
  select count(*), sum(amount) into before_exp, before_total from expenses;
  select count(*) into before_lines from journal_lines;
  select count(*) into before_audit from audit_log;
  select id into admin_id from profiles where role = 'admin' limit 1;

  -- a plain approved expense that is in the books, not reconciled and not in a locked period, with no reimbursement
  select e.id into e1 from expenses e
   where exists (select 1 from journal_entries je where je.source_table = 'expenses' and je.source_id = e.id)
     and not books_locked(e.date)
     and not exists (select 1 from expense_reimbursements x where x.expense_id = e.id)
     and not exists (select 1 from bank_reconciliations br join journal_lines jl on jl.id = br.journal_line_id join journal_entries je on je.id = jl.entry_id where je.source_table = 'expenses' and je.source_id = e.id)
   limit 1;
  select count(*) into e1_je from journal_entries where source_table = 'expenses' and source_id = e1;
  select count(*), coalesce(sum(debit), 0) into e1_lines, e1_debit from journal_lines where entry_id in (select id from journal_entries where source_table = 'expenses' and source_id = e1);

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  set local role authenticated;

  -- a. the marker cannot be set by a direct edit
  ok := false;
  begin
    update expenses set deleted_at = now() where id = e1;
  exception when others then ok := true;
  end;
  r := r || case when ok then 'a:ok ' else 'a:FAIL ' end;

  -- b. trash it; it vanishes from a normal read
  begin
    perform trash_record('expenses', e1, 'test');
    select count(*) into n from expenses where id = e1;
    r := r || case when n = 0 then 'b:ok ' else 'b:FAIL(still visible) ' end;
  exception when others then r := r || 'b:FAIL(' || sqlerrm || ') ';
  end;

  -- c. it is in list_trash
  select count(*) into n from list_trash() where record_id = e1 and table_name = 'expenses';
  r := r || case when n = 1 then 'c:ok ' else 'c:FAIL ' end;

  reset role;
  -- d. its ledger entry is gone, the row itself is kept
  select count(*) into n from journal_entries where source_table = 'expenses' and source_id = e1;
  select count(*) into n2 from expenses where id = e1 and deleted_at is not null and delete_reason = 'test';
  r := r || case when n = 0 and n2 = 1 then 'd:ok ' else 'd:FAIL ' end;

  -- e. restore: back in the list, ledger entry and lines identical to before
  set local role authenticated;
  begin
    perform restore_record('expenses', e1);
  exception when others then r := r || 'e:FAIL(' || sqlerrm || ') ';
  end;
  select count(*) into n from expenses where id = e1;
  reset role;
  declare cnt int; lns int; deb numeric;
  begin
    select count(*) into cnt from journal_entries where source_table = 'expenses' and source_id = e1;
    select count(*), coalesce(sum(debit), 0) into lns, deb from journal_lines where entry_id in (select id from journal_entries where source_table = 'expenses' and source_id = e1);
    r := r || case when n = 1 and cnt = e1_je and lns = e1_lines and deb = e1_debit then 'e:ok ' else format('e:FAIL(%s %s/%s %s/%s %s/%s) ', n, cnt, e1_je, lns, e1_lines, deb, e1_debit) end;
  end;

  -- f. someone who is not an admin cannot delete
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', stranger::text, true);
  set local role authenticated;
  ok := false;
  begin
    perform trash_record('expenses', e1, 'no');
  exception when others then ok := sqlerrm like 'Only an admin%';
  end;
  r := r || case when ok then 'f:ok ' else 'f:FAIL ' end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  set local role authenticated;

  -- g. a record matched in bank reconciliation cannot be deleted
  select e.id into rec_expense from expenses e
   where exists (select 1 from bank_reconciliations br join journal_lines jl on jl.id = br.journal_line_id join journal_entries je on je.id = jl.entry_id where je.source_table = 'expenses' and je.source_id = e.id) limit 1;
  if rec_expense is null then
    r := r || 'g:skipped(no reconciled expense) ';
  else
    ok := false;
    begin
      perform trash_record('expenses', rec_expense, 'x');
    exception when others then ok := sqlerrm like '%bank reconciliation%';
    end;
    r := r || case when ok then 'g:ok ' else 'g:FAIL ' end;
  end if;

  -- h. an expense with a reimbursement: both go to the Trash together and both come back
  reset role;
  select x.expense_id into e2 from expense_reimbursements x
   where exists (select 1 from journal_entries je where je.source_table = 'expense_reimbursements' and je.source_id = x.id)
     and not books_locked(x.date)
     and not exists (select 1 from bank_reconciliations br join journal_lines jl on jl.id = br.journal_line_id join journal_entries je on je.id = jl.entry_id where je.source_table in ('expenses','expense_reimbursements') and je.source_id in (x.id, x.expense_id))
   limit 1;
  if e2 is null then
    r := r || 'h:skipped ';
  else
    select count(*) into e2_children from expense_reimbursements where expense_id = e2;
    select count(*) into e2_je from journal_entries where source_table = 'expenses' and source_id = e2;
    select count(*) into e2_child_je from journal_entries where source_table = 'expense_reimbursements' and source_id in (select id from expense_reimbursements where expense_id = e2);
    set local role authenticated;
    begin
      perform trash_record('expenses', e2, 'cascade');
      reset role;
      select count(*) into n from journal_entries where (source_table = 'expenses' and source_id = e2) or (source_table = 'expense_reimbursements' and source_id in (select id from expense_reimbursements where expense_id = e2));
      select count(*) into n2 from expense_reimbursements where expense_id = e2 and deleted_at is not null;
      ok := n = 0 and n2 = e2_children;
      set local role authenticated;
      perform restore_record('expenses', e2);
      reset role;
      select count(*) into n from journal_entries where source_table = 'expenses' and source_id = e2;
      select count(*) into n2 from journal_entries where source_table = 'expense_reimbursements' and source_id in (select id from expense_reimbursements where expense_id = e2);
      ok := ok and n = e2_je and n2 = e2_child_je and (select count(*) from expense_reimbursements where expense_id = e2 and deleted_at is null) = e2_children;
      r := r || case when ok then 'h:ok ' else 'h:FAIL ' end;
    exception when others then r := r || 'h:FAIL(' || sqlerrm || ') ';
    end;
    reset role;
  end if;

  -- i. a loan with payments: same
  select l.id into l1 from loans l
   where not books_locked(l.date_taken)
     and not exists (select 1 from bank_reconciliations br join journal_lines jl on jl.id = br.journal_line_id join journal_entries je on je.id = jl.entry_id where (je.source_table = 'loans' and je.source_id = l.id) or (je.source_table = 'loan_payments' and je.source_id in (select id from loan_payments where loan_id = l.id)))
     and not exists (select 1 from loan_payments p where p.loan_id = l.id and books_locked(p.date))
     and exists (select 1 from loan_payments p where p.loan_id = l.id)
   limit 1;
  if l1 is null then
    r := r || 'i:skipped ';
  else
    select count(*) into l1_children from loan_payments where loan_id = l1;
    select count(*) into l1_je from journal_entries where source_table = 'loans' and source_id = l1;
    select count(*) into l1_child_je from journal_entries where source_table = 'loan_payments' and source_id in (select id from loan_payments where loan_id = l1);
    set local role authenticated;
    begin
      perform trash_record('loans', l1, 'cascade');
      reset role;
      select count(*) into n from journal_entries where (source_table = 'loans' and source_id = l1) or (source_table = 'loan_payments' and source_id in (select id from loan_payments where loan_id = l1));
      ok := n = 0;
      set local role authenticated;
      perform restore_record('loans', l1);
      reset role;
      select count(*) into n from journal_entries where source_table = 'loans' and source_id = l1;
      select count(*) into n2 from journal_entries where source_table = 'loan_payments' and source_id in (select id from loan_payments where loan_id = l1);
      ok := ok and n = l1_je and n2 = l1_child_je;
      r := r || case when ok then 'i:ok ' else format('i:FAIL(%s/%s %s/%s) ', n, l1_je, n2, l1_child_je) end;
    exception when others then r := r || 'i:FAIL(' || sqlerrm || ') ';
    end;
    reset role;
  end if;

  -- j. reviewed ticks
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  set local role authenticated;
  begin
    insert into record_reviews (table_name, record_id) values ('expenses', e1);
    select count(*) into n from record_reviews where table_name = 'expenses' and record_id = e1;
    r := r || case when n = 1 then 'j:ok ' else 'j:FAIL ' end;
  exception when others then r := r || 'j:FAIL(' || sqlerrm || ') ';
  end;
  reset role;

  -- k. everything is back as it was: same expenses, same totals, same ledger lines
  select count(*) into n from expenses;
  select sum(amount) into n2 from expenses;
  r := r || case when n = before_exp and n2 = before_total and (select count(*) from journal_lines) = before_lines then 'k:ok' else 'k:FAIL' end;

  raise exception '% %', case when r like '%FAIL%' then 'FAIL' else 'PASS' end, r;
end;
$test$;
