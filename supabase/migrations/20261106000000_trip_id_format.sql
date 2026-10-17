-- Trip IDs are now TRP-#/MMYY (for example TRP-3/1026: the third trip that started in October 2026).
-- Same rules as before: the number counts within the month the trip starts in, and the trip gets the next number of the
-- new month if its start date moves to a different month. Trips already numbered are renumbered into the new format.

create or replace function set_trip_display_id()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_mmyy text;
  v_next int;
begin
  if TG_OP = 'INSERT' then
    if new.display_id is not null then
      return new;
    end if;
  elsif date_trunc('month', new.start_date) = date_trunc('month', old.start_date) then
    return new;
  end if;

  v_mmyy := to_char(new.start_date, 'MMYY');
  -- One trip at a time takes a number, so two trips made together cannot get the same one.
  perform pg_advisory_xact_lock(hashtext('trip_display_id'));
  select coalesce(max((regexp_match(t.display_id, '^TRP-([0-9]+)/' || v_mmyy || '$'))[1]::int), 0) + 1
    into v_next
  from trips t
  where t.display_id ~ ('^TRP-[0-9]+/' || v_mmyy || '$')
    and t.id <> new.id;
  new.display_id := 'TRP-' || v_next || '/' || v_mmyy;
  return new;
end;
$function$;

revoke execute on function set_trip_display_id() from public, anon, authenticated;

-- Trips made before this: numbered within their start month, in the order they started.
update trips t
set display_id = n.new_id
from (
  select id,
         'TRP-' || row_number() over (partition by date_trunc('month', start_date) order by start_date, created_at, id) || '/' || to_char(start_date, 'MMYY') as new_id
  from trips
) n
where n.id = t.id and t.display_id is distinct from n.new_id;
