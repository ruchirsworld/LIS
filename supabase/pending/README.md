# Prepared migrations (NOT applied)

Files here are written for the redesign but have **not** been run on any database. Before one is applied:

1. Run `baseline_counts.sql` and keep the result (row counts and amount totals per table).
2. Apply the migration (it only adds nullable columns, a trigger and new tables; it never updates, deletes or backfills rows).
3. Run `baseline_counts.sql` again. Every number must match exactly.

When one is applied, move it into `supabase/migrations/` with its real timestamp.
