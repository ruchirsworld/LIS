-- Phone becomes the login identifier for newly-provisioned users (paired with
-- a 6-digit PIN as the Supabase Auth password, via a synthesized internal
-- email — see supabase/functions/admin-create-user). Existing accounts that
-- signed up with a real email/password keep working unchanged; phone is
-- simply null for them.
alter table profiles add column phone text unique;

-- Optional link from a Staff account to a specific Employee record, so
-- Attendance can be scoped to "their own" records. Admin/CXO don't need this.
alter table profiles add column employee_id uuid references employees(id) on delete set null;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, phone, employee_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'staff'),
    new.raw_user_meta_data->>'phone',
    nullif(new.raw_user_meta_data->>'employee_id', '')::uuid
  );
  return new;
end;
$$;
