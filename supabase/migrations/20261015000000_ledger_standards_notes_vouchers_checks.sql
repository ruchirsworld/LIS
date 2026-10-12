-- Ledger brought in line with Indian accounting practice (documents and controls).
--
--  * Credit / debit notes against an issued invoice (GST Section 34) — the
--    invoice itself stays as issued; the note carries the change and posts its
--    own entry. Invoice net, GST, TDS and retention in v_invoice_computed
--    include the notes.
--  * Manual journal vouchers (GST payment / set-off, write-offs, corrections),
--    posted only through post_journal_voucher() so they always balance.
--  * books_health_check(): a list of everything in the books that needs a
--    look, with severity.
--  * GST posting is shared (post_gst_lines) so invoices and notes split by
--    place of supply the same way.

-- ── Shared GST posting ────────────────────────────────────────────────────
create or replace function post_gst_lines(p_entry uuid, p_client uuid, p_gst numeric, p_credit boolean)
returns void language plpgsql set search_path to 'public' as $$
declare
  v_company text := company_state_code();
  v_client text := client_state_code(p_client);
  v_cgst numeric;
  v_sgst numeric;
begin
  if p_gst is null or p_gst <= 0 then return; end if;
  if v_company is not null and v_client is not null then
    if v_company = v_client then
      v_cgst := round(p_gst / 2, 2);
      v_sgst := p_gst - v_cgst;
      insert into journal_lines (entry_id, gl_account_id, debit, credit)
      values (p_entry, gl_acct('2031'), case when p_credit then 0 else v_cgst end, case when p_credit then v_cgst else 0 end),
             (p_entry, gl_acct('2032'), case when p_credit then 0 else v_sgst end, case when p_credit then v_sgst else 0 end);
    else
      insert into journal_lines (entry_id, gl_account_id, debit, credit)
      values (p_entry, gl_acct('2033'), case when p_credit then 0 else p_gst end, case when p_credit then p_gst else 0 end);
    end if;
  else
    -- Place of supply unknown (company or client GSTIN missing).
    insert into journal_lines (entry_id, gl_account_id, debit, credit)
    values (p_entry, gl_acct('2030'), case when p_credit then 0 else p_gst end, case when p_credit then p_gst else 0 end);
  end if;
end;
$$;

create or replace function repost_invoice_entry(p_invoice_id uuid) returns void
language plpgsql set search_path to 'public' as $$
declare
  i invoices%rowtype;
  v_entry uuid;
  v_gst numeric; v_tds numeric; v_net numeric; v_ret numeric;
  r record;
begin
  select * into i from invoices where id = p_invoice_id;
  if not found or i.status <> 'sent' or i.invoice_date is null then
    delete from journal_entries where source_table = 'invoices' and source_id = p_invoice_id;
    for r in select id from invoice_payments where invoice_id = p_invoice_id loop
      perform repost_invoice_payment(r.id);
    end loop;
    perform repost_invoice_advance(p_invoice_id);
    return;
  end if;

  v_gst := round(i.amount * i.gst_pct / 100, 2);
  v_tds := round(i.amount * i.tds_pct / 100, 2);
  v_net := i.amount + v_gst - v_tds;
  v_ret := round(v_net * coalesce(i.retention_pct, 0) / 100, 2);

  insert into journal_entries (date, description, source_table, source_id)
  values (i.invoice_date, 'Invoice ' || coalesce(i.invoice_number, i.display_id, ''), 'invoices', i.id)
  on conflict (source_table, source_id) do update set date = excluded.date, description = excluded.description
  returning id into v_entry;

  delete from journal_lines where entry_id = v_entry;

  if v_net - v_ret > 0 then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, project_id, client_id)
    values (v_entry, gl_acct('1030'), v_net - v_ret, 0, i.project_id, i.client_id);
  end if;
  if v_ret > 0 then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, project_id, client_id)
    values (v_entry, gl_acct('1035'), v_ret, 0, i.project_id, i.client_id);
  end if;
  if v_tds > 0 then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, client_id)
    values (v_entry, gl_acct('1040'), v_tds, 0, i.client_id);
  end if;
  insert into journal_lines (entry_id, gl_account_id, debit, credit, project_id)
  values (v_entry, gl_acct('4010'), 0, i.amount, i.project_id);
  perform post_gst_lines(v_entry, i.client_id, v_gst, true);

  for r in select id from invoice_payments where invoice_id = p_invoice_id loop
    perform repost_invoice_payment(r.id);
  end loop;
  perform repost_invoice_advance(p_invoice_id);
end;
$$;

