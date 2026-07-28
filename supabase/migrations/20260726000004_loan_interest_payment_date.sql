-- Reference-only recurring interest due-date (e.g. "5th of every month");
-- purely informational, no automated scheduling/reminder logic.
alter table loans add column interest_payment_date date;
