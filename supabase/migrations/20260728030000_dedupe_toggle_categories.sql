-- The previous migration seeded 'Purchase' and 'Loan' without knowing admin
-- had already created 'Purchases' and 'Loans' for real use. Drop the
-- redundant empty duplicates (guarded to only ever touch tag-less rows).
delete from expense_categories
where name in ('Purchase', 'Loan')
  and coalesce(array_length(tags, 1), 0) = 0;
