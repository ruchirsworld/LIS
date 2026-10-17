-- Phase 5 (additive only). Nothing here updates, deletes or backfills an existing row, and activity_by_user is left as it is.
--  1. activity_feed: every entry in every module, newest first by when it was entered. For one person it covers what they entered AND what was
--     entered on their behalf. Carries who entered it, on whose behalf, the cost centre / project / trip, whether a receipt is attached,
--     and the "checked" tick (record_reviews).
--  2. possible_duplicates: pairs of entries with the same amount, dates within 2 days and a person in common (entered by, on behalf of, or
--     to be reimbursed). Pairs a person has marked "not a duplicate" are flagged, not removed.
--  3. duplicate_dismissals: the new table that holds those "not a duplicate" marks.
-- Both functions run with the caller's permissions (row-level security applies, so trashed records never show) and return nothing unless
-- the caller is back-office.

create table if not exists duplicate_dismissals (
  key_a text not null,
  key_b text not null,
  dismissed_by uuid references profiles(id) default auth.uid(),
  dismissed_at timestamptz not null default now(),
  primary key (key_a, key_b),
  check (key_a < key_b)
);
create index if not exists duplicate_dismissals_by_idx on duplicate_dismissals (dismissed_by);
alter table duplicate_dismissals enable row level security;
create policy duplicate_dismissals_select on duplicate_dismissals for select using (is_back_office());
create policy duplicate_dismissals_insert on duplicate_dismissals for insert with check (is_back_office() and dismissed_by = auth.uid());
create policy duplicate_dismissals_delete on duplicate_dismissals for delete using (is_back_office());

