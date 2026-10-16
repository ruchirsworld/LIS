-- Money received that is not a client payment, a loan, partner capital or a transfer between our own accounts:
-- a security deposit given back, interest, a refund, the sale of scrap or an old item, or other income.
--
--  * 1080 Security Deposits (asset): deposits we have paid and will get back. A returned deposit reduces it.
--  * 4020 Other Income (income): everything else. It shows under "Other income" in the Profit and Loss.
-- An entry posts Dr cash or bank / Cr the account above.

insert into gl_accounts (code, name, account_type, normal_balance, sort_order)
select v.code, v.name, v.account_type, v.normal_balance, coalesce((select sort_order from gl_accounts where code = v.near), 0)
from (values
  ('1080', 'Security Deposits', 'asset',  'debit',  '1070'),
  ('4020', 'Other Income',      'income', 'credit', '4010')
) as v(code, name, account_type, normal_balance, near)
where not exists (select 1 from gl_accounts g where g.code = v.code);

create table if not exists other_receipts (
  id uuid primary key default gen_random_uuid(),
  display_id text unique,
  date date not null,
  amount numeric not null,
  kind text not null,
  payer text,
  notes text,
  reference text,
  payment_mode text not null default 'Bank',
  bank_account_id uuid references bank_accounts(id),
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint other_receipts_amount_pos check (amount > 0),
  constraint other_receipts_kind_check check (kind = any (array['security_deposit'::text, 'refund'::text, 'interest'::text, 'sale'::text, 'other'::text])),
  constraint other_receipts_payment_mode_check check (payment_mode = any (array['Cash'::text, 'Bank'::text]))
);
create index if not exists other_receipts_bank_account_id_idx on other_receipts (bank_account_id);
create index if not exists other_receipts_created_by_idx on other_receipts (created_by);

alter table other_receipts enable row level security;
create policy other_receipts_select on other_receipts for select using (is_back_office());
create policy other_receipts_insert on other_receipts for insert with check (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
create policy other_receipts_update on other_receipts for update using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
create policy other_receipts_delete on other_receipts for delete using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));

create or replace function post_other_receipt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_entry_id uuid;
begin
  delete from journal_lines
  where entry_id in (select id from journal_entries where source_table = 'other_receipts' and source_id = NEW.id);

  insert into journal_entries (date, description, source_table, source_id)
  values (NEW.date, 'Other receipt — ' || coalesce(NEW.display_id, ''), 'other_receipts', NEW.id)
  on conflict (source_table, source_id) do update
    set date = excluded.date, description = excluded.description
  returning id into v_entry_id;

  insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id) values
    (v_entry_id, cash_or_bank(NEW.bank_account_id), NEW.amount, 0, NEW.bank_account_id);
  insert into journal_lines (entry_id, gl_account_id, debit, credit) values
    (v_entry_id, gl_acct(case when NEW.kind = 'security_deposit' then '1080' else '4020' end), 0, NEW.amount);
  return NEW;
end;
$function$;

create or replace function unpost_other_receipt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from journal_lines
  where entry_id in (select id from journal_entries where source_table = 'other_receipts' and source_id = OLD.id);
  delete from journal_entries where source_table = 'other_receipts' and source_id = OLD.id;
  return OLD;
end;
$function$;

create trigger trg_display_id before insert on other_receipts for each row execute function set_display_id('Oth');
create trigger trg_round_amount before insert or update on other_receipts for each row execute function round_amount_2dp();
create trigger trg_post_other_receipt after insert on other_receipts for each row execute function post_other_receipt();
create trigger trg_post_other_receipt_update after update on other_receipts for each row execute function post_other_receipt();
create trigger trg_unpost_other_receipt after delete on other_receipts for each row execute function unpost_other_receipt();
create trigger trg_audit_update after update on other_receipts for each row execute function audit_row_change();
create trigger trg_audit_delete after delete on other_receipts for each row execute function audit_row_change();
