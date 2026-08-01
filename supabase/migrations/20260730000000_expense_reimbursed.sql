-- Tracks whether a reimbursable expense has actually been paid back to
-- whoever covered it, so "amount still to claim" can be computed as
-- reimbursable = true and reimbursed = false, instead of just summing every
-- expense ever marked reimbursable (which never shrinks on its own).
alter table expenses add column reimbursed boolean not null default false;