create or replace function activity_feed(p_user uuid default null, p_from date default null, p_to date default null, p_by_recorded boolean default false)
returns table (
  activity_date date,
  recorded_at timestamptz,
  kind text,
  source_table text,
  source_id uuid,
  display_id text,
  description text,
  amount numeric,
  direction text,
  status text,
  reimbursable boolean,
  reimburse_to uuid,
  entered_by uuid,
  on_behalf_of uuid,
  cost_center text,
  project_name text,
  trip_name text,
  has_receipt boolean,
  checked_by uuid,
  checked_at timestamptz
)
language sql
stable
set search_path to 'public'
as $function$
  with acts as (
    select e.date as activity_date, e.created_at as recorded_at, 'Expense'::text as kind, 'expenses'::text as source_table, e.id as source_id,
           e.display_id, e.description, e.amount, 'out'::text as direction, e.status::text as status, coalesce(e.reimbursable, false) as reimbursable,
           e.reimburse_to, e.created_by as entered_by, e.on_behalf_of, e.cost_center, pr.name as project_name, tr.display_id as trip_name,
           (e.receipt_path is not null) as has_receipt
    from expenses e left join projects pr on pr.id = e.project_id left join trips tr on tr.id = e.trip_id

    union all
    select r.date, r.created_at, 'Reimbursement paid', 'expense_reimbursements', r.id,
           r.display_id, coalesce(x.description, ''), r.amount, 'out', null, false,
           null::uuid, r.created_by, null::uuid, null, null, null, null::boolean
    from expense_reimbursements r left join expenses x on x.id = r.expense_id

    union all
    select b.date, b.created_at, 'Vendor bill', 'vendor_bills', b.id,
           b.display_id, concat_ws(' — ', v.name, nullif(b.description, '')), c.payable, null, null, false,
           null::uuid, b.created_by, b.on_behalf_of, null, pr.name, null, (b.receipt_path is not null)
    from vendor_bills b
    left join vendors v on v.id = b.vendor_id
    left join v_vendor_bill_computed c on c.id = b.id
    left join projects pr on pr.id = b.project_id

    union all
    select p.date, p.created_at, 'Vendor payment', 'vendor_bill_payments', p.id,
           p.display_id, coalesce(v.name, ''), p.amount, case when p.payment_mode = 'Advance' then null else 'out' end,
           case when p.payment_mode = 'Advance' then 'Set off from an advance' end, p.payment_mode = 'Reimbursement',
           case when p.payment_mode = 'Reimbursement' then p.paid_by end, p.created_by, p.on_behalf_of, null, null, null, null::boolean
    from vendor_bill_payments p
    left join vendor_bills b on b.id = p.bill_id
    left join vendors v on v.id = b.vendor_id

    union all
    select a.date, a.created_at, 'Vendor advance', 'vendor_advances', a.id,
           a.display_id, coalesce(v.name, ''), a.amount, 'out', null, a.payment_mode = 'Reimbursement',
           null::uuid, a.created_by, a.on_behalf_of, null, null, null, null::boolean
    from vendor_advances a left join vendors v on v.id = a.vendor_id

    union all
    select coalesce(i.invoice_date, i.created_at::date), i.created_at, 'Invoice', 'invoices', i.id,
           coalesce(i.invoice_number, i.display_id), coalesce(c.name, ''),
           round(i.amount + i.amount * i.gst_pct / 100 - i.amount * i.tds_pct / 100, 2), null, i.status::text, false,
           null::uuid, i.created_by, i.on_behalf_of, null, pr.name, null, null::boolean
    from invoices i left join clients c on c.id = i.client_id left join projects pr on pr.id = i.project_id

    union all
    select p.date, p.created_at, case when p.is_retention_release then 'Retention received' else 'Client receipt' end, 'invoice_payments', p.id,
           p.display_id, concat_ws(' — ', c.name, coalesce(i.invoice_number, i.display_id)), p.amount, 'in', null, false,
           null::uuid, p.created_by, p.on_behalf_of, null, null, null, null::boolean
    from invoice_payments p
    left join invoices i on i.id = p.invoice_id
    left join clients c on c.id = i.client_id

    union all
    select n.date, n.created_at, case when n.note_type = 'credit' then 'Credit note' else 'Debit note' end, 'invoice_notes', n.id,
           n.display_id, concat_ws(' — ', c.name, coalesce(i.invoice_number, i.display_id)), n.net_amount, null, null, false,
           null::uuid, n.created_by, null::uuid, null, null, null, null::boolean
    from invoice_notes n
    left join invoices i on i.id = n.invoice_id
    left join clients c on c.id = i.client_id

    union all
    select t.date, t.created_at, 'Transfer', 'transfers', t.id,
           t.display_id, coalesce(f.name, 'Cash') || ' to ' || coalesce(a.name, 'Cash'), t.amount, null, null, false,
           null::uuid, t.created_by, t.on_behalf_of, null, null, null, null::boolean
    from transfers t
    left join bank_accounts f on f.id = t.from_account_id
    left join bank_accounts a on a.id = t.to_account_id

    union all
    select l.date_taken, l.created_at, 'Loan taken', 'loans', l.id,
           l.display_id, l.lender, l.principal, 'in', null, false,
           null::uuid, l.created_by, l.on_behalf_of, null, null, null, null::boolean
    from loans l

    union all
    select p.date, p.created_at, 'Loan repayment', 'loan_payments', p.id,
           p.display_id, coalesce(l.lender, ''), p.principal_paid + p.interest_paid, 'out', null, false,
           null::uuid, p.created_by, p.on_behalf_of, null, null, null, null::boolean
    from loan_payments p left join loans l on l.id = p.loan_id

    union all
    select k.date, k.created_at, case when k.type::text = 'injection' then 'Capital put in' else 'Capital withdrawn' end, 'capital_transactions', k.id,
           k.display_id, coalesce(pr.name, ''), k.amount, case when k.type::text = 'injection' then 'in' else 'out' end, null, false,
           null::uuid, k.created_by, k.on_behalf_of, null, null, null, null::boolean
    from capital_transactions k left join profiles pr on pr.id = k.partner_id

    union all
    select o.date, o.created_at, 'Other money received', 'other_receipts', o.id,
           o.display_id, concat_ws(' — ', o.kind, nullif(o.payer, '')), o.amount, 'in', null, false,
           null::uuid, o.created_by, o.on_behalf_of, null, null, null, null::boolean
    from other_receipts o

    union all
    select w.date, w.created_at, 'Wage payment', 'wage_payments', w.id,
           w.display_id, coalesce(s.name, ''), w.amount, 'out', null, false,
           null::uuid, w.created_by, null::uuid, null, null, null, null::boolean
    from wage_payments w left join staff s on s.id = w.staff_id

    union all
    select w.period_end, w.created_at, 'Wages due', 'wage_accruals', w.id,
           w.display_id, coalesce(s.name, ''), w.amount, null, null, false,
           null::uuid, w.created_by, null::uuid, null, null, null, null::boolean
    from wage_accruals w left join staff s on s.id = w.staff_id

    union all
    select m.date, m.created_at, case when m.kind = 'advance' then 'Site imprest given' else 'Site imprest returned' end, 'staff_imprest_transactions', m.id,
           m.display_id, concat_ws(' — ', pr.name, s.name), m.amount, case when m.kind = 'advance' then 'out' else 'in' end, m.status::text, coalesce(m.reimbursable, false),
           null::uuid, m.created_by, null::uuid, null, null, null, null::boolean
    from staff_imprest_transactions m
    left join profiles pr on pr.id = m.profile_id
    left join staff s on s.id = m.staff_id

    union all
    select a.date, a.created_at, 'Salary advance', 'staff_salary_advances', a.id,
           a.display_id, coalesce(s.name, ''), a.amount, 'out', null, false,
           null::uuid, a.created_by, null::uuid, null, null, null, null::boolean
    from staff_salary_advances a left join staff s on s.id = a.staff_id

    union all
    select t.start_date, t.created_at, 'Trip', 'trips', t.id,
           t.display_id, t.name, null, null, t.status::text, false,
           null::uuid, t.created_by, null::uuid, null, null, null, null::boolean
    from trips t

    union all
    select o.as_on, o.created_at, 'Opening balance', 'account_openings', o.id,
           null, coalesce(b.name, 'Cash'), o.amount, null, null, false,
           null::uuid, o.created_by, null::uuid, null, null, null, null::boolean
    from account_openings o left join bank_accounts b on b.id = o.bank_account_id
  )
  select a.activity_date, a.recorded_at, a.kind, a.source_table, a.source_id, a.display_id, a.description, a.amount, a.direction, a.status,
         a.reimbursable, a.reimburse_to, a.entered_by, a.on_behalf_of, a.cost_center, a.project_name, a.trip_name, a.has_receipt,
         rv.reviewed_by, rv.reviewed_at
  from acts a
  left join record_reviews rv on rv.table_name = a.source_table and rv.record_id = a.source_id
  where is_back_office()
    and (p_user is null or a.entered_by = p_user or a.on_behalf_of = p_user)
    and (p_from is null or (case when p_by_recorded then a.recorded_at::date else a.activity_date end) >= p_from)
    and (p_to is null or (case when p_by_recorded then a.recorded_at::date else a.activity_date end) <= p_to)
  order by a.recorded_at desc
