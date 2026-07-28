-- "Billing address" is really the project's on-the-ground location, not a
-- billing concept — renamed for clarity. Same column, same data, new name.
alter table projects rename column billing_address to project_location;
