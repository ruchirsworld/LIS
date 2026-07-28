-- Table/view/function-level GRANTs. RLS controls row visibility; these
-- control whether a role can even attempt the operation via PostgREST.
-- anon gets nothing (this is an internal, always-authenticated tool).

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

grant execute on all functions in schema public to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
