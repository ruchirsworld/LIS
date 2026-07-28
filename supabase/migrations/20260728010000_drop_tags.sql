-- Rolling back the flat global tags table — tags are being redone as
-- per-CoA-category (expense_categories.tags), scoped to the expense form's
-- category toggle instead of one global list.
drop policy "tags_select" on tags;
drop policy "tags_insert" on tags;
drop policy "tags_update" on tags;
drop policy "tags_delete" on tags;
drop table tags;
