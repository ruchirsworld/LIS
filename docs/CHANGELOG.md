# LIS changes since v2.0.1

Version 2.0.1 was released on 3 September 2026. This list covers everything after it, up to 3.0.2. It is put together from the project history, grouped by area. Version numbers are shown where a release carried one.

## 2.0.2 – 2.0.3 (3 – 4 September)

**Supervisors and site**
- Field expenses were merged into one Claims list, and the separate field-expenses bridge was removed.
- GPS access is now required for supervisors. Location pings are saved reliably, check-in history no longer hides valid pings, and place names are looked up.
- A manual "Install app" button was added.
- Attendance marked by a supervisor is locked once approved, and "Submit attendance" always finalises marked entries as approved.
- Admin and CXO can review field expenses.
- The leftover seed "Admin" account is hidden everywhere.

**Expenses**
- The Amount field is now the total including GST, not the base.
- Expense description and remarks replaced the dormant "By tag" section.

**Dashboard and reports**
- The Admin Dashboard was redesigned around four groups of numbers.
- Retention money is tracked on invoices.
- The Cash & bank report reads the real ledger, so it matches the Dashboard.
- A flat Receipts report was added, and a recorded receipt can now be edited.
- Salary: "Payable by staff" is grouped by supervisor.
- Project codes can now contain numbers.

## 2.0.4 – 2.0.45 (5 – 14 September)

**Imprest, advances and reimbursements**
- Site imprest outstanding shows on the Dashboard.
- Supervisors can request advances. Salary advances are linked, and the app has a Hindi toggle.
- Admin and CXO can edit recorded imprest payments and returns. Reimbursement became a payment account and kind in Imprest.
- Salary advance history can be edited and deleted (delete is Admin only).

**Expenses and trips**
- Trips can be edited, including their dates. Entries on a trip can be edited, deleted or added from Trip records.
- Trip records can be sorted, grouped by date, and filtered by a custom date range. Deleting a trip that still has entries gives a plain message.
- Deleting expenses is restricted to Admin.
- GST inclusive or exclusive is an explicit choice on the expense form. The GST rate and GST amount update each other.
- Admin and CXO can log project expenses on behalf of a supervisor, and the "on behalf of" field became a dedicated Supervisor page.
- Admin and CXO can bulk-upload supervisor claims from the Approvals page.
- Trip-linked project expenses show separately in the Project tab. Project Overview splits direct and trip expenses and has a full analysis export.
- A PR quick category was added to Trips.

**Projects and salary**
- Worker salaries are attributed to projects by where they worked. A Pending Claims figure was added to Project, and project Invoiced and Due exclude GST.
- The pay-slip was reworked: shown on run, editable, bilingual, with a screenshot export, company header and Net Pay.

**Invoices and receipts**
- Receipt picker shows the invoice number. Record receipts has an Account field. A Payment records table was added.
- Excel bulk-import dates no longer read one day early.

## 2.0.46 – 2.0.69 (15 – 29 September)
- Vendor payments can be marked "Reimbursement" (an employee paid). "Reimbursement due" became its own Dashboard block with per-person detail.
- One-time vendors can be added without joining the vendor list. Adding a vendor from the bill form no longer reloads the page.
- A contractor's bill suggests the Sub-Contract cost type.
- Vehicle quick categories were added to Admin expenses.
- One payment-account picker is used everywhere, plus a split view and touch fixes.
- Another Excel import fix for real date cells being read one day early.

## 2.0.70 – 2.0.82 (2 – 12 October)
- Project expense entry is limited to a fixed list of Chart of Accounts sub-heads, and Equipment and Machinery sub-heads were added.
- **Invoices:** due and extra payments are coloured, extra payments carry forward, and edited invoices are re-posted. Retention got a release date, highlighting, a release action, and its own tables. Retention counts as released only when recorded as a release. The invoice ledger PDF was reworked.
- **Dashboard:** an interactive Dashboard with drill-through, status colours, charts, trends and row actions. Pre-filtered drill-through, regrouped supervisor cards, and a GST breakdown.

