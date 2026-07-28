-- Atomic, server-side generation of "PREFIX/MMYY/NN" display IDs.
-- Replaces the prototype's client-side "count matching rows" approach, which
-- can hand out the same number twice under concurrent inserts.

create table id_sequences (
  prefix text not null,
  period text not null, -- 'MMYY'
  counter int not null default 0,
  primary key (prefix, period)
);

-- RLS is enabled with no policies below: nobody (not even authenticated users)
-- can read/write this table directly. It is only ever touched by
-- next_display_id(), which is SECURITY DEFINER and bypasses RLS deliberately.
alter table id_sequences enable row level security;

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
  return p_prefix || '/' || v_period || '/' || lpad(v_n::text, 2, '0');
end;
$$;

create or replace function set_display_id()
returns trigger
language plpgsql
as $$
begin
  if new.display_id is null then
    new.display_id := next_display_id(TG_ARGV[0]);
  end if;
  return new;
end;
$$;

create trigger trg_display_id before insert on clients for each row execute function set_display_id('Cus');
create trigger trg_display_id before insert on projects for each row execute function set_display_id('Proj');
create trigger trg_display_id before insert on invoices for each row execute function set_display_id('Inv');
create trigger trg_display_id before insert on vendors for each row execute function set_display_id('Ven');
create trigger trg_display_id before insert on vendor_bills for each row execute function set_display_id('Bill');
create trigger trg_display_id before insert on invoice_payments for each row execute function set_display_id('Pay');
create trigger trg_display_id before insert on vendor_bill_payments for each row execute function set_display_id('Pay');
create trigger trg_display_id before insert on loan_payments for each row execute function set_display_id('Pay');
create trigger trg_display_id before insert on expenses for each row execute function set_display_id('Exp');
create trigger trg_display_id before insert on loans for each row execute function set_display_id('Loan');
create trigger trg_display_id before insert on capital_transactions for each row execute function set_display_id('Cap');
create trigger trg_display_id before insert on employees for each row execute function set_display_id('Emp');
create trigger trg_display_id before insert on attendance for each row execute function set_display_id('Att');
create trigger trg_display_id before insert on team_tracker for each row execute function set_display_id('TT');
