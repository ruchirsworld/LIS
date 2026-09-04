-- The frontend was already loosened to accept 4 alphanumeric characters
-- (e.g. "UJI7"), but this DB check constraint still enforced the old
-- 4-letters-only rule, so a valid save from the UI got rejected here.
alter table projects drop constraint projects_code_format;
alter table projects add constraint projects_code_format check (code is null or code ~ '^[A-Z0-9]{4}$');
