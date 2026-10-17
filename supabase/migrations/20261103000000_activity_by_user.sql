-- Everything one person recorded, in one list.
--
-- activity_by_user(user, from, to, by_recorded) returns every transaction whose created_by is that person, across expenses,
-- reimbursements, vendor bills / payments / advances, invoices, client receipts, credit and debit notes, transfers, loans,
-- capital, other receipts, wages, site imprest, salary advances, trips and opening balances. The date range applies to the
-- transaction's own date, or to the day it was recorded when by_recorded is true.
--
-- It runs with the caller's own permissions (row-level security applies) and returns nothing unless the caller is
-- back-office (Admin or CXO).

create or replace function activity_by_user(p_user uuid, p_from date default null, p_to date default null, p_by_recorded boolean default false)
returns table (
  activity_date date,
  recorded_at timestamptz,
  kind text,
  source_table text,
  source_id uuid,
  display_id text,
  description text,
  amount numeric,
  direction text,        -- 'in' = money in, 'out' = money out, null = no money moves by itself (a bill, an invoice, a transfer)
  status text,
  reimbursable boolean
)
language sql
stable
set search_path to 'public'
as $function$
  with acts as (
    select e.date as activity_date, e.created_at as recorded_at, 'Expense' as kind, 'expenses' as source_table, e.id as source_id,
           e.display_id, e.description, e.amount, 'out' as direction, e.status::text as status, coalesce(e.reimbursable, false) as reimbursable
    from expenses e where e.created_by = p_user

    union all
    select r.date, r.created_at, 'Reimbursement paid', 'expense_reimbursements', r.id,
           r.display_id, coalesce(x.description, ''), r.amount, 'out', null, false
    from expense_reimbursements r left join expenses x on x.id = r.expense_id where r.created_by = p_user

    union all
    select b.date, b.created_at, 'Vendor bill', 'vendor_bills', b.id,
           b.display_id, concat_ws(' — ', v.name, nullif(b.description, '')), c.payable, null, null, false
    from vendor_bills b
    left join vendors v on v.id = b.vendor_id
    left join v_vendor_bill_computed c on c.id = b.id
    where b.created_by = p_user

    union all
    select p.date, p.created_at, 'Vendor payment', 'vendor_bill_payments', p.id,
           p.display_id, coalesce(v.name, ''), p.amount, case when p.payment_mode = 'Advance' then null else 'out' end,
           case when p.payment_mode = 'Advance' then 'Set off from an advance' end, p.payment_mode = 'Reimbursement'
    from vendor_bill_payments p
    left join vendor_bills b on b.id = p.bill_id
    left join vendors v on v.id = b.vendor_id
    where p.created_by = p_user

    union all
    select a.date, a.created_at, 'Vendor advance', 'vendor_advances', a.id,
           a.display_id, coalesce(v.name, ''), a.amount, 'out', null, a.payment_mode = 'Reimbursement'
    from vendor_advances a left join vendors v on v.id = a.vendor_id where a.created_by = p_user

    union all
    select coalesce(i.invoice_date, i.created_at::date), i.created_at, 'Invoice', 'invoices', i.id,
           coalesce(i.invoice_number, i.display_id), coalesce(c.name, ''),
           round(i.amount + i.amount * i.gst_pct / 100 - i.amount * i.tds_pct / 100, 2), null, i.status::text, false
    from invoices i left join clients c on c.id = i.client_id where i.created_by = p_user

    union all
    select p.date, p.created_at, case when p.is_retention_release then 'Retention received' else 'Client receipt' end, 'invoice_payments', p.id,
           p.display_id, concat_ws(' — ', c.name, coalesce(i.invoice_number, i.display_id)), p.amount, 'in', null, false
    from invoice_payments p
    left join invoices i on i.id = p.invoice_id
    left join clients c on c.id = i.client_id
    where p.created_by = p_user

    union all
    select n.date, n.created_at, case when n.note_type = 'credit' then 'Credit note' else 'Debit note' end, 'invoice_notes', n.id,
           n.display_id, concat_ws(' — ', c.name, coalesce(i.invoice_number, i.display_id)), n.net_amount, null, null, false
    from invoice_notes n
    left join invoices i on i.id = n.invoice_id
    left join clients c on c.id = i.client_id
    where n.created_by = p_user

    union all
    select t.date, t.created_at, 'Transfer', 'transfers', t.id,
           t.display_id, coalesce(f.name, 'Cash') || ' to ' || coalesce(a.name, 'Cash'), t.amount, null, null, false
    from transfers t
    left join bank_accounts f on f.id = t.from_account_id
    left join bank_accounts a on a.id = t.to_account_id
    where t.created_by = p_user

    union all
    select l.date_taken, l.created_at, 'Loan taken', 'loans', l.id,
           l.display_id, l.lender, l.principal, 'in', null, false
    from loans l where l.created_by = p_user

    union all
    select p.date, p.created_at, 'Loan repayment', 'loan_payments', p.id,
           p.display_id, coalesce(l.lender, ''), p.principal_paid + p.interest_paid, 'out', null, false
    from loan_payments p left join loans l on l.id = p.loan_id where p.created_by = p_user

    union all
    select k.date, k.created_at, case when k.type::text = 'injection' then 'Capital put in' else 'Capital withdrawn' end, 'capital_transactions', k.id,
           k.display_id, coalesce(pr.name, ''), k.amount, case when k.type::text = 'injection' then 'in' else 'out' end, null, false
    from capital_transactions k left join profiles pr on pr.id = k.partner_id where k.created_by = p_user

    union all
    select o.date, o.created_at, 'Other money received', 'other_receipts', o.id,
           o.display_id, concat_ws(' — ', o.kind, nullif(o.payer, '')), o.amount, 'in', null, false
    from other_receipts o where o.created_by = p_user

    union all
    select w.date, w.created_at, 'Wage payment', 'wage_payments', w.id,
           w.display_id, coalesce(s.name, ''), w.amount, 'out', null, false
    from wage_payments w left join staff s on s.id = w.staff_id where w.created_by = p_user

    union all
    select w.period_end, w.created_at, 'Wages due', 'wage_accruals', w.id,
           w.display_id, coalesce(s.name, ''), w.amount, null, null, false
    from wage_accruals w left join staff s on s.id = w.staff_id where w.created_by = p_user

    union all
    select m.date, m.created_at, case when m.kind = 'advance' then 'Site imprest given' else 'Site imprest returned' end, 'staff_imprest_transactions', m.id,
           m.display_id, concat_ws(' — ', pr.name, s.name), m.amount, case when m.kind = 'advance' then 'out' else 'in' end, m.status::text, coalesce(m.reimbursable, false)
    from staff_imprest_transactions m
    left join profiles pr on pr.id = m.profile_id
    left join staff s on s.id = m.staff_id
    where m.created_by = p_user

    union all
    select a.date, a.created_at, 'Salary advance', 'staff_salary_advances', a.id,
           a.display_id, coalesce(s.name, ''), a.amount, 'out', null, false
    from staff_salary_advances a left join staff s on s.id = a.staff_id where a.created_by = p_user

    union all
    select t.start_date, t.created_at, 'Trip', 'trips', t.id,
           t.display_id, t.name, null, null, t.status::text, false
    from trips t where t.created_by = p_user

    union all
    select o.as_on, o.created_at, 'Opening balance', 'account_openings', o.id,
           null, coalesce(b.name, 'Cash'), o.amount, null, null, false
    from account_openings o left join bank_accounts b on b.id = o.bank_account_id where o.created_by = p_user
  )
  select a.activity_date, a.recorded_at, a.kind, a.source_table, a.source_id, a.display_id, a.description, a.amount, a.direction, a.status, a.reimbursable
  from acts a
  where is_back_office()
    and (p_from is null or (case when p_by_recorded then a.recorded_at::date else a.activity_date end) >= p_from)
    and (p_to is null or (case when p_by_recorded then a.recorded_at::date else a.activity_date end) <= p_to)
  order by a.activity_date desc, a.recorded_at desc
$function$;

revoke execute on function activity_by_user(uuid, date, date, boolean) from public, anon;
grant execute on function activity_by_user(uuid, date, date, boolean) to authenticated;
