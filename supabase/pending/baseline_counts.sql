-- Row counts and amount totals for every table that holds recorded data. Run before and after each migration; the two results must match.
select 'expenses' as tbl, count(*) as n, coalesce(sum(amount), 0) as total from expenses
union all select 'vendor_bills', count(*), coalesce(sum(amount), 0) from vendor_bills
union all select 'vendor_bill_payments', count(*), coalesce(sum(amount), 0) from vendor_bill_payments
union all select 'vendor_advances', count(*), coalesce(sum(amount), 0) from vendor_advances
union all select 'invoices', count(*), coalesce(sum(amount), 0) from invoices
union all select 'invoice_payments', count(*), coalesce(sum(amount), 0) from invoice_payments
union all select 'loans', count(*), coalesce(sum(principal), 0) from loans
union all select 'loan_payments', count(*), coalesce(sum(principal_paid + interest_paid), 0) from loan_payments
union all select 'capital_transactions', count(*), coalesce(sum(amount), 0) from capital_transactions
union all select 'transfers', count(*), coalesce(sum(amount), 0) from transfers
union all select 'other_receipts', count(*), coalesce(sum(amount), 0) from other_receipts
union all select 'wage_payments', count(*), coalesce(sum(amount), 0) from wage_payments
union all select 'wage_accruals', count(*), 0 from wage_accruals
union all select 'staff_salary_advances', count(*), coalesce(sum(amount), 0) from staff_salary_advances
union all select 'staff_imprest_transactions', count(*), coalesce(sum(amount), 0) from staff_imprest_transactions
union all select 'trips', count(*), 0 from trips
union all select 'journal_entries', count(*), 0 from journal_entries
union all select 'journal_lines (debit)', count(*), coalesce(sum(debit), 0) from journal_lines
union all select 'journal_lines (credit)', count(*), coalesce(sum(credit), 0) from journal_lines
union all select 'audit_log', count(*), 0 from audit_log
union all select 'bank_reconciliations', count(*), 0 from bank_reconciliations
order by 1;
