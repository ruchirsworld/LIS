-- Distinguishes Private Party loans (fixed-ROI, interest-only, bullet
-- principal repayment) from Bank loans (reducing-balance interest) for
-- record-keeping. Both types use the same reducing-balance interest
-- calculation in the app; this is a categorization field.
alter table loans
  add column loan_type text not null default 'private' check (loan_type in ('private', 'bank'));
