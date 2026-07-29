-- Drop the "MMYY" period segment from every record ID (e.g. Exp/0726/21 ->
-- Exp/21). Renumbers every existing row across all 14 tables in
-- chronological order (by created_at, the same order next_display_id()
-- originally handed numbers out in), then switches next_display_id() to a
-- simple per-prefix counter with no period, so future IDs never reset or
-- collide across months.

-- Step 1: two-phase renumber (null out first, since NULLs never collide
-- under a unique constraint, then assign fresh sequential values) for every
-- table that has its own dedicated prefix.
do $$
declare
  pairs text[][] := array[
    array['clients','Cus'], array['projects','Proj'], array['invoices','Inv'], array['vendors','Ven'],
    array['vendor_bills','Bill'], array['expenses','Exp'], array['loans','Loan'],
    array['capital_transactions','Cap'], array['employees','Emp'], array['attendance','Att'],
    array['team_tracker','TT'], array['transfers','Trf']
  ];
  pair text[];
  t text;
  p text;
begin
  foreach pair slice 1 in array pairs loop
    t := pair[1];
    p := pair[2];
    execute format('update %I set display_id = null', t);
    execute format(
      'with ranked as (select id, row_number() over (order by created_at, id) as rn from %1$I)
       update %1$I t set display_id = %2$L || ''/'' || lpad(ranked.rn::text, greatest(2, length(ranked.rn::text)), ''0'')
       from ranked where ranked.id = t.id',
      t, p
    );
  end loop;
end $$;

-- Step 2: the shared "Pay" prefix spans invoice_payments, vendor_bill_payments
-- and loan_payments (one combined counter across all three) -- renumber them
-- together in one chronological sequence.
update invoice_payments set display_id = null;
update vendor_bill_payments set display_id = null;
update loan_payments set display_id = null;

with combined as (
  select 'invoice_payments'::text as tbl, id, created_at from invoice_payments
  union all
  select 'vendor_bill_payments'::text, id, created_at from vendor_bill_payments
  union all
  select 'loan_payments'::text, id, created_at from loan_payments
),
ranked as (
  select tbl, id, row_number() over (order by created_at, id) as rn from combined
)
update invoice_payments t set display_id = 'Pay/' || lpad(ranked.rn::text, greatest(2, length(ranked.rn::text)), '0')
from ranked where ranked.tbl = 'invoice_payments' and ranked.id = t.id;

with combined as (
  select 'invoice_payments'::text as tbl, id, created_at from invoice_payments
  union all
  select 'vendor_bill_payments'::text, id, created_at from vendor_bill_payments
  union all
  select 'loan_payments'::text, id, created_at from loan_payments
),
ranked as (
  select tbl, id, row_number() over (order by created_at, id) as rn from combined
)
update vendor_bill_payments t set display_id = 'Pay/' || lpad(ranked.rn::text, greatest(2, length(ranked.rn::text)), '0')
from ranked where ranked.tbl = 'vendor_bill_payments' and ranked.id = t.id;

with combined as (
  select 'invoice_payments'::text as tbl, id, created_at from invoice_payments
  union all
  select 'vendor_bill_payments'::text, id, created_at from vendor_bill_payments
  union all
  select 'loan_payments'::text, id, created_at from loan_payments
),
ranked as (
  select tbl, id, row_number() over (order by created_at, id) as rn from combined
)
update loan_payments t set display_id = 'Pay/' || lpad(ranked.rn::text, greatest(2, length(ranked.rn::text)), '0')
from ranked where ranked.tbl = 'loan_payments' and ranked.id = t.id;

-- Step 3: id_sequences no longer tracks a period -- one running counter per
-- prefix, seeded to match the renumbering above so future inserts continue
-- from the right place.
truncate table id_sequences;
alter table id_sequences drop constraint id_sequences_pkey;
alter table id_sequences drop column period;
alter table id_sequences add primary key (prefix);

insert into id_sequences (prefix, counter) values
  ('Cus', (select count(*) from clients)),
  ('Proj', (select count(*) from projects)),
  ('Inv', (select count(*) from invoices)),
  ('Ven', (select count(*) from vendors)),
  ('Bill', (select count(*) from vendor_bills)),
  ('Exp', (select count(*) from expenses)),
  ('Loan', (select count(*) from loans)),
  ('Cap', (select count(*) from capital_transactions)),
  ('Emp', (select count(*) from employees)),
  ('Att', (select count(*) from attendance)),
  ('TT', (select count(*) from team_tracker)),
  ('Trf', (select count(*) from transfers)),
  ('Pay', (select count(*) from invoice_payments) + (select count(*) from vendor_bill_payments) + (select count(*) from loan_payments))
on conflict (prefix) do update set counter = excluded.counter;

-- Step 4: next_display_id() drops the period segment entirely.
create or replace function next_display_id(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  insert into id_sequences (prefix, counter)
  values (p_prefix, 1)
  on conflict (prefix) do update set counter = id_sequences.counter + 1
  returning counter into v_n;
  return p_prefix || '/' || lpad(v_n::text, greatest(2, length(v_n::text)), '0');
end;
$$;