$function$;

create or replace function possible_duplicates(p_from date default null, p_to date default null)
returns table (
  a_table text, a_id uuid, a_display_id text, a_kind text, a_date date, a_recorded_at timestamptz, a_description text, a_entered_by uuid,
  b_table text, b_id uuid, b_display_id text, b_kind text, b_date date, b_recorded_at timestamptz, b_description text, b_entered_by uuid,
  amount numeric, dismissed boolean
)
language sql
stable
set search_path to 'public'
as $function$
  with m as (
    select 'expenses'::text as source_table, e.id as source_id, e.display_id, 'Expense'::text as kind, e.date, e.amount, e.created_by as entered_by,
           e.on_behalf_of, e.reimburse_to as reimbursed_to, e.created_at as recorded_at, e.description
    from expenses e
    union all
    select 'vendor_bill_payments', p.id, p.display_id, 'Vendor payment', p.date, p.amount, p.created_by, p.on_behalf_of,
           case when p.payment_mode = 'Reimbursement' then p.paid_by end, p.created_at, coalesce(v.name, '')
    from vendor_bill_payments p left join vendor_bills b on b.id = p.bill_id left join vendors v on v.id = b.vendor_id
    where p.payment_mode is distinct from 'Advance'
    union all
    select 'vendor_advances', a.id, a.display_id, 'Vendor advance', a.date, a.amount, a.created_by, a.on_behalf_of, null::uuid, a.created_at, coalesce(v.name, '')
    from vendor_advances a left join vendors v on v.id = a.vendor_id
    union all
    select 'transfers', t.id, t.display_id, 'Transfer', t.date, t.amount, t.created_by, t.on_behalf_of, null::uuid, t.created_at, coalesce(t.notes, 'Transfer')
    from transfers t
    union all
    select 'capital_transactions', k.id, k.display_id, 'Capital', k.date, k.amount, k.created_by, k.on_behalf_of, null::uuid, k.created_at, coalesce(k.notes, '')
    from capital_transactions k
    union all
    select 'invoice_payments', p.id, p.display_id, 'Client receipt', p.date, p.amount, p.created_by, p.on_behalf_of, null::uuid, p.created_at, coalesce(p.reference, '')
    from invoice_payments p
    union all
    select 'other_receipts', o.id, o.display_id, 'Other money received', o.date, o.amount, o.created_by, o.on_behalf_of, null::uuid, o.created_at, coalesce(o.payer, '')
    from other_receipts o
    union all
    select 'loan_payments', p.id, p.display_id, 'Loan repayment', p.date, p.principal_paid + p.interest_paid, p.created_by, p.on_behalf_of, null::uuid, p.created_at, coalesce(p.reference, '')
    from loan_payments p
    union all
    select 'wage_payments', w.id, w.display_id, 'Wage payment', w.date, w.amount, w.created_by, null::uuid, null::uuid, w.created_at, coalesce(w.notes, '')
    from wage_payments w
    union all
    select 'staff_salary_advances', a.id, a.display_id, 'Salary advance', a.date, a.amount, a.created_by, null::uuid, null::uuid, a.created_at, coalesce(a.remarks, '')
    from staff_salary_advances a
    union all
    select 'staff_imprest_transactions', i.id, i.display_id, 'Site imprest', i.date, i.amount, i.created_by, null::uuid, null::uuid, i.created_at, coalesce(i.remarks, '')
    from staff_imprest_transactions i
  ),
  k as (
    select m.*, m.source_table || ':' || m.source_id as key,
           array_remove(array[m.entered_by, m.on_behalf_of, m.reimbursed_to], null) as persons
    from m
    where m.amount is not null and m.amount > 0
  )
  select a.source_table, a.source_id, a.display_id, a.kind, a.date, a.recorded_at, a.description, a.entered_by,
         b.source_table, b.source_id, b.display_id, b.kind, b.date, b.recorded_at, b.description, b.entered_by,
         a.amount,
         exists (select 1 from duplicate_dismissals d where d.key_a = a.key and d.key_b = b.key)
  from k a
  join k b on a.amount = b.amount and a.key < b.key and abs(a.date - b.date) <= 2 and a.persons && b.persons
  where is_back_office()
    and (p_from is null or a.date >= p_from or b.date >= p_from)
    and (p_to is null or a.date <= p_to or b.date <= p_to)
  order by a.amount desc, a.date desc
$function$;

grant execute on function activity_feed(uuid, date, date, boolean) to authenticated;
grant execute on function possible_duplicates(date, date) to authenticated;
