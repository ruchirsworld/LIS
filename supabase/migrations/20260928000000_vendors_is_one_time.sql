-- A bill has to point at a vendor record (payables, ledgers and GST/TDS are
-- all tracked per vendor), so a "one-time" vendor is still a real row — it
-- just stays out of the normal vendor picker and Vendor lists, and only
-- surfaces where a specific bill is being entered/edited or when the
-- "show one-time vendors" toggle is on.
alter table vendors add column is_one_time boolean not null default false;
