-- Adjusting an invoice after it has been recorded (amount, GST/TDS %, date,
-- client, project) now reaches the ledger. Previously post_invoice() returned
-- early for any UPDATE of an already-sent invoice, so the books kept the
-- original figures. Now a sent invoice's journal entry is rebuilt from the
-- current values on every update (the entry is deleted — its lines cascade —
-- and posted afresh), the same delete-and-repost approach the payment trigger
-- already uses.
create or replace function public.post_invoice()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_entry_id uuid;
  v_gst numeric;
  v_tds numeric;
  v_net numeric;
begin
  if NEW.status <> 'sent' or NEW.invoice_date is null then return NEW; end if;

  if TG_OP = 'UPDATE' then
    delete from journal_entries where source_table = 'invoices' and source_id = NEW.id;
  end if;

  v_gst := NEW.amount * NEW.gst_pct / 100;
  v_tds := NEW.amount * NEW.tds_pct / 100;
  v_net := NEW.amount + v_gst - v_tds;

  insert into journal_entries (date, description, source_table, source_id)
  values (NEW.invoice_date, 'Invoice ' || coalesce(NEW.invoice_number, NEW.display_id, ''), 'invoices', NEW.id)
  on conflict (source_table, source_id) do nothing
  returning id into v_entry_id;
  if v_entry_id is null then return NEW; end if;

  insert into journal_lines (entry_id, gl_account_id, debit, credit, project_id, client_id) values
    (v_entry_id, gl_acct('1030'), v_net, 0, NEW.project_id, NEW.client_id);
  if v_tds > 0 then
    insert into journal_lines (entry_id, gl_account_id, debit, credit, client_id) values
      (v_entry_id, gl_acct('1040'), v_tds, 0, NEW.client_id);
  end if;
  insert into journal_lines (entry_id, gl_account_id, debit, credit, project_id) values
    (v_entry_id, gl_acct('4010'), 0, NEW.amount, NEW.project_id);
  if v_gst > 0 then
    insert into journal_lines (entry_id, gl_account_id, debit, credit) values
      (v_entry_id, gl_acct('2030'), 0, v_gst);
  end if;
  return NEW;
end;
$function$;