-- ── Credit / debit notes ──────────────────────────────────────────────────
create table if not exists invoice_notes (
  id uuid primary key default gen_random_uuid(),
  display_id text,
  invoice_id uuid not null references invoices(id) on delete restrict,
  note_type text not null check (note_type in ('credit', 'debit')),
  date date not null,
  amount numeric not null check (amount > 0),
  gst_pct numeric not null default 0,
  tds_pct numeric not null default 0,
  gst_amount numeric not null default 0,
  tds_amount numeric not null default 0,
  net_amount numeric not null default 0,
  retention_amount numeric not null default 0,
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists invoice_notes_invoice_idx on invoice_notes (invoice_id);

alter table invoice_notes enable row level security;
drop policy if exists invoice_notes_select on invoice_notes;
create policy invoice_notes_select on invoice_notes for select using (auth.role() = 'authenticated');
drop policy if exists invoice_notes_insert on invoice_notes;
create policy invoice_notes_insert on invoice_notes for insert
  with check (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
drop policy if exists invoice_notes_update on invoice_notes;
create policy invoice_notes_update on invoice_notes for update
  using (current_user_role() = any (array['admin'::user_role, 'cxo'::user_role]));
drop policy if exists invoice_notes_delete on invoice_notes;
create policy invoice_notes_delete on invoice_notes for delete using (current_user_role() = 'admin'::user_role);

create or replace function prepare_invoice_note() returns trigger
language plpgsql set search_path to 'public' as $$
declare
  inv invoices%rowtype;
  v_headroom numeric;
begin
  select * into inv from invoices where id = new.invoice_id;
  if inv.status <> 'sent' or inv.invoice_date is null then
    raise exception 'Credit and debit notes can only be raised against an invoice that has been sent.';
  end if;
  if new.date < inv.invoice_date then
    raise exception 'A note cannot be dated before its invoice (%).', to_char(inv.invoice_date, 'DD Mon YYYY');
  end if;
  new.amount := round(new.amount, 2);
  if tg_op = 'INSERT' then
    -- The note carries the invoice's own tax rates, so it reverses exactly what was charged.
    new.gst_pct := inv.gst_pct;
    new.tds_pct := inv.tds_pct;
    new.display_id := coalesce(new.display_id, next_display_id(case when new.note_type = 'credit' then 'CN' else 'DN' end));
  end if;
  new.gst_amount := round(new.amount * new.gst_pct / 100, 2);
  new.tds_amount := round(new.amount * new.tds_pct / 100, 2);
  new.net_amount := new.amount + new.gst_amount - new.tds_amount;
  new.retention_amount := round(new.net_amount * coalesce(inv.retention_pct, 0) / 100, 2);

  if new.note_type = 'credit' then
    select inv.amount
           + coalesce((select sum(case when n.note_type = 'debit' then n.amount else -n.amount end)
                       from invoice_notes n where n.invoice_id = new.invoice_id and n.id <> new.id), 0)
      into v_headroom;
    if new.amount > v_headroom + 0.005 then
      raise exception 'A credit note cannot exceed what is left of the invoice (% before GST).', round(v_headroom, 2);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_prepare_note on invoice_notes;
create trigger trg_prepare_note before insert or update on invoice_notes for each row execute function prepare_invoice_note();

create or replace function repost_invoice_note(p_id uuid) returns void
language plpgsql set search_path to 'public' as $$
declare
  n invoice_notes%rowtype;
  inv invoices%rowtype;
  v_entry uuid;
  v_credit boolean;
begin
  select * into n from invoice_notes where id = p_id;
  if not found then return; end if;
  select * into inv from invoices where id = n.invoice_id;
  v_credit := n.note_type = 'credit';

  insert into journal_entries (date, description, source_table, source_id)
  values (n.date,
          case when v_credit then 'Credit note ' else 'Debit note ' end || coalesce(n.display_id, '') ||
            ' against invoice ' || coalesce(inv.invoice_number, inv.display_id, ''),
          'invoice_notes', n.id)
  on conflict (source_table, source_id) do update set date = excluded.date, description = excluded.description
  returning id into v_entry;
  delete from journal_lines where entry_id = v_entry;

  -- A credit note is the invoice's entry the other way round; a debit note is the same direction.
  insert into journal_lines (entry_id, gl_account_id, debit, credit, project_id)
  values (v_entry, gl_acct('4010'), case when v_credit then n.amount else 0 end, case when v_credit then 0 else n.amount end, inv.project_id);
  perform post_gst_lines(v_entry, inv.client_id, n.gst_amount, not v_credit);
  if n.net_amount - n.retention_amount > 0 then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, project_id, client_id)
    values (v_entry, gl_acct('1030'), case when v_credit then 0 else n.net_amount - n.retention_amount end,
            case when v_credit then n.net_amount - n.retention_amount else 0 end, inv.project_id, inv.client_id);
  end if;
  if n.retention_amount > 0 then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, project_id, client_id)
    values (v_entry, gl_acct('1035'), case when v_credit then 0 else n.retention_amount end,
            case when v_credit then n.retention_amount else 0 end, inv.project_id, inv.client_id);
  end if;
  if n.tds_amount > 0 then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, client_id)
    values (v_entry, gl_acct('1040'), case when v_credit then 0 else n.tds_amount end,
            case when v_credit then n.tds_amount else 0 end, inv.client_id);
  end if;
