-- Free-text remarks, separate from the required searchable Tags field —
-- for extra context on an expense that doesn't belong in the tag text.
alter table expenses add column remarks text;
