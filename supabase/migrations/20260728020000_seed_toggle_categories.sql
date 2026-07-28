-- Seeds a CoA category per Expense-form toggle option (General/Purchase/
-- Project/Loan/Capital) so admin has somewhere to attach tags that the
-- expense form can look up by the selected category.
insert into expense_categories (name) values
  ('General'),
  ('Purchase'),
  ('Project'),
  ('Loan'),
  ('Capital')
on conflict (name) do nothing;