end;
$$;

create or replace function post_invoice_note() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  perform repost_invoice_note(new.id);
  return new;
end;
$$;
create or replace function unpost_invoice_note() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  delete from journal_entries where source_table = 'invoice_notes' and source_id = old.id;
  return old;
end;
$$;
drop trigger if exists trg_post_note on invoice_notes;
create trigger trg_post_note after insert or update on invoice_notes for each row execute function post_invoice_note();
drop trigger if exists trg_unpost_note on invoice_notes;
create trigger trg_unpost_note after delete on invoice_notes for each row execute function unpost_invoice_note();
drop trigger if exists trg_audit_update on invoice_notes;
create trigger trg_audit_update after update on invoice_notes for each row execute function audit_row_change();
drop trigger if exists trg_audit_delete on invoice_notes;
create trigger trg_audit_delete after delete on invoice_notes for each row execute function audit_row_change();

-- Invoice figures now include its notes (original invoice + debit notes - credit notes).
create or replace view v_invoice_computed as
select
  i.id, i.display_id, i.client_id, i.project_id, i.amount, i.gst_pct, i.tds_pct, i.due_date_manual, i.due_days,
  i.invoice_date, i.status, i.created_by, i.created_at,
  (round(i.amount * i.gst_pct / 100::numeric, 2) + coalesce(n.gst, 0)) as gst_amt,
  (round(i.amount * i.tds_pct / 100::numeric, 2) + coalesce(n.tds, 0)) as tds_amt,
  (i.amount + round(i.amount * i.gst_pct / 100::numeric, 2) - round(i.amount * i.tds_pct / 100::numeric, 2) + coalesce(n.net, 0)) as net_payable,
  coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = i.id), 0::numeric) as total_paid,
  case when i.due_days is not null and i.invoice_date is not null then i.invoice_date + i.due_days else i.due_date_manual end as effective_due_date,
  i.retention_pct,
  (round((i.amount + round(i.amount * i.gst_pct / 100::numeric, 2) - round(i.amount * i.tds_pct / 100::numeric, 2)) * i.retention_pct / 100::numeric, 2) + coalesce(n.ret, 0)) as retention_amount,
  coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = i.id and p.is_retention_release), 0::numeric) as released_paid,
  coalesce(n.amt, 0) as note_amount
from invoices i
left join (
  select invoice_id,
         sum(case when note_type = 'credit' then -amount else amount end) as amt,
         sum(case when note_type = 'credit' then -gst_amount else gst_amount end) as gst,
         sum(case when note_type = 'credit' then -tds_amount else tds_amount end) as tds,
         sum(case when note_type = 'credit' then -net_amount else net_amount end) as net,
         sum(case when note_type = 'credit' then -retention_amount else retention_amount end) as ret
  from invoice_notes group by invoice_id
) n on n.invoice_id = i.id;
alter view v_invoice_computed set (security_invoker = true);

-- ── Manual journal vouchers ───────────────────────────────────────────────
create or replace function post_journal_voucher(p_date date, p_narration text, p_lines jsonb)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_entry uuid;
  v_line jsonb;
  v_dr numeric := 0;
  v_cr numeric := 0;
  v_acct uuid;
  v_d numeric;
  v_c numeric;
  v_count int := 0;
