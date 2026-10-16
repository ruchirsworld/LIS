-- Other money received (deposit given back, interest, refund, scrap sold, other income).
-- Rolled back on purpose: the last statement always raises.
do $$
declare
  v_admin uuid; v_bank uuid; v_id uuid; v_id2 uuid; v_n numeric; v_cnt int; v_dr numeric; v_cr numeric; v_disp text;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  select id into v_bank from bank_accounts where name = 'CBI';

  -- 1. A returned deposit: Dr bank, Cr Security Deposits (not income).
  insert into other_receipts (kind, date, amount, payer, payment_mode, bank_account_id) values ('security_deposit', '2026-10-01', 5260, 'Old landlord', 'Bank', v_bank) returning id, display_id into v_id, v_disp;
  if v_disp is null or v_disp not like 'Oth/%' then raise exception 'FAIL: expected an Oth/ number, got %', v_disp; end if;
  select coalesce(sum(l.debit), 0) into v_n from journal_lines l join journal_entries je on je.id = l.entry_id join gl_accounts g on g.id = l.gl_account_id
    where je.source_table = 'other_receipts' and je.source_id = v_id and g.code = '1020' and l.bank_account_id = v_bank;
  if v_n <> 5260 then raise exception 'FAIL: the bank should be debited 5260, got %', v_n; end if;
  select coalesce(sum(l.credit), 0) into v_n from journal_lines l join journal_entries je on je.id = l.entry_id join gl_accounts g on g.id = l.gl_account_id
    where je.source_table = 'other_receipts' and je.source_id = v_id and g.code = '1080';
  if v_n <> 5260 then raise exception 'FAIL: Security Deposits should be credited 5260, got %', v_n; end if;
  select count(*) into v_cnt from journal_lines l join journal_entries je on je.id = l.entry_id join gl_accounts g on g.id = l.gl_account_id
    where je.source_table = 'other_receipts' and je.source_id = v_id and g.code = '4020';
  if v_cnt <> 0 then raise exception 'FAIL: a returned deposit must not be income'; end if;

  -- 2. Interest in cash: Dr cash, Cr Other Income.
  insert into other_receipts (kind, date, amount, payment_mode, bank_account_id) values ('interest', '2026-10-02', 320.5, 'Cash', null) returning id into v_id2;
  select coalesce(sum(l.credit), 0) into v_n from journal_lines l join journal_entries je on je.id = l.entry_id join gl_accounts g on g.id = l.gl_account_id
    where je.source_table = 'other_receipts' and je.source_id = v_id2 and g.code = '4020';
  if v_n <> 320.5 then raise exception 'FAIL: Other Income should be credited 320.50, got %', v_n; end if;
  select coalesce(sum(l.debit), 0) into v_n from journal_lines l join journal_entries je on je.id = l.entry_id join gl_accounts g on g.id = l.gl_account_id
    where je.source_table = 'other_receipts' and je.source_id = v_id2 and g.code = '1010';
  if v_n <> 320.5 then raise exception 'FAIL: cash should be debited 320.50, got %', v_n; end if;

  -- 3. Bad input is refused.
  begin insert into other_receipts (kind, date, amount, payment_mode) values ('other', '2026-10-02', 0, 'Cash'); raise exception 'FAIL: a zero amount was accepted';
  exception when check_violation then null; end;
  begin insert into other_receipts (kind, date, amount, payment_mode) values ('loan', '2026-10-02', 10, 'Cash'); raise exception 'FAIL: an unknown kind was accepted';
  exception when check_violation then null; end;

  -- 4. Changing the kind moves the credit; removing it clears the entry; the ledger balances.
  update other_receipts set kind = 'other' where id = v_id;
  select coalesce(sum(l.credit), 0) into v_n from journal_lines l join journal_entries je on je.id = l.entry_id join gl_accounts g on g.id = l.gl_account_id
    where je.source_table = 'other_receipts' and je.source_id = v_id and g.code = '4020';
  if v_n <> 5260 then raise exception 'FAIL: the changed entry should credit Other Income 5260, got %', v_n; end if;
  delete from other_receipts where id = v_id;
  select count(*) into v_cnt from journal_entries where source_table = 'other_receipts' and source_id = v_id;
  if v_cnt <> 0 then raise exception 'FAIL: the entry should go with the receipt'; end if;
  select sum(debit), sum(credit) into v_dr, v_cr from journal_lines;
  if v_dr <> v_cr then raise exception 'FAIL: ledger out of balance (dr %, cr %)', v_dr, v_cr; end if;

  raise exception 'PASS: other receipts post to the bank or cash, deposits and income go to the right accounts, bad input is refused';
end;
$$;
