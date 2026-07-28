-- Default picklists from the spec ("Seeded with…"). Renaming/removing these
-- afterward is an admin-only action (see RLS) and doesn't retroactively
-- change historical records, since cost_center/type are stored as text
-- snapshots on projects/expenses, not live FKs.

insert into cost_centers (name) values
  ('NAN-HQ (Delhi)'),
  ('Dehradun guest house'),
  ('Field / project site'),
  ('Marketing & travel')
on conflict (name) do nothing;

insert into expense_types (name) values
  ('Materials'),
  ('Labor / contractor'),
  ('Equipment rental'),
  ('Travel'),
  ('Lodging'),
  ('Food & beverages'),
  ('Snacks'),
  ('PR / marketing'),
  ('Petty cash & others'),
  ('Admin / office')
on conflict (name) do nothing;
