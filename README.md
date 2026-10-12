# LIS — Laavin Internal System

Billing, expenses, purchases, payroll support and books of account for Laavin InfraScapes.
React + TypeScript front end (Vite), Supabase (Postgres, Auth, Storage, Edge Functions) behind it.

## Run it

```bash
npm install
cp .env.example .env.local     # then fill in the project URL and anon key
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Local app on port 5174 |
| `npm run build` | Type-check and build for deployment |
| `npm test` | Unit tests for the money, GST and statement maths |
| `npm run lint` | Lint |

`.env.local` points at one Supabase project. **Do not point day-to-day development at the live
project.** Create a second Supabase project (staging), apply the migrations to it, and put its
URL and key in `.env.local`. Keep the live keys only where the app is deployed.

## Database

- `supabase/migrations/` — every change to the database, in order. Apply them to a project in
  filename order. Never edit a migration that has already been applied; add a new one.
- `supabase/functions/` — edge functions (create and delete users, upload vendor receipts). Deploy
  with the Supabase CLI.
- `supabase/tests/` — SQL checks for posting and access rules. See `supabase/tests/README.md`.
- `src/types/database.ts` — generated from the live schema (Supabase: *Generate types*). Regenerate
  it after a migration instead of editing it by hand.

## How the books work

- Every invoice, receipt, bill, payment, expense, loan, transfer and capital entry is posted to the
  ledger by a database trigger as a balanced double entry. The app never writes ledger lines itself.
- `company_profile.books_locked_until` locks a closed period: nothing dated on or before it can be
  added, changed or removed.
- Profit and Loss and the Balance Sheet are worked out from the ledger on request (`gl_balances`).
- Edits and deletes on the financial tables, and on users, clients, vendors, projects and staff, are
  recorded in `audit_log`.

## Who can see what

| Role | Sees |
| --- | --- |
| Admin, CXO | Everything. Admin also manages users and settings. |
| Supervisor | Only their own expenses, projects, team, attendance and imprest. The database enforces this, not just the screens. |

Everyone signs in with a phone number and a 6-digit PIN. Nobody is signed out automatically; people
stay signed in until they press Sign out.

## Conventions

- Amounts are held to the paisa. Use `round2` from `src/lib/calc/invoices.ts` for any tax figure.
- Money and tax logic lives in `src/lib/calc/` as plain functions with tests beside them.
- Use `toast()` and `confirmAction()` from `src/lib/feedback.ts` — never `window.alert/confirm`.
- Reads of more than 1,000 rows are paged automatically (`src/lib/fetchAllPages.ts`).
- Anything clickable that is not a button gets `activateProps()` from `src/lib/a11y.ts`.
