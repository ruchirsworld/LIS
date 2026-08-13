-- Tags move from being per-CoA-category to per-cost-center. Expense type
-- has been hardcoded to 'General' for a while now (see ExpenseForm), so
-- CoA's tags were really only ever surfacing the "General" category's list
-- regardless of which cost center a transaction was actually against —
-- cost center is the dimension that's actually visible/selected on the
-- Payments sheet, so tags belong there instead.
alter table cost_centers add column tags text[] not null default '{}';

-- Seed every cost center with the tags that were previously shown
-- everywhere (General's list), so nothing regresses in the Payments sheet
-- until an admin customizes each cost center's own set.
update cost_centers
set tags = (select tags from expense_categories where name = 'General' limit 1)
where (select tags from expense_categories where name = 'General' limit 1) is not null;

alter table expense_categories drop column tags;