## 2.0.84 – 2.0.91 (12 October)
- **Ledger brought in line with Indian accounting practice:** a company profile, CGST, SGST and IGST split by place of supply, retention and customer advances in their own accounts, amounts held to the paisa, and a period lock for closed years.
- Re-posting respects the period lock.
- **Tax invoice:** logo, contact details and registration numbers on the PDF. Purchase-side GST and TDS on vendor bills.
- **GST released on proof of deposit:** tracking, held GST, and a statement.
- **Financial statements:** Profit and Loss and Balance Sheet.
- **Also:** GST returns, a first bank reconciliation, security hardening of the database, and the two guides.
- Summaries count only Sent invoices and approved expenses.

## 2.0.92 – 2.0.96 (14 October): bank reconciliation
- Upload an Excel or CSV bank statement, match it to the books automatically, and tick the matches.
- A side-by-side view of the statement and the books.
- "Record this" enters a statement line that is not in the books (transfer, expense, vendor payment, client receipt, capital, loans, trip expense). "Open this entry" jumps to the original.
- "Done: save this reconciliation" saves a sign-off, with a "Books changed since" warning.
- Staff end-date check and plain-English database errors.

## 2.0.97 – 2.0.101 (14 – 15 October)
- **2.0.97:** one bank line can match several entries in the books that add up to it. Reimbursement to an employee and multi-invoice receipts were added to Record this.
- **2.0.98:** advances to vendors before a bill exists. The oldest advance is set against a bill automatically.
- **2.0.99:** "Vendor bill and payment": make the vendor (if new), the bill and the payment together from a bank statement line.
- **2.0.100:** the calculator works from the keyboard.
- **2.0.101:** trip spending split by Kotak, Cash, CBI and Reimbursement.

## 2.1.01 – 2.1.7 (15 – 16 October)
- **2.1.01:** version numbering set to 2.1.01. From the next release, plain numbers: 2.1.2, 2.1.3 and so on.
- **2.1.2:** items on a vendor bill (name, quantity, unit, rate), with GST kept at the bill level.
- **2.1.3:** change or unmatch a wrong bank statement match.
- **2.1.4:** choose which entries a reimbursement repayment settles. Bank reconciliation shows what the user typed on each entry.
- **2.1.5:** a simpler bank reconciliation: one side-by-side screen, exact matches in green, several-against-one in yellow, no match in red, hand matching of any number of lines, edit an entry without leaving the screen.
- **2.1.6:** Dashboard period cards with a + for details (revenue, trip, admin and project expenses, salary, vendor payments, loans, capital) and a Project summary of every project with the period's spending highlighted.
- **2.1.7:** opening balances for Cash, Kotak and CBI, and a month-by-month check of the entries against the bank statement. A "Paid to vendors" line in the Financial summary.

## 2.1.8 (16 October)
- **Other money received:** a deposit given back, interest, a refund, scrap sold or other income, from Money > Transfers or from "Record this" on a bank statement line. New accounts: Security Deposits and Other Income.
- **Audit fixes** (see the audit summary):
  - Deleting a transfer now removes its entry from the books, and editing one posts it again.
  - Loans and loan repayments are closed to supervisors.
  - The vendor-paid figure in the summary is corrected.
  - A faster database (indexes on every link between tables, and cheaper permission checks).
  - Internal database functions are no longer callable from outside.
  - Automatic payments made from an advance cannot be edited or removed by hand.
  - The period cards and the entry details in Bank reconciliation load faster.
  - The app now checks for a new version every half hour and when you return to it.
  - Dependency security updates (10 known issues down to 3).

## 2.1.9 (16 October): Cash & bank counted from the opening balance
- Each account (Cash, Kotak, CBI) is now counted only from the date of its opening balance. Cash & bank is the opening balance plus the entries dated on or after that day. Older entries stay saved and open from their own screens, but are not counted yet.
- This applies to the Dashboard Cash & bank card and its 30-day trend, the Cash & bank report, Bank reconciliation (the books side, the statement matcher and the sign-off) and the "below zero" health check, which now names the account.
- The Dashboard shows "Counted from <date>" under Cash & bank. An account with no opening balance shows "Opening balance not set", is left out of the total, and is flagged in the Books health check.
- New "Start the books from <month>" button in Reports > Opening and monthly balances: after a month is right, it moves the opening balance back to the first day of that month, using the balance typed for it.
- The monthly check now works from the opening balance in both directions (forward for later months, backward for earlier ones), so months can be checked newest first.
- Client outstanding, retention, vendor dues, the Balance Sheet and the Profit and Loss are not affected: they still use every entry.

