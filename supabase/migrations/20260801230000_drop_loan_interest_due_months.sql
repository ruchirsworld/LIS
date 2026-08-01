-- Interest due is now calculated automatically (months elapsed since the
-- last interest payment, or the loan's start date, up to today) instead of
-- being entered manually per loan. See src/lib/calc/loans.ts.
alter table loans drop column interest_due_months;
