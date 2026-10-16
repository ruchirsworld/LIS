# LIS changes since v2.0.1

Version 2.0.1 was released on 3 September 2026. This list covers everything after it, up to 2.1.12. It is put together from the project history, grouped by area. Version numbers are shown where a release carried one.

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
