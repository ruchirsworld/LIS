# Database tests

Plain SQL checks for the accounting engine and the access rules. Each file is one
`do $$ ... $$` block that sets up its own data, checks the result and then
**raises an exception on purpose**, so everything it created is rolled back and
nothing is left in the database.

Run a file in the Supabase SQL editor (or with `execute_sql`) against the project
you want to check. A passing file ends with an error whose message starts
`PASS`. Any message starting `FAIL` names the check that broke.

| File | Checks |
| --- | --- |
| `accounting_posting.sql` | An invoice, its receipt and an expense post balanced entries to the right accounts. |
| `summaries.sql` | The Financial summary, GST summary and Dashboard cards ignore Draft invoices and pending or rejected expenses, and count an invoice once it is Sent. |
| `vendor_advances.sql` | A vendor advance posts to Advances to Suppliers, the oldest advance is set against bills as they are entered, edits and deletes redo the set-off, and the ledger balances. |
| `access_rules.sql` | A supervisor cannot read the books, approve reimbursements or call the posting helpers; unique numbers and non-negative amounts are enforced. |

Run them against a staging project first, and against production after every
migration that touches posting, policies or function permissions.
