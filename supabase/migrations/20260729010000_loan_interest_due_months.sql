-- Replace the calendar-based "Interest payment date" with a simple
-- admin-tracked counter of how many months of interest are currently owed.
-- Total interest currently due = monthly reducing-balance interest
-- (outstanding principal x roi_pct / 100 / 12) x interest_due_months.
alter table loans drop column interest_payment_date;
alter table loans add column interest_due_months integer not null default 0 check (interest_due_months >= 0);
