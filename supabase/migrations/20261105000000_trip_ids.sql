-- Trip IDs: TRP/MM/YY/#
--
-- A trip's ID now carries the month and year it started in, and its number within that month: the third trip that
-- started in October 2026 is TRP/10/26/3. It is given when the trip is made, and given again (with the next number of
-- the new month) if the start date is moved to a different month, so the ID always agrees with the month the trip is
-- listed under. Trips made before this get their IDs in the order they started.

create or replace function set_trip_display_id()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_prefix text;
  v_next int;
begin
  if TG_OP = 'INSERT' then
    if new.display_id is not null then
      return new;
    end if;
  elsif date_trunc('month', new.start_date) = date_trunc('month', old.start_date) then
    return new;
  end if;

  v_prefix := 'TRP/' || to_char(new.start_date, 'MM') || '/' || to_char(new.start_date, 'YY') || '/';
  -- One trip at a time takes a number, so two trips made together cannot get the same one.
  perform pg_advisory_xact_lock(hashtext('trip_display_id'));
  select coalesce(max(substring(t.display_id from length(v_prefix) + 1)::int), 0) + 1
    into v_next
  from trips t
  where t.display_id like v_prefix || '%'
    and substring(t.display_id from length(v_prefix) + 1) ~ '^[0-9]+$'
    and t.id <> new.id;
  new.display_id := v_prefix || v_next;
  return new;
end;
$function$;

revoke execute on function set_trip_display_id() from public, anon, authenticated;

drop trigger if exists trg_display_id on trips;
create trigger trg_trip_display_id before insert or update of start_date on trips for each row execute function set_trip_display_id();

-- Trips made before this: numbered within their start month, in the order they started.
update trips t
set display_id = n.new_id
from (
  select id,
         'TRP/' || to_char(start_date, 'MM') || '/' || to_char(start_date, 'YY') || '/' ||
           row_number() over (partition by date_trunc('month', start_date) order by start_date, created_at, id) as new_id
  from trips
) n
where n.id = t.id and t.display_id is distinct from n.new_id;
