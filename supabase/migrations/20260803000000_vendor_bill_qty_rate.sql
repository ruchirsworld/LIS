-- MenPower-category vendor bills are billed by quantity x rate (e.g. worker
-- days x day rate) instead of a flat bill value + GST. amount stays the
-- source of truth for billTotal/billDue (= qty * rate, gst_pct forced to 0
-- for these bills) — qty/rate are stored alongside purely so the breakdown
-- stays visible.
alter table vendor_bills add column qty numeric;
alter table vendor_bills add column rate numeric;
