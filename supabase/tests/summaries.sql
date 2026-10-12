-- Summary figures must ignore Draft invoices and pending or rejected expenses.
-- Rolled back on purpose: the last statement always raises.
do $$
declare
  v_admin uuid; v_client uuid; v_sub uuid;
  b_sum json; a_sum json; b_kpi record; a_kpi record;
  v_sent_gst numeric;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;

  b_sum := report_summary(null, null);
  select * into b_kpi from v_dashboard_kpis;

  insert into clients (name) values ('ZZ Summary Client') returning id into v_client;
  -- A draft with a manual due date in the past, and a payment on it.
  insert into invoices (client_id, amount, gst_pct, tds_pct, status, due_date_manual, invoice_number)
  values (v_client, 100000, 18, 2, 'draft', current_date - 40, 'ZZ/SUM/DRAFT');

  select id into v_sub from expense_sub_heads limit 1;
  insert into expenses (description, amount, date, sub_head_id, status, created_by) values ('ZZ pending claim', 7777, current_date, v_sub, 'pending', v_admin);
  insert into expenses (description, amount, date, sub_head_id, status, created_by) values ('ZZ rejected claim', 3333, current_date, v_sub, 'rejected', v_admin);

  a_sum := report_summary(null, null);
  select * into a_kpi from v_dashboard_kpis;

  if (a_sum->>'output_gst')::numeric <> (b_sum->>'output_gst')::numeric then raise exception 'FAIL: a draft changed output GST'; end if;
  if (a_sum->>'tds_deducted')::numeric <> (b_sum->>'tds_deducted')::numeric then raise exception 'FAIL: a draft changed TDS'; end if;
  if (a_sum->>'total_invoiced')::numeric <> (b_sum->>'total_invoiced')::numeric then raise exception 'FAIL: a draft changed total invoiced'; end if;
  if (a_sum->>'total_expenses')::numeric <> (b_sum->>'total_expenses')::numeric then raise exception 'FAIL: a pending or rejected claim changed total expenses'; end if;
  if a_kpi.outstanding_from_clients <> b_kpi.outstanding_from_clients then raise exception 'FAIL: a draft changed outstanding from clients'; end if;
  if a_kpi.overdue_invoices_count <> b_kpi.overdue_invoices_count then raise exception 'FAIL: a draft counted as overdue'; end if;
  if a_kpi.expenses_this_month <> b_kpi.expenses_this_month then raise exception 'FAIL: a pending claim changed expenses this month'; end if;

  -- Sending it makes it count.
  update invoices set status = 'sent', invoice_date = current_date, due_date_manual = null, due_days = 30 where invoice_number = 'ZZ/SUM/DRAFT';
  a_sum := report_summary(null, null);
  v_sent_gst := (a_sum->>'output_gst')::numeric - (b_sum->>'output_gst')::numeric;
  if v_sent_gst <> 18000 then raise exception 'FAIL: a sent invoice should add 18000 GST, added %', v_sent_gst; end if;

  raise exception 'PASS: summaries count only sent invoices and approved expenses';
end $$;
