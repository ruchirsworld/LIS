-- Admin-curated flat tag list — quick-insert suggestions on Expenses and
-- Team Tracker, and scopes the Dashboard's "By tag" breakdown to tags admin
-- has actually defined. Tier A (admin write, everyone read), same shape as
-- cost_centers/partners.
create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table tags enable row level security;

create policy "tags_select" on tags for select using (auth.role() = 'authenticated');
create policy "tags_insert" on tags for insert with check (is_admin());
create policy "tags_update" on tags for update using (is_admin());
create policy "tags_delete" on tags for delete using (is_admin());

grant select, insert, update, delete on tags to authenticated;
