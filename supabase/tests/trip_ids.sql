-- Trip IDs are TRP/MM/YY/# and follow the month the trip starts in. Rolled back on purpose: the last statement always raises.
do $$
declare
  v_admin uuid; v_a text; v_b text; v_moved text; v_first int;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  set local role authenticated;

  -- 1. A new trip takes the next number of the month it starts in.
  insert into trips (name, traveler_id, start_date, status) values ('TEST A', v_admin, '2030-10-20', 'open') returning display_id into v_a;
  if v_a <> 'TRP/10/30/1' then raise exception 'FAIL: the first trip of Oct 2030 should be TRP/10/30/1, got %', v_a; end if;
  insert into trips (name, traveler_id, start_date, status) values ('TEST B', v_admin, '2030-10-25', 'open') returning display_id into v_b;
  if v_b <> 'TRP/10/30/2' then raise exception 'FAIL: the second trip should be TRP/10/30/2, got %', v_b; end if;

  -- 2. Moving the start date inside the month keeps the ID.
  update trips set start_date = '2030-10-28' where name = 'TEST A';
  select display_id into v_moved from trips where name = 'TEST A';
  if v_moved <> v_a then raise exception 'FAIL: a move inside the month should keep % but it is now %', v_a, v_moved; end if;

  -- 3. Moving it to another month gives it the next number of that month.
  update trips set start_date = '2030-11-03' where name = 'TEST A';
  select display_id into v_moved from trips where name = 'TEST A';
  if v_moved <> 'TRP/11/30/1' then raise exception 'FAIL: a move to November should give TRP/11/30/1, got %', v_moved; end if;

  -- 4. The number it left behind is not reused by mistake: the next October trip follows the highest.
  insert into trips (name, traveler_id, start_date, status) values ('TEST C', v_admin, '2030-10-30', 'open') returning display_id into v_b;
  if v_b <> 'TRP/10/30/3' then raise exception 'FAIL: the next October trip should be TRP/10/30/3, got %', v_b; end if;

  -- 5. No two trips share an ID.
  select count(*) - count(distinct display_id) into v_first from trips;
  if v_first <> 0 then raise exception 'FAIL: % trips share an ID', v_first; end if;

  raise exception 'PASS: trip IDs are TRP/MM/YY/# and follow the start month';
end;
$$;
