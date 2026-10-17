-- Phase 6: bank reconciliation that is saved, not kept on the screen (additive only: new tables, one trigger, new functions).
-- Nothing here updates, deletes or backfills an existing row. The existing tick table (bank_reconciliations) and sign-offs keep working:
-- saving a match also ticks the books entries in bank_reconciliations, and removing a match takes those ticks off again.
--
--  bank_statement_lines   the lines of an uploaded statement, kept (a re-upload or an overlapping statement adds only the new lines)
--  bank_matches / members which statement lines are matched with which books entries; a match of more than one line on a side gets GRP-0001...
--  bank_recon_reviews     "reviewed" ticks on a statement line, a books entry or a match
--  bank_recon_audit       who matched, unmatched, grouped, ungrouped, locked or unlocked, and when
--  bank_recon_locks       a reconciled period is locked: entries on that bank account dated up to the lock cannot be added, changed or
--                         removed unless an admin unlocks it, with a reason, for a short time
-- Money is shown on the bank statement's terms: "credit" = money in, "debit" = money out.

create sequence if not exists bank_group_ref_seq;

create table if not exists bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references bank_accounts(id),
  line_date date not null,
  description text not null default '',
  reference text not null default '',
  debit numeric(14, 2) not null default 0,
  credit numeric(14, 2) not null default 0,
  balance numeric(14, 2),
  dedupe_key text not null,
  source_file text,
  imported_by uuid references profiles(id) default auth.uid(),
  imported_at timestamptz not null default now(),
  unique (bank_account_id, dedupe_key),
  check (debit >= 0 and credit >= 0)
);
create index if not exists bank_statement_lines_bank_date_idx on bank_statement_lines (bank_account_id, line_date);
create index if not exists bank_statement_lines_imported_by_idx on bank_statement_lines (imported_by);