begin
  if current_user_role() is null or current_user_role() not in ('admin', 'cxo') then
    raise exception 'Only an Admin or CXO can post a journal voucher.';
  end if;
  if p_date is null then raise exception 'A journal voucher needs a date.'; end if;
  if p_narration is null or length(trim(p_narration)) = 0 then raise exception 'A journal voucher needs a narration.'; end if;
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'Lines must be a list.'; end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_acct := gl_acct(v_line ->> 'account_code');
    if v_acct is null then raise exception 'Unknown account %.', v_line ->> 'account_code'; end if;
    v_d := round(coalesce((v_line ->> 'debit')::numeric, 0), 2);
    v_c := round(coalesce((v_line ->> 'credit')::numeric, 0), 2);
    if (v_d > 0 and v_c > 0) or (v_d = 0 and v_c = 0) or v_d < 0 or v_c < 0 then
      raise exception 'Each line needs either a debit or a credit amount.';
    end if;
    v_dr := v_dr + v_d;
    v_cr := v_cr + v_c;
    v_count := v_count + 1;
  end loop;
  if v_count < 2 then raise exception 'A journal voucher needs at least two lines.'; end if;
  if abs(v_dr - v_cr) > 0.005 then
    raise exception 'The voucher does not balance: debits % and credits %.', v_dr, v_cr;
  end if;

  insert into journal_entries (date, description, source_table, source_id)
  values (p_date, trim(p_narration), 'manual_journal', gen_random_uuid())
  returning id into v_entry;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into journal_lines (entry_id, gl_account_id, debit, credit, client_id, vendor_id, project_id, bank_account_id)
    values (v_entry, gl_acct(v_line ->> 'account_code'),
            round(coalesce((v_line ->> 'debit')::numeric, 0), 2), round(coalesce((v_line ->> 'credit')::numeric, 0), 2),
            nullif(v_line ->> 'client_id', '')::uuid, nullif(v_line ->> 'vendor_id', '')::uuid,
            nullif(v_line ->> 'project_id', '')::uuid, nullif(v_line ->> 'bank_account_id', '')::uuid);
  end loop;
  return v_entry;
end;
$$;

create or replace function delete_journal_voucher(p_entry uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare e journal_entries%rowtype;
begin
  if current_user_role() is distinct from 'admin'::user_role then
    raise exception 'Only an Admin can delete a journal voucher.';
  end if;
  select * into e from journal_entries where id = p_entry;
  if not found or e.source_table <> 'manual_journal' then
    raise exception 'Only manual journal vouchers can be deleted here.';
  end if;
  insert into audit_log (table_name, row_id, operation, old_data, changed_by)
  values ('journal_entries', e.id, 'DELETE',
          to_jsonb(e) || jsonb_build_object('lines', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from journal_lines l where l.entry_id = e.id)),
          auth.uid());
  delete from journal_entries where id = p_entry;
end;
$$;

