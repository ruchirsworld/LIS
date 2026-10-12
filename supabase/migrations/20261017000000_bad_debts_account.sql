-- Bad debts written off — the expense side of writing off an irrecoverable receivable.
insert into gl_accounts (code, name, account_type, normal_balance, sort_order)
select '5110', 'Bad Debts Written Off', 'expense', 'debit', coalesce((select sort_order from gl_accounts where code = '5100'), 0)
where not exists (select 1 from gl_accounts where code = '5110');
