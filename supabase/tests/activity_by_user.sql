-- Activity by user: an Admin sees what a person recorded, a supervisor sees nothing. Rolled back on purpose: the last statement always raises.
do $$
declare v_admin uuid; v_sup uuid; v_n int; v_s int;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  select id into v_sup from profiles where role = 'supervisor' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;
  select count(*) into v_n from activity_by_user(v_admin);
  if v_n = 0 then raise exception 'FAIL: an admin should see their own entries'; end if;
  if v_n <> (select count(*) from activity_by_user(v_admin, null, null, true)) then raise exception 'FAIL: recorded-date filter with no range should match'; end if;
  -- Sign in as a supervisor: both settings, or the database still sees the admin.
  perform set_config('request.jwt.claims', json_build_object('sub', v_sup, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_sup::text, true);
  select count(*) into v_s from activity_by_user(v_admin);
  if v_s <> 0 then raise exception 'FAIL: a supervisor should see nothing, got %', v_s; end if;
  raise exception 'PASS: admin sees % entries, a supervisor sees none', v_n;
end;
$$;
