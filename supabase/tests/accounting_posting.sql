-- Posting engine checks. Rolled back on purpose: the last statement always raises.
do $$
declare
  v_admin uuid;
  v_client uuid;
  v_inv uuid;
  v_entry uuid;
  v_sub uuid;
  v_exp uuid;
  v_dr numeric;
  v_cr numeric;
  v_amt numeric;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;

  -- 1. An invoice with GST, TDS and retention posts a balanced entry.
  insert into clients (name, gst) values ('ZZ Test Client', '07AAJFL1554B1ZN') returning id into v_client;
  insert into invoices (client_id, amount, gst_pct, tds_pct, retention_pct, status, invoice_date, invoice_number)
  values (v_client, 100000, 18, 2, 10, 'sent', '2026-10-05', 'ZZ/TEST/001') returning id into v_inv;

  select id into v_entry from journal_entries where source_table = 'invoices' and source_id = v_inv;
  if v_entry is null then raise exception 'FAIL: invoice did not post a journal entry'; end if;

  select sum(debit), sum(credit) into v_dr, v_cr from journal_lines where entry_id = v_entry;
  if v_dr <> v_cr then raise exception 'FAIL: invoice entry is not balanced (dr %, cr %)', v_dr, v_cr; end if;

  select coalesce(sum(l.debit), 0) into v_amt from journal_lines l join gl_accounts g on g.id = l.gl_account_id where l.entry_id = v_entry and g.code = '1030';
  if v_amt <> 104400 then raise exception 'FAIL: receivable should be 104400 (net less retention), got %', v_amt; end if;
  select coalesce(sum(l.debit), 0) into v_amt from journal_lines l join gl_accounts g on g.id = l.gl_account_id where l.entry_id = v_entry and g.code = '1035';
  if v_amt <> 11600 then raise exception 'FAIL: retention should be 11600, got %', v_amt; end if;
  select coalesce(sum(l.debit), 0) into v_amt from journal_lines l join gl_accounts g on g.id = l.gl_account_id where l.entry_id = v_entry and g.code = '1040';
  if v_amt <> 2000 then raise exception 'FAIL: TDS receivable should be 2000, got %', v_amt; end if;
  select coalesce(sum(l.credit), 0) into v_amt from journal_lines l join gl_accounts g on g.id = l.gl_account_id where l.entry_id = v_entry and g.code = '4010';
  if v_amt <> 100000 then raise exception 'FAIL: revenue should be 100000, got %', v_amt; end if;
  select coalesce(sum(l.credit), 0) into v_amt from journal_lines l join gl_accounts g on g.id = l.gl_account_id where l.entry_id = v_entry and g.code like '203%';
  if v_amt <> 18000 then raise exception 'FAIL: GST payable should be 18000, got %', v_amt; end if;

  -- 2. A receipt posts a balanced entry and clears the receivable.
  insert into invoice_payments (invoice_id, date, amount) values (v_inv, '2026-10-20', 104400);
  select coalesce(sum(l.debit - l.credit), 0) into v_amt
  from journal_lines l join gl_accounts g on g.id = l.gl_account_id
  where g.code = '1030' and l.client_id = v_client;
  if v_amt <> 0 then raise exception 'FAIL: receivable should be nil after a full receipt, got %', v_amt; end if;

  -- 3. An approved expense with GST posts a balanced entry.
  select id into v_sub from expense_sub_heads limit 1;
  insert into expenses (description, amount, date, sub_head_id, gst_pct, status, created_by)
  values ('ZZ test expense', 1000, '2026-10-06', v_sub, 18, 'approved', v_admin) returning id into v_exp;
  select e.id into v_entry from journal_entries e where e.source_table = 'expenses' and e.source_id = v_exp;
  if v_entry is null then raise exception 'FAIL: approved expense did not post'; end if;
  select sum(debit), sum(credit) into v_dr, v_cr from journal_lines where entry_id = v_entry;
  if v_dr <> v_cr or v_dr <> 1180 then raise exception 'FAIL: expense entry should balance at 1180 (dr %, cr %)', v_dr, v_cr; end if;

  -- 4. The whole ledger still balances.
  select sum(debit), sum(credit) into v_dr, v_cr from journal_lines;
  if v_dr <> v_cr then raise exception 'FAIL: ledger out of balance (dr %, cr %)', v_dr, v_cr; end if;

  raise exception 'PASS: posting checks';
end $$;
