-- Bulk re-posting leaves locked periods alone.
--
-- repost_all_invoices() used to rebuild every entry, which the period lock
-- (rightly) refuses for anything dated on or before books_locked_until. The
-- repost functions now take p_skip_locked: with it set they pass over entries
-- inside the locked period (left exactly as filed) instead of failing. Direct
-- edits and the normal posting triggers still pass false, so changing a record
-- in a locked period is still refused.
create or replace function books_locked(p_date date) returns boolean
language sql stable set search_path to 'public' as $$
  select coalesce((select books_locked_until is not null and p_date <= books_locked_until from company_profile limit 1), false)
$$;

drop function if exists repost_invoice_payment(uuid);
drop function if exists repost_invoice_advance(uuid);
drop function if exists repost_invoice_entry(uuid);
drop function if exists repost_invoice_note(uuid);

create or replace function repost_invoice_payment(p_id uuid, p_skip_locked boolean default false) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  p invoice_payments%rowtype;
  inv invoices%rowtype;
  v_entry uuid;
  v_credit uuid;
begin
  select * into p from invoice_payments where id = p_id;
  if not found then return; end if;
  if p_skip_locked and books_locked(p.date) then return; end if;
  select * into inv from invoices where id = p.invoice_id;

  insert into journal_entries (date, description, source_table, source_id)
  values (p.date, 'Payment received — ' || coalesce(p.display_id, ''), 'invoice_payments', p.id)
  on conflict (source_table, source_id) do update set date = excluded.date, description = excluded.description
  returning id into v_entry;

  delete from journal_lines where entry_id = v_entry;

  v_credit := case
    when p.is_retention_release then gl_acct('1035')
    when inv.status <> 'sent' or inv.invoice_date is null or p.date < inv.invoice_date then gl_acct('2060')
    else gl_acct('1030')
  end;

  insert into journal_lines (entry_id, gl_account_id, debit, credit, bank_account_id, project_id)
  values (v_entry, cash_or_bank(p.bank_account_id), p.amount, 0, p.bank_account_id, inv.project_id);
  insert into journal_lines (entry_id, gl_account_id, debit, credit, client_id, project_id)
  values (v_entry, v_credit, 0, p.amount, inv.client_id, inv.project_id);
end;
$$;

create or replace function repost_invoice_advance(p_invoice_id uuid, p_skip_locked boolean default false) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  inv invoices%rowtype;
  v_adv numeric;
  v_entry uuid;
begin
  select * into inv from invoices where id = p_invoice_id;
  if not found or inv.status <> 'sent' or inv.invoice_date is null then
    delete from journal_entries where source_table = 'invoice_advance' and source_id = p_invoice_id;
    return;
  end if;
  if p_skip_locked and books_locked(inv.invoice_date) then return; end if;

  select coalesce(sum(amount), 0) into v_adv
  from invoice_payments
  where invoice_id = p_invoice_id and not is_retention_release and date < inv.invoice_date;

  if v_adv <= 0 then
    delete from journal_entries where source_table = 'invoice_advance' and source_id = p_invoice_id;
    return;
  end if;

  insert into journal_entries (date, description, source_table, source_id)
  values (inv.invoice_date, 'Advance adjusted against invoice ' || coalesce(inv.invoice_number, inv.display_id, ''), 'invoice_advance', inv.id)
  on conflict (source_table, source_id) do update set date = excluded.date, description = excluded.description
  returning id into v_entry;

  delete from journal_lines where entry_id = v_entry;
  insert into journal_lines (entry_id, gl_account_id, debit, credit, client_id, project_id)
  values (v_entry, gl_acct('2060'), v_adv, 0, inv.client_id, inv.project_id);
  insert into journal_lines (entry_id, gl_account_id, debit, credit, client_id, project_id)
  values (v_entry, gl_acct('1030'), 0, v_adv, inv.client_id, inv.project_id);
end;
$$;

create or replace function repost_invoice_entry(p_invoice_id uuid, p_skip_locked boolean default false) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  i invoices%rowtype;
  v_entry uuid;
  v_gst numeric; v_tds numeric; v_net numeric; v_ret numeric;
  r record;
begin
  select * into i from invoices where id = p_invoice_id;

  if not found or i.status <> 'sent' or i.invoice_date is null then
    delete from journal_entries where source_table = 'invoices' and source_id = p_invoice_id;
  elsif not (p_skip_locked and books_locked(i.invoice_date)) then
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
  end if;

  -- Receipts may now fall on a different side of the invoice date (or the
  -- invoice may no longer be issued), so they are classified again.
  for r in select id from invoice_payments where invoice_id = p_invoice_id loop
    perform repost_invoice_payment(r.id, p_skip_locked);
  end loop;
  perform repost_invoice_advance(p_invoice_id, p_skip_locked);
end;
$$;

create or replace function repost_invoice_note(p_id uuid, p_skip_locked boolean default false) returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  n invoice_notes%rowtype;
  inv invoices%rowtype;
  v_entry uuid;
  v_credit boolean;
begin
  select * into n from invoice_notes where id = p_id;
  if not found then return; end if;
  if p_skip_locked and books_locked(n.date) then return; end if;
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

-- The trigger wrappers keep calling with the default (never skip).
create or replace function post_invoice() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin perform repost_invoice_entry(new.id); return new; end;
$$;

-- Returns how many invoices were re-posted and how many were left as filed.
drop function if exists repost_all_invoices();
create or replace function repost_all_invoices() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  r record;
  v_done integer := 0;
  v_skipped integer := 0;
begin
  if current_user_role() is distinct from 'admin'::user_role then
    raise exception 'Only an Admin can re-post the ledger.';
  end if;
  for r in select id, invoice_date, status from invoices loop
    if r.status = 'sent' and r.invoice_date is not null and books_locked(r.invoice_date) then
      v_skipped := v_skipped + 1;
    else
      v_done := v_done + 1;
    end if;
    perform repost_invoice_entry(r.id, true);
  end loop;
  for r in select id from invoice_payments loop perform repost_invoice_payment(r.id, true); end loop;
  for r in select id from invoices loop perform repost_invoice_advance(r.id, true); end loop;
  for r in select id from invoice_notes loop perform repost_invoice_note(r.id, true); end loop;
  return jsonb_build_object('reposted', v_done, 'skipped', v_skipped);
end;
$$;
