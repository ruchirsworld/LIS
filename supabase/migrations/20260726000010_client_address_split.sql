-- Splits the single free-text address into Line 1 + City + State + Pin code.
-- Existing address values move into address_line1 as a best-effort preserve
-- (city/state/pincode can't be reliably parsed from free text, so they start
-- empty — fill them in via the Admin > Clients edit form).
alter table clients add column address_line1 text;
alter table clients add column city text;
alter table clients add column state text;
alter table clients add column pincode text;

update clients set address_line1 = address;

alter table clients drop column address;
