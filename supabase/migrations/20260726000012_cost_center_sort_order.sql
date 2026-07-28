-- Manual drag-and-drop ordering for the Admin > Cost centers list.
alter table cost_centers add column sort_order int;

-- Seed existing rows with their current alphabetical position so the list
-- doesn't jump around the first time this ships.
with ordered as (
  select id, row_number() over (order by name) as rn
  from cost_centers
)
update cost_centers c
set sort_order = ordered.rn
from ordered
where ordered.id = c.id;

alter table cost_centers alter column sort_order set not null;
