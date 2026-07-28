-- Manually-entered client identifier, used to reference clients throughout
-- the app (in addition to the auto-generated display_id).
alter table clients add column client_code text unique;
