-- Replaces the flat expense_types list with a 2-level Chart of Accounts:
-- Category -> Sub-category. expenses.type keeps storing a plain-text
-- snapshot (e.g. "Category — Subcategory"), same historical-snapshot
-- philosophy as cost_center — renaming/deleting a category or sub-category
-- never touches already-logged expenses.

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table expense_categories enable row level security;

create table expense_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references expense_categories(id) on delete cascade,
  name text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (category_id, name)
);
alter table expense_subcategories enable row level security;

-- Migrate each existing expense_type 1:1 into its own category with a single
-- "General" sub-category — preserves all existing data losslessly; reorganize
-- via the Admin CoA section afterward.
insert into expense_categories (name)
select name from expense_types;

insert into expense_subcategories (category_id, name)
select ec.id, 'General'
from expense_categories ec;

drop policy "expense_types_select" on expense_types;
drop policy "expense_types_insert" on expense_types;
drop policy "expense_types_update" on expense_types;
drop policy "expense_types_delete" on expense_types;
drop table expense_types;

-- Categories: admin write, everyone read (matches the Tier A pattern).
create policy "expense_categories_select" on expense_categories for select using (auth.role() = 'authenticated');
create policy "expense_categories_insert" on expense_categories for insert with check (is_admin());
create policy "expense_categories_update" on expense_categories for update using (is_admin());
create policy "expense_categories_delete" on expense_categories for delete using (is_admin());

-- Sub-categories: insert open to any authenticated user (mirrors the old
-- expense_types inline "+ Add new" convenience on the expense form),
-- rename/delete admin-only.
create policy "expense_subcategories_select" on expense_subcategories for select using (auth.role() = 'authenticated');
create policy "expense_subcategories_insert" on expense_subcategories for insert with check (auth.role() = 'authenticated');
create policy "expense_subcategories_update" on expense_subcategories for update using (is_admin());
create policy "expense_subcategories_delete" on expense_subcategories for delete using (is_admin());

grant select, insert, update, delete on expense_categories to authenticated;
grant select, insert, update, delete on expense_subcategories to authenticated;
