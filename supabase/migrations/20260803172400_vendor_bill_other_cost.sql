-- Tracked separately from amount (MenPower labor cost / plain bill value) so
-- Projects can report MenPower labor cost and "other cost" as distinct KPIs,
-- while billTotal() still sums both for payment/due reconciliation.
alter table vendor_bills add column other_cost numeric;
