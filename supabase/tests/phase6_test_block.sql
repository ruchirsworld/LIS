-- Rolled-back test of supabase/pending/20261110000000_phase6_reconciliation.sql. Run as: the migration file, then this block, in one request.
do $test$
declare
  admin_id uuid; stranger uuid := gen_random_uuid();
  kotak uuid := '77b7b1a4-f5ea-44d3-ae85-6b8b86bda97f'; v_gl uuid;
  ins uuid[]; ind numeric[]; w1 uuid; w1c numeric; e_line uuid; e_src uuid; e_c numeric;
  bs1 uuid; bsg uuid; bsw uuid; bse uuid; bsbad uuid;
  m1 uuid; mg uuid; mw uuid; ref1 text; refg text;
  n bigint; r text := ''; ok boolean;
begin
  select id into admin_id from profiles where role = 'admin' limit 1;
  select id into v_gl from gl_accounts where code = '1020';
  select array_agg(id), array_agg(debit) into ins, ind from (
    select jl.id, jl.debit from journal_lines jl join journal_entries je on je.id = jl.entry_id
     where jl.bank_account_id = kotak and jl.gl_account_id = v_gl and jl.debit > 0 and je.source_table <> 'account_openings'
       and not exists (select 1 from bank_reconciliations br where br.journal_line_id = jl.id) order by je.date, jl.id limit 4) t;
  select jl.id, jl.credit into w1, w1c from journal_lines jl join journal_entries je on je.id = jl.entry_id
   where jl.bank_account_id = kotak and jl.gl_account_id = v_gl and jl.credit > 0 and je.source_table = 'transfers'
     and not exists (select 1 from bank_reconciliations br where br.journal_line_id = jl.id) limit 1;
  if w1 is null then
    select jl.id, jl.credit into w1, w1c from journal_lines jl join journal_entries je on je.id = jl.entry_id
     where jl.bank_account_id = kotak and jl.gl_account_id = v_gl and jl.credit > 0 and je.source_table = 'expenses'
       and not exists (select 1 from bank_reconciliations br where br.journal_line_id = jl.id) limit 1;
  end if;
  select jl.id, je.source_id, jl.credit into e_line, e_src, e_c from journal_lines jl join journal_entries je on je.id = jl.entry_id
   where jl.bank_account_id = kotak and jl.gl_account_id = v_gl and jl.credit > 0 and je.source_table = 'expenses' and jl.id <> w1
     and not books_locked(je.date) and not exists (select 1 from bank_reconciliations br where br.journal_line_id = jl.id) limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  set local role authenticated;

  insert into bank_statement_lines (bank_account_id, line_date, description, debit, credit, dedupe_key) values (kotak, current_date, 't1', 0, ind[1], 'k1') returning id into bs1;
  insert into bank_statement_lines (bank_account_id, line_date, description, debit, credit, dedupe_key) values (kotak, current_date, 'group', 0, ind[2] + ind[3], 'k2') returning id into bsg;
  insert into bank_statement_lines (bank_account_id, line_date, description, debit, credit, dedupe_key) values (kotak, current_date, 'w', w1c, 0, 'k3') returning id into bsw;
  insert into bank_statement_lines (bank_account_id, line_date, description, debit, credit, dedupe_key) values (kotak, current_date, 'e', e_c, 0, 'k4') returning id into bse;
  insert into bank_statement_lines (bank_account_id, line_date, description, debit, credit, dedupe_key) values (kotak, current_date, 'bad', 0, ind[4] + 5, 'k5') returning id into bsbad;

  m1 := save_bank_match(kotak, array[bs1], array[ins[1]]);
  select group_ref into ref1 from bank_matches where id = m1;
  select count(*) into n from bank_reconciliations where journal_line_id = ins[1];
  r := r || case when ref1 is null and n = 1 then '1:ok ' else '1:FAIL ' end;

  mg := save_bank_match(kotak, array[bsg], array[ins[2], ins[3]]);
  select group_ref into refg from bank_matches where id = mg;
  r := r || case when refg like 'GRP-%' then '2:ok(' || refg || ') ' else '2:FAIL ' end;

  ok := false;
  begin perform save_bank_match(kotak, array[bsbad], array[ins[4]]); exception when others then ok := sqlerrm like '%must add up%'; end;
  r := r || case when ok then '3:ok ' else '3:FAIL ' end;

  ok := false;
  begin perform save_bank_match(kotak, array[bsw], array[ins[1]]); exception when others then ok := true; end;
  r := r || case when ok then '4:ok ' else '4:FAIL ' end;

  ok := false;
  begin perform save_bank_match(kotak, array[bsw], array[ins[4]]); exception when others then ok := true; end;
  r := r || case when ok then '5:ok ' else '5:FAIL ' end;

  perform unmatch_bank_match(mg, 'test');
  select count(*) into n from bank_reconciliations where journal_line_id in (ins[2], ins[3]);
  r := r || case when n = 0 and (select count(*) from bank_matches where id = mg) = 0 and exists (select 1 from bank_recon_audit where action = 'ungroup' and group_ref = refg) then '6:ok ' else '6:FAIL ' end;

  mw := save_bank_match(kotak, array[bse], array[e_line]);
  update expenses set remarks = coalesce(remarks, '') where id = e_src;
  select count(*) into n from bank_matches where id = mw;
  r := r || case when n = 0 and exists (select 1 from bank_recon_audit where action = 'match_broken') then '7:ok ' else '7:FAIL(' || n || ') ' end;

  reset role;
  insert into bank_recon_locks (bank_account_id, locked_until) values (kotak, current_date + 30);
  set local role authenticated;
  ok := false;
  begin update expenses set remarks = coalesce(remarks, '') where id = e_src; exception when others then ok := sqlerrm like '%locked up to%'; end;
  r := r || case when ok then '8a:ok ' else '8a:FAIL ' end;
  ok := false;
  begin perform unlock_bank_period(kotak, 'x'); exception when others then ok := sqlerrm like '%reason%'; end;
  r := r || case when ok then '8b:ok ' else '8b:FAIL ' end;
  perform unlock_bank_period(kotak, 'correcting a wrong amount', 30);
  begin update expenses set remarks = coalesce(remarks, '') where id = e_src; r := r || '8c:ok '; exception when others then r := r || '8c:FAIL(' || sqlerrm || ') '; end;

  reset role;
  delete from bank_recon_locks where bank_account_id = kotak;
  set local role authenticated;
  ok := false;
  begin perform lock_bank_period(kotak, current_date); exception when others then ok := sqlerrm like '%not matched yet%'; end;
  r := r || case when ok then '9:ok ' else '9:FAIL ' end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', stranger::text, true);
  set local role authenticated;
  ok := false;
  begin perform save_bank_match(kotak, array[bsw], array[w1]); exception when others then ok := sqlerrm like 'Only the back office%'; end;
  r := r || case when ok then '10:ok' else '10:FAIL' end;
  reset role;

  raise exception '% %', case when r like '%FAIL%' then 'FAIL' else 'PASS' end, r;
end $test$;
