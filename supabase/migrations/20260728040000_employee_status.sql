-- Employees need a way to be marked as having left, so the salary
-- calculator can stop computing salary for them going forward while
-- keeping their historical records intact.
alter table employees add column status text not null default 'active' check (status in ('active', 'left'));
alter table employees add column left_date date;
