-- Account totals between two dates (null = unbounded) — the data behind the
-- Profit & Loss and Balance Sheet. Admin / CXO only.
create or replace function gl_balances(p_from date default null, p_to date default null)
returns table (
  code text,
  name text,
  account_type text,
  normal_balance text,
  sort_order integer,
  total_debit numeric,
  total_credit numeric
)
language plpgsql stable set search_path to 'public' as $$
begin
  if current_user_role() is null or current_user_role() not in ('admin', 'cxo') then
    raise exception 'Only an Admin or CXO can view the financial statements.';
  end if;
  return query
  select g.code, g.name, g.account_type, g.normal_balance, g.sort_order,
         coalesce(sum(x.debit), 0::numeric), coalesce(sum(x.credit), 0::numeric)
  from gl_accounts g
  left join (
    select l.gl_account_id, l.debit, l.credit
    from journal_lines l join journal_entries e on e.id = l.entry_id
    where (p_from is null or e.date >= p_from) and (p_to is null or e.date <= p_to)
  ) x on x.gl_account_id = g.id
  group by g.code, g.name, g.account_type, g.normal_balance, g.sort_order
  order by g.code;
end;
$$;