## 2.1.10 (16 October): Kotak bank statements can be uploaded
- Bank reconciliation could not read Kotak's Excel statement ("no transaction lines could be read"). Kotak prints a second Dr / Cr column beside the balance, and the app took it for the money-out column. It is now read as the balance's Cr/Dr marker, and a balance marked Dr is read as an overdraft.
- Dates in Excel statements that carry a time (Kotak's Transaction Date) could be read a day late for evening transactions. The day is now taken from the date itself, so the time of day cannot move it.

## 2.1.11 (16 October): Bank reconciliation ignores paise, and saved groups turn green
- Reconciliation ignores a difference of up to 99 paise. An amount that is off by less than a rupee still matches (an exact amount is preferred, and the pair says "amount differs by ..., ignored"). This covers single matches, lump-sum groups and groups made by hand. The reconciliation counts as agreeing when the final difference is 99 paise or less, and so does the saved sign-off.
- A group (several lines matched with one) stays yellow until it is saved with "Tick matched entries"; once saved it turns green, like any other match.

## 2.1.12 (16 October): journal vouchers name the bank
- A Bank line in a journal voucher (for example paying GST from Kotak) now asks which bank it is for, and the voucher cannot be posted without it. Before, the line had no bank, so it never reached Kotak's or CBI's balance or reconciliation.

## 2.1.13 (17 October): Trip records grouped by month
- Trip Records now groups trips under a heading for the month they started in, with the number of trips, the month's total and its "Spent via" split (Kotak, Cash, CBI, Reimbursement). A heading can be folded. The "Group trips within months" box turns it off.

## 2.1.14 (17 October): reimbursements stand out
- Transactions recorded as a reimbursement (paid out of someone's own pocket) now have a faint amber tint and edge, with "Recorded as reimbursement" on hover. It shows in expense records, trip entries, project expenses, the Expense breakdown report, vendor payment records and site imprest transactions.
- In Trip Records, a month heading shows the month on the left and the number of trips and the total on the right.

## 2.1.15 (17 October): Activity by user
- New report, Reports > Activity by user: choose a person and a period to see everything they recorded in one list. It covers expenses, reimbursements, vendor bills, payments and advances, invoices, client receipts, credit and debit notes, transfers, loans, capital, other receipts, wages, site imprest, salary advances, trips and opening balances.
- A summary by type (entries, money in, money out) sits above the list. Dates can filter by the date of each entry or by the day it was recorded. Each row has an Open button, reimbursements are tinted, and the list exports to PDF and Excel. Admin and CXO only.

## 2.1.16 (17 October): records open in a popup
- In Activity by user, Open shows every detail of the record in a popup on the same page instead of leaving it: the names of the vendor, client, project, bank, expense head and trip, who recorded it and when, and the items on a vendor bill. It is read only, with a button to open the record in its own screen to change it.

## 2.1.17 (17 October): View in Bank reconciliation
- Every entry on the books side of Bank reconciliation has a View button that opens the same read-only popup, so an entry can be checked without leaving the matching screen. It also covers entries that have no edit form here (transfers, capital, advances, loan repayments, opening balances).

## 2.1.18 (17 October): search in every record list, and tables fit the page
- A search box above every list of records: expense records, reimbursements, trip-linked project expenses, vendor bills, vendor payments, invoices, receipts, loans, capital, transfers, Trip Records, Activity by user, and the Clients, Projects, Staff, Vendors, Users and Bank accounts lists. Type any part of an ID, description, name, status, date or amount, in any order; every word must match. Amounts match with or without commas or the rupee sign. Vendor bills also match the items on the bill, and trips match the entries logged on them. The list returns to page 1 as you type.
- Tables now fit inside the 1060px page: long text wraps onto a second line instead of pushing the last columns out of sight behind a sideways scrollbar. Amounts and buttons stay on one line.

## 2.1.19 (17 October): reimbursement person, and 24% private loans
- Activity by user: reimbursement entries carry a "Reimbursement" label as well as the tint, and a new "Reimburse to" column names the person owed. For an expense it is the person the Admin named, else whoever recorded it; for a vendor payment in Reimbursement mode it is who paid out of pocket. An Admin can change the person from a drop-down. The Dashboard "Reimbursement due" per person and the Reimbursement records follow it. New "reimburse to" field on expenses (database change).
- Loans: a new Private Party loan starts at 24% a year (2% a month), and the form shows the monthly interest for the principal and rate entered. Bank loans have no preset rate. Existing loans are unchanged.

## 2.1.20 (17 October): search in HR, the vendor ledger and the audit log
- A search box above the HR wage accrual, wage payment and salary advance histories, the site imprest transactions, the Vendor ledger and the Audit log. The vendor ledger's running balance is not affected by a search. The Audit log search covers who changed it, the date, and everything the record held before and after the change (among the 500 most recent changes the report loads).

## 2.1.21 (17 October): one layout for every list, and trip IDs
- **One layout for records.** Every list of records has an arrow at the start of the row that opens its complete details, and a menu at the end with Edit and Delete. Edit opens the record in a popup on the same page; Delete is for Admin only and asks to confirm. Other actions (Record payment, Approve, Invoice PDF, Credit note and so on) are in the same menu. Applies to expenses, trips and trip entries, project bills and expenses, vendor bills, payments and advances, invoices, receipts, reimbursements, transfers, other money received, capital, loans, site imprest, salary advances, wage payments and payroll runs, clients, projects, staff, vendors, users, bank accounts and Activity by user.
- New edit popups for transfers, capital, other money received and vendor advances, which could only be removed before.
- Vendor bills and invoices show the key figures on the row (the rest is under the arrow). Payroll runs and wage payments are final and have no Edit or Delete.
- **Trip IDs are TRP/MM/YY/#** (for example TRP/10/26/3), numbered within the month the trip starts in, and renumbered if the start date moves to another month. Existing trips were renumbered in start order (database change).
- **Trip Records:** bigger month headings, every month folded until opened (a search opens them all), smaller text, an ID column and alternate row shading.
- **Activity by user:** the Status column is removed, the summary by type folds away (closed by default), and Person, the calendar button and Type sit in one row.

## 2.1.22 (17 October): trip ID format, trip details in the menu
- **Trip IDs are now TRP-#/mmyy** (for example TRP-3/1026), still numbered within the month the trip starts in and renumbered when the start date moves to another month. Existing trips were renumbered (database change).
- **Trip Records:** the arrow on a trip shows only its entries. The trip's own details (traveler, project, dates, who recorded it) are under "Details" in the trip's menu. The month headings are slightly smaller.

## 2.1.23 (17 October): trip row layout
- Each trip row shows Trip ID, Location (the project's location), Purpose (the trip name, with its project under it), Dates with the number of days (an open trip counts up to today), Traveller(s) and Amount. When more than one person travelled (the person on the trip plus anyone else who logged an entry on it), every name is shown. The search and the exports cover the new columns.
- The entries under an opened trip are shaded in alternate colours (white and a light blue tint), different from the green tint on the trip rows.

## 2.1.24 (17 October): shading of reimbursement entries
- Under an opened trip, reimbursement entries alternate between a light and a deeper amber, so the alternating rows are still visible when every entry is a reimbursement. Other entries alternate between white and a light blue tint.

## 2.1.25 (17 October): slimmer trip heading
- Under an opened trip, "Entries on this trip", the spent-via split (Kotak, Cash, CBI, Reimbursement) with its total, and the add button are one slim line in a smaller type size. "+ Add expense" is a solid green button.

## 2.1.26 (17 October): sticky trip rows, and records grouped by month
- **Trip Records:** while you scroll through an opened trip's entries, the table header, the trip's own row and the entries heading (with the spend split and + Add expense) stay at the top; they let go when the trip ends. The entries have a Remarks column after the sub-head.
- **Admin and Project expense records, and Activity by user,** are grouped by month (a bold grey bar with the count and total) and, inside a month, by date. Both can be folded. Each date group is blue or green in turn, and its rows alternate a lighter and a slightly deeper tint; reimbursements stay amber. Month and day totals cover everything in them, not only the current page.

## 3.0.2 (18 October): a simpler menu
- **Menu order:** Expenses, Procurement, Clients, Finance, Team, Reports, with Settings apart at the bottom.
- **Expenses** shows only its Admin | Trip | Project switch. Approvals open from the bell. Projects and Enter for a supervisor moved under Team.
- **Clients** has two tabs: Invoice, and Receipts (the receipt form and the payment records, moved off the invoice page). Links that opened a payment now open Receipts.

## 3.0.1 (18 October): the redesign
A new look and a new way round, with new safety checks. Nothing recorded was changed or removed: every row count and total was checked before and after each database change.
- **Design:** a new colour set (deep blue, teal, terracotta, with status colours only for status), Inter type, and one set of buttons, inputs, tags, panels, toasts with Undo, empty states and loading placeholders. Text colours meet WCAG AA.
- **Menu:** Expenses, Procurement, Clients, Team, Finance, Reports, and Settings apart at the bottom. Each is one page with tabs along the top (Finance: Loans, Capital, Transfers, Reconciliation), breadcrumbs, and a title. The logo opens the Dashboard. The menu can shrink to icons. The last tab used in each place is remembered. "+ New entry" is always at the top (a round button on a phone). On a phone, tables become cards and there is a bottom bar.
- **Entering expenses:** the date comes first, large. A trip is chosen from a searchable list of active and closed trips grouped by month, and its date is limited to the trip's dates (the database checks this for new and edited entries only; ten older entries outside their trips were left alone). A trip entry can be linked to a project. "Entered on behalf of" (optional) and remarks are under More details. Before saving you see the entry as one sentence, with warnings for a future date, a date over 30 days old, an unusually large amount, and a possible duplicate (same amount, within 2 days, same person, in any module). Saving anyway after a duplicate warning needs a reason. After saving: a toast with the ID and Undo; Ctrl+Enter saves; "My entries today" lists what you entered.
- **Records:** click a row to open a side panel (a bottom sheet on a phone) with ID, status, amount, date, every detail, and Edit / Looks right / Delete. Rows are plain zebra; reimbursable rows have an amber edge, tint and an initials badge.
- **Trash:** deleting an expense, reimbursement, capital entry, transfer, other receipt, loan or loan payment moves it to the Trash (Settings, Additional Settings) instead of removing it. An Admin restores it, with its entry in the books. An entry matched in bank reconciliation must be unmatched first. Invoices, bills and their payments still delete for good.
- **Activity by user:** every entry in every module, newest entered first, with who entered it and on whose behalf, cost centre / project / trip, and a Checked tick; filters for person, module, dates and Unchecked only; a daily summary (entries today, total, unchecked, possible duplicates, missing receipts).
- **Possible duplicates:** a new report with Not a duplicate (undoable), Open and Delete.
- **Bank reconciliation:** statement lines, matches and groups are saved (a statement is loaded once). Any dates, default the last 7 days. Books and statement side by side with the same columns, matched pairs on one row, unmatched in two panels, suggestions to confirm, group matches with GRP-0001 references, reviewed ticks, filters (All, Unreviewed, Reviewed, Matched, Unmatched) and a summary bar. Editing a matched entry breaks its match. A reconciled period can be locked; only an admin can unlock it, with a reason, for 30 minutes. Everything is in a history.
- **Database (all additive):** new nullable columns (on behalf of, duplicate reason, deleted-at marks) and new tables (reviews, duplicate marks, statement lines, matches, history, locks). Nothing existing was updated, deleted or backfilled.

## 2.1.28 (17 October): blue and white shading, folded months, one toolbar
- **Months start folded** in the Admin and Project expense records and in Activity by user. Click a month to open it; searching opens every month.
- **Blue and white shading.** The grouped records and Trip Records now use blue shades with white, with no cream. In Trip Records each trip, with its entries, is blue or white in turn, under a grey month bar like the expense records. Reimbursements stay amber.
- **One toolbar for every records list:** the calendar and filters, then the search box, then the PDF and Excel icons at the right, all on one row. The search box now sits in that row instead of on its own line.

## 2.1.27 (17 October): cream instead of green
- Row shading no longer uses green. In the grouped records (Admin and Project expenses, Activity by user), date groups alternate blue and white/cream. The shaded trip rows in Trip Records are cream. Reimbursement rows are a stronger amber so they stand out from the cream.
