-- Vendor advances: posting, automatic adjustment (oldest advance first), edits and deletes.
-- Rolled back on purpose: the last statement always raises.
do $$
declare
  v_admin uuid;
  v_vendor uuid;
  v_sub uuid;
  v_a1 uuid;
  v_a2 uuid;
  v_b1 uuid;
  v_b2 uuid;
  v_entry uuid;
  v_n numeric;
  v_dr numeric;
  v_cr numeric;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;

  select id into v_sub from expense_sub_heads limit 1;
  insert into vendors (name) values ('ZZ Advance Vendor') returning id into v_vendor;

  -- 1. An advance posts Dr Advances to Suppliers / Cr cash, against the vendor.
  insert into vendor_advances (vendor_id, date, amount, payment_mode) values (v_vendor, '2026-10-05', 10000, 'Cash') returning id into v_a1;
  select id into v_entry from journal_entries where source_table = 'vendor_advances' and source_id = v_a1;
  if v_entry is null then raise exception 'FAIL: the advance did not post'; end if;
  select coalesce(sum(l.debit), 0) into v_n from journal_lines l join gl_accounts g on g.id = l.gl_account_id
    where l.entry_id = v_entry and g.code = '1075' and l.vendor_id = v_vendor;
  if v_n <> 10000 then raise exception 'FAIL: advance should debit 1075 for 10000 against the vendor, got %', v_n; end if;
  select coalesce(sum(l.credit), 0) into v_n from journal_lines l join gl_accounts g on g.id = l.gl_account_id where l.entry_id = v_entry and g.code = '1010';
  if v_n <> 10000 then raise exception 'FAIL: a cash advance should credit cash for 10000, got %', v_n; end if;

  -- 2. A bill smaller than the advance is settled from it automatically.
  insert into vendor_bills (vendor_id, date, amount, gst_pct, sub_head_id) values (v_vendor, '2026-10-10', 6000, 0, v_sub) returning id into v_b1;
  select coalesce(sum(amount), 0) into v_n from vendor_bill_payments where bill_id = v_b1 and payment_mode = 'Advance' and advance_id = v_a1;
  if v_n <> 6000 then raise exception 'FAIL: the bill should be settled from the advance for 6000, got %', v_n; end if;
  select id into v_entry from journal_entries where source_table = 'vendor_bill_payments'
    and source_id = (select id from vendor_bill_payments where bill_id = v_b1 limit 1);
  select coalesce(sum(l.debit), 0) into v_n from journal_lines l join gl_accounts g on g.id = l.gl_account_id where l.entry_id = v_entry and g.code = '2010';
  if v_n <> 6000 then raise exception 'FAIL: the adjustment should debit payables for 6000, got %', v_n; end if;
  select coalesce(sum(l.credit), 0) into v_n from journal_lines l join gl_accounts g on g.id = l.gl_account_id where l.entry_id = v_entry and g.code = '1075';
  if v_n <> 6000 then raise exception 'FAIL: the adjustment should credit advances for 6000, got %', v_n; end if;
  select count(*) into v_n from journal_lines l where l.entry_id = v_entry and l.bank_account_id is not null;
  if v_n <> 0 then raise exception 'FAIL: an adjustment must not touch a bank account'; end if;

  -- 3. A bigger bill takes what is left of the advance and keeps the rest due.
  insert into vendor_bills (vendor_id, date, amount, gst_pct, sub_head_id) values (v_vendor, '2026-10-12', 5000, 0, v_sub) returning id into v_b2;
  select coalesce(sum(amount), 0) into v_n from vendor_bill_payments where bill_id = v_b2;
  if v_n <> 4000 then raise exception 'FAIL: the second bill should get the remaining 4000, got %', v_n; end if;

  -- 4. A later advance settles what is still due, and keeps its own balance.
  insert into vendor_advances (vendor_id, date, amount, payment_mode) values (v_vendor, '2026-10-15', 3000, 'Cash') returning id into v_a2;
  select coalesce(sum(amount), 0) into v_n from vendor_bill_payments where bill_id = v_b2;
  if v_n <> 5000 then raise exception 'FAIL: the second bill should now be fully settled, got %', v_n; end if;
  select coalesce(sum(l.debit - l.credit), 0) into v_n from journal_lines l join gl_accounts g on g.id = l.gl_account_id where g.code = '1075' and l.vendor_id = v_vendor;
  if v_n <> 2000 then raise exception 'FAIL: 2000 of advance should be left, got %', v_n; end if;
  select coalesce(sum(l.credit - l.debit), 0) into v_n from journal_lines l join gl_accounts g on g.id = l.gl_account_id where g.code = '2010' and l.vendor_id = v_vendor;
  if v_n <> 0 then raise exception 'FAIL: the vendor should be owed nothing, got %', v_n; end if;

  -- 5. A bill edited down gives the excess back to the advance.
  update vendor_bills set amount = 5000 where id = v_b1;
  select coalesce(sum(amount), 0) into v_n from vendor_bill_payments where bill_id = v_b1;
  if v_n <> 5000 then raise exception 'FAIL: the edited bill should be settled for 5000, got %', v_n;  end if;
  select coalesce(sum(l.debit - l.credit), 0) into v_n from journal_lines l join gl_accounts g on g.id = l.gl_account_id where g.code = '1075' and l.vendor_id = v_vendor;
  if v_n <> 3000 then raise exception 'FAIL: 3000 of advance should be left after the edit, got %', v_n; end if;

  -- 6. An advance cannot be cut below what has been used.
  begin
    update vendor_advances set amount = 5000 where id = v_a1;
    raise exception 'FAIL: an advance was cut below what had been used';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  -- 7. Deleting a bill frees its advance.
  delete from vendor_bills where id = v_b1;
  select coalesce(sum(l.debit - l.credit), 0) into v_n from journal_lines l join gl_accounts g on g.id = l.gl_account_id where g.code = '1075' and l.vendor_id = v_vendor;
  if v_n <> 8000 then raise exception 'FAIL: 8000 of advance should be left after deleting a bill, got %', v_n; end if;

  -- 8. Deleting an advance undoes what it settled, and the other advance covers it where it can.
  delete from vendor_advances where id = v_a1;
  select coalesce(sum(amount), 0) into v_n from vendor_bill_payments where bill_id = v_b2;
  if v_n <> 3000 then raise exception 'FAIL: the remaining advance should now settle 3000 of the bill, got %', v_n; end if;
  select coalesce(sum(l.credit - l.debit), 0) into v_n from journal_lines l join gl_accounts g on g.id = l.gl_account_id where g.code = '2010' and l.vendor_id = v_vendor;
  if v_n <> 2000 then raise exception 'FAIL: 2000 should still be owed to the vendor, got %', v_n; end if;

  -- 9. The whole ledger still balances.
  select sum(debit), sum(credit) into v_dr, v_cr from journal_lines;
  if v_dr <> v_cr then raise exception 'FAIL: ledger out of balance (dr %, cr %)', v_dr, v_cr; end if;

  raise exception 'PASS: vendor advances post, adjust oldest first, follow edits and deletes, and balance';
end;
$$;