-- ── Books health check ────────────────────────────────────────────────────
create or replace function books_health_check()
returns table (check_code text, severity text, title text, detail text, amount numeric)
language sql stable set search_path to 'public' as $$
  select 'UNBALANCED', 'error', 'Journal entry does not balance',
         coalesce(e.display_id, e.id::text) || ' — ' || coalesce(e.description, ''), abs(sum(l.debit) - sum(l.credit))
  from journal_entries e join journal_lines l on l.entry_id = e.id
  group by e.id, e.display_id, e.description
  having abs(sum(l.debit) - sum(l.credit)) > 0.005

  union all
  select 'INV_NOT_POSTED', 'error', 'Sent invoice is not in the ledger', coalesce(i.invoice_number, i.display_id), i.amount
  from invoices i
  where i.status = 'sent' and i.invoice_date is not null
    and not exists (select 1 from journal_entries e where e.source_table = 'invoices' and e.source_id = i.id)

  union all
  select 'INV_VS_GL', 'error', 'Invoice differs from its ledger posting',
         coalesce(i.invoice_number, i.display_id) || ': invoice ' ||
           to_char(i.amount + round(i.amount * i.gst_pct / 100, 2) - round(i.amount * i.tds_pct / 100, 2), 'FM9999999990.00') ||
           ', ledger ' || to_char(g.dr, 'FM9999999990.00'),
         abs(i.amount + round(i.amount * i.gst_pct / 100, 2) - round(i.amount * i.tds_pct / 100, 2) - g.dr)
  from invoices i
  join lateral (
    select coalesce(sum(l.debit), 0) as dr
    from journal_entries e join journal_lines l on l.entry_id = e.id join gl_accounts a on a.id = l.gl_account_id
    where e.source_table = 'invoices' and e.source_id = i.id and a.code in ('1030', '1035')
  ) g on true
  where i.status = 'sent' and i.invoice_date is not null
    and exists (select 1 from journal_entries e where e.source_table = 'invoices' and e.source_id = i.id)
    and abs(i.amount + round(i.amount * i.gst_pct / 100, 2) - round(i.amount * i.tds_pct / 100, 2) - g.dr) > 0.01

  union all
  select 'NEGATIVE_CASH', 'error', a.name || ' has a negative balance', 'Cash or bank cannot be below zero — a receipt or opening balance is missing.',
         sum(l.debit - l.credit)
  from journal_lines l join gl_accounts a on a.id = l.gl_account_id
  where a.code in ('1010', '1020')
  group by a.name
  having sum(l.debit - l.credit) < -0.005

  union all
  select 'DUP_INV_NO', 'error', 'Invoice number used more than once', invoice_number || ' (' || count(*) || ' invoices)', null
  from invoices where invoice_number is not null and trim(invoice_number) <> ''
  group by invoice_number having count(*) > 1

  union all
  select 'INV_NO_LENGTH', 'warning', 'Invoice number longer than 16 characters (GST Rule 46)', invoice_number || ' (' || length(invoice_number) || ' characters)', null
  from invoices where length(invoice_number) > 16

  union all
  select 'OVERPAID', 'warning', 'Client has paid more than the invoice',
         coalesce(v.display_id, '') || ' — ' || coalesce(c.name, ''), v.total_paid - v.net_payable
  from v_invoice_computed v left join clients c on c.id = v.client_id
  where v.status = 'sent' and v.total_paid - v.net_payable > 0.01

  union all
  select 'DRAFT_PAID', 'warning', 'Receipt recorded against an invoice that has not been sent',
         coalesce(i.invoice_number, i.display_id), sum(p.amount)
  from invoices i join invoice_payments p on p.invoice_id = i.id
  where i.status = 'draft' group by i.id, i.invoice_number, i.display_id

  union all
  select 'FUTURE_RECEIPT', 'warning', 'Receipt dated in the future', coalesce(p.display_id, '') || ' — ' || to_char(p.date, 'DD Mon YYYY'), p.amount
  from invoice_payments p where p.date > current_date

  union all
  select 'RETENTION_DUE', 'warning', 'Retention release date has passed',
         coalesce(v.display_id, '') || ' — ' || coalesce(c.name, ''), v.retention_amount - v.released_paid
  from v_invoice_computed v join invoices i on i.id = v.id left join clients c on c.id = v.client_id
  where i.retention_release_date < current_date and v.retention_amount - v.released_paid > 0.01

  union all
  select 'GST_UNSPLIT', 'warning', 'GST not split into CGST / SGST / IGST',
         count(distinct e.source_id) || ' invoice(s) posted to Output GST — ' ||
           case when company_state_code() is null then 'add the company GSTIN in Settings' else 'the client GSTIN or state is missing' end,
         sum(l.credit)
  from journal_entries e join journal_lines l on l.entry_id = e.id join gl_accounts a on a.id = l.gl_account_id
  where e.source_table = 'invoices' and a.code = '2030'
  having count(*) > 0

  union all
  select 'COMPANY_PROFILE', 'warning', 'Company details incomplete',
         'Missing: ' || concat_ws(', ',
           case when coalesce(trim(gstin), '') = '' then 'GSTIN' end,
           case when coalesce(trim(pan), '') = '' then 'PAN' end,
           case when coalesce(trim(address), '') = '' then 'address' end), null
  from company_profile
  where coalesce(trim(gstin), '') = '' or coalesce(trim(pan), '') = '' or coalesce(trim(address), '') = ''

  union all
  select 'CLIENT_ADDRESS', 'warning', 'Client address or state missing', c.name, null
  from clients c
  where exists (select 1 from invoices i where i.client_id = c.id and i.status = 'sent')
    and (coalesce(trim(c.address_line1), '') = '' or coalesce(trim(c.state), '') = '')

  union all
  select 'CLIENT_GSTIN', 'info', 'Client has no GSTIN (treated as unregistered)', c.name, null
  from clients c
  where exists (select 1 from invoices i where i.client_id = c.id and i.status = 'sent')
    and coalesce(trim(c.gst), '') = ''

  union all
  select 'ADVANCE_HELD', 'info', 'Advance from customer not yet adjusted against an invoice', coalesce(c.name, ''), sum(l.credit - l.debit)
  from journal_lines l join gl_accounts a on a.id = l.gl_account_id left join clients c on c.id = l.client_id
  where a.code = '2060'
  group by c.name having sum(l.credit - l.debit) > 0.01

  union all
  select 'TDS_RECON', 'info', 'TDS receivable to reconcile with Form 26AS',
         'Booked on invoices; match each client''s total against the deductions shown in Form 26AS.', sum(l.debit - l.credit)
  from journal_lines l join gl_accounts a on a.id = l.gl_account_id
  where a.code = '1040' having sum(l.debit - l.credit) > 0.01

  union all
  select 'NO_LOCK', 'info', 'No financial year is locked',
         'Lock a closed year in Settings so its entries cannot be changed.', null
  from company_profile where books_locked_until is null
$$;
