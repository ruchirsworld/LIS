-- Start date is set by Admin when creating/editing a project. End date is
-- set automatically (not user-editable) the day a project is marked
-- Completed from the Projects tab's status switch, and cleared if it's
-- switched back to Active.
alter table projects
  add column start_date date,
  add column end_date date;
