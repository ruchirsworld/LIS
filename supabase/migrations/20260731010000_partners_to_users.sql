-- Merge "Partners" into Users: capital transactions are now attributed to a
-- profile (any user) instead of a separate, unlinked Partners master list.
-- No capital_transactions rows exist yet, so this is a clean cutover with
-- nothing to remap.

alter table capital_transactions drop constraint capital_transactions_partner_id_fkey;
alter table capital_transactions add constraint capital_transactions_partner_id_fkey
  foreign key (partner_id) references profiles(id) on delete restrict;

drop view v_capital_summary;
create view v_capital_summary
with (security_invoker = true) as
select
  p.id as partner_id,
  p.name,
  coalesce(sum(ct.amount) filter (where ct.type = 'injection'), 0) as total_injected,
  coalesce(sum(ct.amount) filter (where ct.type = 'withdrawal'), 0) as total_withdrawn,
  coalesce(sum(ct.amount) filter (where ct.type = 'injection'), 0)
    - coalesce(sum(ct.amount) filter (where ct.type = 'withdrawal'), 0) as net
from profiles p
left join capital_transactions ct on ct.partner_id = p.id
group by p.id, p.name;

drop table partners;
