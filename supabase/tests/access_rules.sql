-- Access and integrity rules. Rolled back on purpose: the last statement always raises.
-- Run after 20261024000000_security_hardening.sql has been applied.
do $$
declare
  v_admin uuid;
  v_sup uuid;
  v_client uuid;
  v_inv uuid;
  v_exp uuid;
  v_sub uuid;
  v_n int;
  v_amt numeric;
  v_ok boolean;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  select id into v_sup from profiles where role = 'supervisor' limit 1;

  -- ── As a supervisor ──
  perform set_config('request.jwt.claims', json_build_object('sub', v_sup, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_sup::text, true);
  set local role authenticated;

  select count(*) into v_n from journal_lines;
  if v_n <> 0 then raise exception 'FAIL: a supervisor can read % ledger lines', v_n; end if;
  select count(*) into v_n from journal_entries;
  if v_n <> 0 then raise exception 'FAIL: a supervisor can read % journal entries', v_n; end if;
  select count(*) into v_n from invoices;
  if v_n <> 0 then raise exception 'FAIL: a supervisor can read % invoices', v_n; end if;
  select count(*) into v_n from bank_accounts;
  if v_n <> 0 then raise exception 'FAIL: a supervisor can read bank accounts'; end if;
  select count(*) into v_n from staff where supervisor_id is distinct from v_sup;
  if v_n <> 0 then raise exception 'FAIL: a supervisor can read % staff outside their own team', v_n; end if;

  begin
    perform post_gst_lines(gen_random_uuid(), null, 100, true);
    raise exception 'FAIL: a supervisor can call post_gst_lines';
  exception when insufficient_privilege then null;
  end;
  begin
    perform repost_invoice_entry(gen_random_uuid(), false);
    raise exception 'FAIL: a supervisor can call repost_invoice_entry';
  exception when insufficient_privilege then null;
  end;

  v_ok := false;
  begin
    insert into expense_reimbursements (expense_id, date, amount, created_by, approved_by)
    values (gen_random_uuid(), current_date, 1, v_sup, v_sup);
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL: a supervisor can create or approve a reimbursement'; end if;

  reset role;

  -- ── As the public (not signed in) ──
  set local role anon;
  begin
    perform post_gst_lines(gen_random_uuid(), null, 100, true);
    raise exception 'FAIL: the public can call post_gst_lines';
  exception when insufficient_privilege then null;
  end;
  begin
    perform gl_balances(null, null);
    raise exception 'FAIL: the public can call gl_balances';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- ── As an admin ──
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;

  select count(*) into v_n from journal_lines;
  if v_n = 0 then raise exception 'FAIL: an admin cannot read the ledger'; end if;

  insert into clients (name) values ('ZZ Access Client') returning id into v_client;
  insert into invoices (client_id, amount, gst_pct, status, invoice_date, invoice_number)
  values (v_client, 1000, 18, 'sent', '2026-10-05', 'ZZ/ACCESS/001') returning id into v_inv;

  v_ok := false;
  begin
    insert into invoices (client_id, amount, status, invoice_number) values (v_client, 1, 'draft', ' zz/access/001 ');
  exception when unique_violation then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL: a duplicate invoice number was accepted'; end if;

  v_ok := false;
  begin
    insert into invoices (client_id, amount, status) values (v_client, -5, 'draft');
  exception when check_violation then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL: a negative invoice amount was accepted'; end if;

  select id into v_sub from expense_sub_heads limit 1;
  insert into expenses (description, amount, date, sub_head_id, gst_pct, status, created_by)
  values ('ZZ rounding', 10.005, '2026-10-06', v_sub, 18, 'approved', v_admin) returning id, amount into v_exp, v_amt;
  if v_amt <> 10.01 then raise exception 'FAIL: expense amount should be stored to the paisa, got %', v_amt; end if;
  select coalesce(sum(l.debit), 0) into v_amt
  from journal_lines l join journal_entries e on e.id = l.entry_id
  where e.source_table = 'expenses' and e.source_id = v_exp and l.debit <> round(l.debit, 2);
  if v_amt <> 0 then raise exception 'FAIL: an expense posted a part-paisa amount'; end if;

  raise exception 'PASS: access and integrity checks';
end $$;
