-- Replaces the Category -> Sub-category hierarchy with Category + a list of
-- suggested tags (reusing the app's existing #tag convention instead of a
-- rigid second dropdown level).
drop policy "expense_subcategories_select" on expense_subcategories;
drop policy "expense_subcategories_insert" on expense_subcategories;
drop policy "expense_subcategories_update" on expense_subcategories;
drop policy "expense_subcategories_delete" on expense_subcategories;
drop table expense_subcategories;

alter table expense_categories add column tags text[] not null default '{}';
