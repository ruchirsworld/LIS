-- Bugfix: next_display_id() used lpad(v_n::text, 2, '0') to zero-pad the
-- counter to 2 digits (e.g. 5 -> "05"). Postgres's lpad *truncates* rather
-- than leaving the value untouched once it's longer than the target width,
-- so once any (prefix, period) counter crossed 99, lpad('100', 2, '0')
-- returned '10' -- colliding with the row already created at counter=10.
-- Every insert against that prefix/period has failed with a duplicate key
-- violation since. Fix: only pad up to 2 digits, never truncate beyond the
-- counter's actual width.
create or replace function next_display_id(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := to_char(now(), 'MMYY');
  v_n int;
begin
  insert into id_sequences (prefix, period, counter)
  values (p_prefix, v_period, 1)
  on conflict (prefix, period) do update set counter = id_sequences.counter + 1
  returning counter into v_n;
  return p_prefix || '/' || v_period || '/' || lpad(v_n::text, greatest(2, length(v_n::text)), '0');
end;
$$;