create table if not exists bank_matches (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references bank_accounts(id),
  group_ref text unique,
  kind text not null default 'manual' check (kind in ('auto', 'manual')),
  matched_total numeric(14, 2) not null,
  difference numeric(14, 2) not null default 0,
  cleared_on date not null,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists bank_matches_bank_idx on bank_matches (bank_account_id);
create index if not exists bank_matches_created_by_idx on bank_matches (created_by);

create table if not exists bank_match_members (
  match_id uuid not null references bank_matches(id) on delete cascade,
  side text not null check (side in ('bank', 'books')),
  bank_line_id uuid references bank_statement_lines(id) on delete cascade,
  journal_line_id uuid references journal_lines(id) on delete cascade,
  check ((side = 'bank' and bank_line_id is not null and journal_line_id is null) or (side = 'books' and journal_line_id is not null and bank_line_id is null))
);
create unique index if not exists bank_match_members_bank_line_uq on bank_match_members (bank_line_id) where bank_line_id is not null;
create unique index if not exists bank_match_members_journal_line_uq on bank_match_members (journal_line_id) where journal_line_id is not null;
create index if not exists bank_match_members_match_idx on bank_match_members (match_id);

create table if not exists bank_recon_reviews (
  bank_account_id uuid not null references bank_accounts(id),
  item_key text not null,
  reviewed_by uuid references profiles(id) default auth.uid(),
  reviewed_at timestamptz not null default now(),
  primary key (bank_account_id, item_key)
);
create index if not exists bank_recon_reviews_by_idx on bank_recon_reviews (reviewed_by);

create table if not exists bank_recon_audit (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  by_user uuid references profiles(id) default auth.uid(),
  bank_account_id uuid references bank_accounts(id),
  action text not null,
  group_ref text,
  reason text,
  detail jsonb
);
create index if not exists bank_recon_audit_bank_at_idx on bank_recon_audit (bank_account_id, at desc);
create index if not exists bank_recon_audit_by_idx on bank_recon_audit (by_user);

create table if not exists bank_recon_locks (
  bank_account_id uuid primary key references bank_accounts(id),
  locked_until date not null,
  locked_by uuid references profiles(id) default auth.uid(),
  locked_at timestamptz not null default now(),
  override_until timestamptz,
  override_by uuid references profiles(id),
  override_reason text
);
create index if not exists bank_recon_locks_locked_by_idx on bank_recon_locks (locked_by);
create index if not exists bank_recon_locks_override_by_idx on bank_recon_locks (override_by);

do $m$
declare t text;
begin
  foreach t in array array['bank_statement_lines','bank_matches','bank_match_members','bank_recon_reviews','bank_recon_audit','bank_recon_locks'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_back_office())', t || '_select', t);
  end loop;
end $m$;
-- Statement lines and reviews are written directly by the screen; matches, locks and the audit trail only through the functions below.
create policy bank_statement_lines_insert on bank_statement_lines for insert with check (is_back_office() and imported_by = auth.uid());
create policy bank_statement_lines_delete on bank_statement_lines for delete using (is_back_office());
create policy bank_recon_reviews_insert on bank_recon_reviews for insert with check (is_back_office() and reviewed_by = auth.uid());
create policy bank_recon_reviews_delete on bank_recon_reviews for delete using (is_back_office());

-- When an entry that is part of a match is edited it is posted again with new ledger lines, so its row here goes (the same thing that took
-- its tick off before). The rest of the match then falls apart with it: both sides show as unmatched, ready to be matched again.
create or replace function bank_match_member_removed() returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_ref text; v_bank uuid; v_rows int;
begin
  if old.side = 'books' then
    delete from bank_reconciliations where journal_line_id = old.journal_line_id;
  end if;
  select group_ref, bank_account_id into v_ref, v_bank from bank_matches where id = old.match_id;
  delete from bank_matches where id = old.match_id;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    insert into bank_recon_audit (bank_account_id, action, group_ref, detail)
    values (v_bank, 'match_broken', v_ref, jsonb_build_object('because', 'an entry or statement line in it was changed or removed', 'match_id', old.match_id));
  end if;
  return old;
end;
$$;
drop trigger if exists trg_bank_match_member_removed on bank_match_members;
create trigger trg_bank_match_member_removed after delete on bank_match_members for each row execute function bank_match_member_removed();

-- Save a match: statement lines and books entries that add up to the same amount (within 99 paise), all on one side of the money.
create or replace function save_bank_match(p_bank uuid, p_bank_lines uuid[], p_journal_lines uuid[], p_kind text default 'manual') returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_in_bank numeric; v_out_bank numeric; v_in_books numeric; v_out_books numeric;
  v_nb int; v_nj int; v_total numeric; v_diff numeric; v_ref text; v_id uuid; v_on date; v_gl uuid;
begin
  if not is_back_office() then raise exception 'Only the back office can match entries.'; end if;
  v_nb := coalesce(cardinality(p_bank_lines), 0);
  v_nj := coalesce(cardinality(p_journal_lines), 0);
  if v_nb = 0 or v_nj = 0 then raise exception 'Choose at least one line on each side.'; end if;
  select id into v_gl from gl_accounts where code = '1020';

  select count(*), coalesce(sum(credit), 0), coalesce(sum(debit), 0), max(line_date) into v_nb, v_in_bank, v_out_bank, v_on
    from bank_statement_lines where id = any (p_bank_lines) and bank_account_id = p_bank;
  if v_nb <> cardinality(p_bank_lines) then raise exception 'A statement line was not found for this bank account.'; end if;
  select count(*), coalesce(sum(jl.debit), 0), coalesce(sum(jl.credit), 0) into v_nj, v_in_books, v_out_books
    from journal_lines jl where jl.id = any (p_journal_lines) and jl.bank_account_id = p_bank and jl.gl_account_id = v_gl;
  if v_nj <> cardinality(p_journal_lines) then raise exception 'A books entry was not found for this bank account.'; end if;

  if exists (select 1 from bank_statement_lines where id = any (p_bank_lines) and debit > 0 and credit > 0)
     or exists (select 1 from journal_lines where id = any (p_journal_lines) and debit > 0 and credit > 0) then
    raise exception 'A line with money both in and out cannot be matched.';
  end if;
  if (v_in_bank > 0 and v_out_bank > 0) or (v_in_books > 0 and v_out_books > 0) then
    raise exception 'Money in and money out cannot be matched together.';
  end if;
  if (v_in_bank > 0) <> (v_in_books > 0) then
    raise exception 'The statement side and the books side must both be money in, or both money out.';
  end if;
  v_total := greatest(v_in_bank, v_out_bank);
  v_diff := round(v_total - greatest(v_in_books, v_out_books), 2);
  if abs(v_diff) > 0.99 then
    raise exception 'The two sides differ by % and must add up to the same amount.', abs(v_diff);
  end if;
  if exists (select 1 from bank_match_members where bank_line_id = any (p_bank_lines) or journal_line_id = any (p_journal_lines)) then
    raise exception 'One of these lines is already matched. Unmatch it first.';
  end if;

  if v_nb + v_nj > 2 then v_ref := 'GRP-' || lpad(nextval('bank_group_ref_seq')::text, 4, '0'); end if;
  insert into bank_matches (bank_account_id, group_ref, kind, matched_total, difference, cleared_on)
    values (p_bank, v_ref, case when p_kind = 'auto' then 'auto' else 'manual' end, v_total, v_diff, v_on) returning id into v_id;
  insert into bank_match_members (match_id, side, bank_line_id) select v_id, 'bank', x from unnest(p_bank_lines) x;
  insert into bank_match_members (match_id, side, journal_line_id) select v_id, 'books', x from unnest(p_journal_lines) x;
  insert into bank_reconciliations (journal_line_id, bank_account_id, cleared_on)
    select x, p_bank, v_on from unnest(p_journal_lines) x on conflict (journal_line_id) do nothing;
  insert into bank_recon_audit (bank_account_id, action, group_ref, detail)
    values (p_bank, case when v_ref is null then 'match' else 'group' end, v_ref,
            jsonb_build_object('match_id', v_id, 'bank_lines', v_nb, 'books_entries', v_nj, 'total', v_total, 'difference', v_diff, 'kind', p_kind));
  return v_id;
end;
$$;

-- Break a match (or a group). In a locked period this needs the admin's unlock first.
create or replace function unmatch_bank_match(p_match uuid, p_reason text default null) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  m record; v_lock record; v_late boolean;
begin
  if not is_back_office() then raise exception 'Only the back office can unmatch entries.'; end if;
  select * into m from bank_matches where id = p_match;
  if not found then raise exception 'That match was not found.'; end if;
  select * into v_lock from bank_recon_locks where bank_account_id = m.bank_account_id;
  if found and (v_lock.override_until is null or v_lock.override_until <= now()) and m.cleared_on <= v_lock.locked_until then
    raise exception 'This period is reconciled and locked up to %. An admin can unlock it, with a reason.', to_char(v_lock.locked_until, 'DD Mon YYYY');
  end if;
  -- log first: removing the members would otherwise log it as a broken match
  insert into bank_recon_audit (bank_account_id, action, group_ref, reason, detail)
    values (m.bank_account_id, case when m.group_ref is null then 'unmatch' else 'ungroup' end, m.group_ref, nullif(trim(p_reason), ''),
            jsonb_build_object('match_id', m.id, 'total', m.matched_total));
  delete from bank_match_members where match_id = p_match and side = 'books';
  delete from bank_matches where id = p_match;
end;
$$;

-- Lock a reconciled period. Every entry on the bank account dated up to the date must already be ticked (matched).
create or replace function lock_bank_period(p_bank uuid, p_until date) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_gl uuid; v_open int; v_existing date;
begin
  if current_user_role() not in ('admin', 'cxo') then raise exception 'Only an admin or CXO can lock a period.'; end if;
  select id into v_gl from gl_accounts where code = '1020';
  select count(*) into v_open
    from journal_lines jl join journal_entries je on je.id = jl.entry_id
    where jl.bank_account_id = p_bank and jl.gl_account_id = v_gl and je.date <= p_until and je.source_table <> 'account_openings'
      and not exists (select 1 from bank_reconciliations br where br.journal_line_id = jl.id);
  if v_open > 0 then
    raise exception '% entr% up to % are not matched yet. Match them first, then lock.', v_open, case when v_open = 1 then 'y' else 'ies' end, to_char(p_until, 'DD Mon YYYY');
  end if;
  select locked_until into v_existing from bank_recon_locks where bank_account_id = p_bank;
  if v_existing is not null and p_until <= v_existing then raise exception 'It is already locked up to %.', to_char(v_existing, 'DD Mon YYYY'); end if;
  insert into bank_recon_locks (bank_account_id, locked_until) values (p_bank, p_until)
    on conflict (bank_account_id) do update set locked_until = excluded.locked_until, locked_by = auth.uid(), locked_at = now(), override_until = null, override_by = null, override_reason = null;
  insert into bank_recon_audit (bank_account_id, action, detail) values (p_bank, 'lock', jsonb_build_object('locked_until', p_until));
end;
$$;

-- Unlock for a short time (default 30 minutes) to correct something in a locked period. Admin only, and a reason is required.
create or replace function unlock_bank_period(p_bank uuid, p_reason text, p_minutes int default 30) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if current_user_role() is distinct from 'admin' then raise exception 'Only an admin can unlock a reconciled period.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason for unlocking.'; end if;
  update bank_recon_locks set override_until = now() + make_interval(mins => least(greatest(p_minutes, 1), 240)), override_by = auth.uid(), override_reason = trim(p_reason)
    where bank_account_id = p_bank;
  if not found then raise exception 'This bank account is not locked.'; end if;
  insert into bank_recon_audit (bank_account_id, action, reason, detail) values (p_bank, 'unlock', trim(p_reason), jsonb_build_object('minutes', least(greatest(p_minutes, 1), 240)));
end;
$$;

-- Take the lock away altogether (admin, with a reason).
create or replace function release_bank_lock(p_bank uuid, p_reason text) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if current_user_role() is distinct from 'admin' then raise exception 'Only an admin can remove a lock.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason for removing the lock.'; end if;
  delete from bank_recon_locks where bank_account_id = p_bank;
  insert into bank_recon_audit (bank_account_id, action, reason) values (p_bank, 'lock_removed', trim(p_reason));
end;
$$;

-- The lock itself: entries on a locked bank account, dated up to the lock, cannot be added, changed or removed.
create or replace function enforce_recon_lock() returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_bank uuid; v_lock record; v_date date;
begin
  v_bank := case when tg_op = 'DELETE' then old.bank_account_id else coalesce(new.bank_account_id, old.bank_account_id) end;
  if v_bank is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  select * into v_lock from bank_recon_locks where bank_account_id = v_bank;
  if found and (v_lock.override_until is null or v_lock.override_until <= now()) then
    select je.date into v_date from journal_entries je where je.id = case when tg_op = 'DELETE' then old.entry_id else new.entry_id end;
    if v_date is not null and v_date <= v_lock.locked_until then
      raise exception 'This bank account is reconciled and locked up to %. An admin can unlock it, with a reason.', to_char(v_lock.locked_until, 'DD Mon YYYY');
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists trg_recon_lock on journal_lines;
create trigger trg_recon_lock before insert or update or delete on journal_lines for each row execute function enforce_recon_lock();

grant execute on function save_bank_match(uuid, uuid[], uuid[], text) to authenticated;
grant execute on function unmatch_bank_match(uuid, text) to authenticated;
grant execute on function lock_bank_period(uuid, date) to authenticated;
grant execute on function unlock_bank_period(uuid, text, int) to authenticated;
grant execute on function release_bank_lock(uuid, text) to authenticated;
