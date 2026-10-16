import { useMemo, useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { fmt, fmtDate, parseINR } from '../../lib/calc/format'
import { buildMonthlyCheck, differenceHint, monthStart, monthsBetween } from '../../lib/calc/monthlyBalances'
import { getErrorMessage } from '../../lib/errors'
import { toast } from '../../lib/feedback'
import { useBankAccounts } from '../../lib/queries/masters'
import { useAccountMovements, useAccountOpenings, useMonthBalances, useSaveAccountOpening, useSaveMonthBalance } from '../../lib/queries/openings'
import type { DateRange } from '../../lib/calc/reportPeriod'
import type { ExportSection } from '../../lib/export/report'
import { ReportExportButtons } from './ReportExportButtons'

const todayStr = () => new Date().toISOString().slice(0, 10)
const monthLabel = (month: string) => new Date(`${month}T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

interface AccountOption {
  /** null is Cash in hand. */
  id: string | null
  name: string
}

/** One account's opening balance: a single figure posted to the books on the date they start. */
function OpeningRow({ account, booksBalance, uncounted, firstEntry, saved, suggestion }: { account: AccountOption; booksBalance: number | null; uncounted: number; firstEntry: string | null; saved: { as_on: string; amount: number } | null; suggestion: { month: string; balance: number } | null }) {
  const save = useSaveAccountOpening()
  const [asOn, setAsOn] = useState(saved?.as_on ?? suggestion?.month ?? firstEntry ?? todayStr())
  const [amount, setAmount] = useState(saved ? String(saved.amount) : '')

  async function submit(clear = false) {
    try {
      await save.mutateAsync({ bankAccountId: account.id, asOn, amount: clear ? null : parseINR(amount) })
      if (clear) setAmount('')
      toast('success', clear ? `${account.name} opening balance removed.` : `${account.name} opening balance saved.`)
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not save the opening balance.'))
    }
  }

  return (
    <tr>
      <td>
        <strong>{account.name}</strong>
        {firstEntry && <div className="retention-note">Oldest entry {fmtDate(firstEntry)}</div>}
      </td>
      <td className="amt" style={{ color: booksBalance !== null && booksBalance < -0.004 ? 'var(--red)' : undefined, fontWeight: booksBalance !== null && booksBalance < -0.004 ? 700 : undefined }}>
        {booksBalance === null ? <span className="retention-note">Opening balance not set: left out of Cash &amp; bank</span> : fmt(booksBalance)}
        {booksBalance !== null && booksBalance < -0.004 && <div className="retention-note" style={{ color: 'var(--red)' }}>Below zero: an entry or the opening balance is missing</div>}
        {uncounted > 0 && <div className="retention-note">{uncounted} older entr{uncounted === 1 ? 'y is' : 'ies are'} not counted</div>}
      </td>
      <td>
        <input type="date" aria-label={`${account.name} books start date`} value={asOn} onChange={(e) => setAsOn(e.target.value)} />
      </td>
      <td style={{ textAlign: 'right' }}>
        <CurrencyInput aria-label={`${account.name} opening balance`} value={amount} onValueChange={setAmount} style={{ textAlign: 'right', width: 140 }} />
        {suggestion && !saved && (
          <div>
            <button
              type="button"
              className="btn link"
              style={{ padding: 0, fontSize: 12 }}
              onClick={() => {
                setAsOn(suggestion.month)
                setAmount(String(suggestion.balance))
              }}
            >
              Start from {fmtDate(suggestion.month)} with {fmt(suggestion.balance)}, the balance typed below
            </button>
          </div>
        )}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <Button type="button" onClick={() => void submit()} disabled={save.isPending || !asOn || amount === ''}>
          Save
        </Button>{' '}
        {saved && (
          <Button type="button" variant="secondary" onClick={() => void submit(true)} disabled={save.isPending}>
            Remove
          </Button>
        )}
      </td>
    </tr>
  )
}

/** Moves an account's books start back to the first day of a month, using the balance typed for it. */
function StartHereButton({ account, month, balance }: { account: AccountOption; month: string; balance: number }) {
  const save = useSaveAccountOpening()
  async function start() {
    try {
      await save.mutateAsync({ bankAccountId: account.id, asOn: month, amount: balance })
      toast('success', `${account.name} books now start on ${fmtDate(month)} with ${fmt(balance)}. Entries from that day are counted.`)
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not move the start date.'))
    }
  }
  return (
    <Button type="button" variant="secondary" onClick={() => void start()} disabled={save.isPending}>
      Start the books from {monthLabel(month)}
    </Button>
  )
}

/** The statement's balance at the start of one month. Saved when you leave the box. */
function MonthBalanceInput({ account, month, value }: { account: AccountOption; month: string; value: number | null }) {
  const save = useSaveMonthBalance()
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  const [shown, setShown] = useState(value)
  // Pick up a change made elsewhere (another account tab, or after saving).
  if (shown !== value && draft === (shown === null ? '' : String(shown))) {
    setShown(value)
    setDraft(value === null ? '' : String(value))
  }

  async function commit() {
    const next = draft.trim() === '' ? null : parseINR(draft)
    if (next === value) return
    try {
      await save.mutateAsync({ bankAccountId: account.id, month, balance: next })
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not save that balance.'))
    }
  }

  return (
    <CurrencyInput
      aria-label={`${account.name} balance on ${monthLabel(month)}, start of the month`}
      value={draft}
      onValueChange={setDraft}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      style={{ textAlign: 'right', width: 150 }}
    />
  )
}

/** Opening balances for cash and each bank, and a month-by-month check of the entries against the statement. */
export function MonthlyBalancesReport({ range: _range }: { range: DateRange | null }) {
  void _range
  const { data: banks } = useBankAccounts()
  const { data: movements } = useAccountMovements()
  const { data: openings } = useAccountOpenings()
  const { data: monthBalances } = useMonthBalances()
  const accounts = useMemo<AccountOption[]>(() => [{ id: null, name: 'Cash' }, ...(banks ?? []).map((b) => ({ id: b.id, name: b.name }))], [banks])
  const [pickedId, setPickedId] = useState<string | null | undefined>(undefined)
  const account = accounts.find((a) => a.id === (pickedId === undefined ? accounts[1]?.id ?? null : pickedId)) ?? accounts[0]

  const forAccount = (id: string | null) => (movements ?? []).filter((m) => m.bank_account_id === id)
  // Real movements only: the opening balance entry is the starting point, not something that moved.
  const realMovements = forAccount(account?.id ?? null).filter((m) => m.source_table !== 'account_openings')
  const openingOf = (id: string | null) => (openings ?? []).find((o) => o.bank_account_id === id) ?? null
  // The account's opening balance is the starting point for every month's calculation, in both directions.
  const savedStart = openingOf(account?.id ?? null)
  const startInfo = savedStart ? { date: savedStart.as_on, amount: Number(savedStart.amount) } : null

  const balances = useMemo(
    () => new Map((monthBalances ?? []).filter((b) => b.bank_account_id === (account?.id ?? null)).map((b) => [b.month, Number(b.balance)])),
    [monthBalances, account]
  )

  const first = [...realMovements.map((m) => m.date), ...[...balances.keys()], ...(startInfo ? [startInfo.date] : [])].filter(Boolean).sort()[0] ?? null
  const thisMonth = monthStart(todayStr())
  const months = monthsBetween(first ? monthStart(first) : monthsBetween(thisMonth, thisMonth)[0], thisMonth)
  const rows = buildMonthlyCheck(months, realMovements.map((m) => ({ date: m.date, debit: m.debit, credit: m.credit })), balances, startInfo)
  const shownRows = [...rows].reverse() // newest first, the way entries are being made

  const agrees = rows.filter((r) => r.status === 'agrees').length
  const differs = rows.filter((r) => r.status === 'differs').length
  const waiting = rows.filter((r) => r.status === 'waiting' || r.status === 'no-opening').length

  const sections: ExportSection[] = [
    {
      title: `Monthly check: ${account?.name ?? ''}`,
      columns: ['Month', 'Opening as per statement (typed)', 'Opening calculated by the app', 'Difference', 'Money in (books)', 'Money out (books)', "This month's entries off by"],
      rows: shownRows.map((r) => [monthLabel(r.month), r.statementOpening ?? '', r.calculatedOpening, r.openingDifference ?? '', r.moneyIn, r.moneyOut, r.monthDifference ?? '']),
      numericColumns: [1, 2, 3, 4, 5, 6],
      decimals: 2,
    },
  ]

  return (
    <div className="report-panel">
      <div className="note" style={{ marginTop: 0 }}>
        There are two kinds of opening balance here. The first is <strong>typed by you</strong>, from the bank statement or cash book, for Kotak, CBI and Cash. The second is <strong>calculated by the app</strong>, from the entries you
        have made. Putting the two side by side for every month shows where an entry is missing or wrong, so you can correct it. <strong>Step 1</strong> gives each account its starting balance. Cash &amp; bank, the Dashboard and Bank
        reconciliation count an account <strong>only from that date</strong>, so a half-finished back-fill never shows a wrong figure. <strong>Step 2</strong> compares the two for each month.
      </div>

      <h3 style={{ margin: '14px 0 6px', fontSize: 15 }}>Step 1: opening balance in the books</h3>
      <div className="note" style={{ marginTop: 0 }}>
        Enter it once for each account: the balance on the bank statement (or cash in hand) at the start of the day you want the books to count from. It is posted against Opening Balance Equity, and everything dated before it is
        left out of Cash &amp; bank (those entries stay saved and can be opened from their own screens). An account without an opening balance is left out altogether. When you finish an older month, move the date back with the
        <strong> Start the books from</strong> button in Step 2.
      </div>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Account</th>
              <th style={{ textAlign: 'right' }}>Books balance today</th>
              <th>Books start on</th>
              <th style={{ textAlign: 'right' }}>Opening balance (₹)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const lines = forAccount(a.id).filter((m) => m.source_table !== 'account_openings')
              const firstEntry = lines.map((m) => m.date).filter(Boolean).sort()[0] ?? null
              const saved = openingOf(a.id)
              // The latest month with a typed balance (not in the future) is the natural place to start counting from.
              const latestTyped = (monthBalances ?? []).filter((b) => b.bank_account_id === a.id && b.month <= todayStr()).sort((x, y) => y.month.localeCompare(x.month))[0]
              const counted = saved ? forAccount(a.id).filter((m) => m.date >= saved.as_on) : []
              return (
                <OpeningRow
                  key={`${a.id}-${saved?.id ?? 'none'}-${saved?.amount ?? ''}-${saved?.as_on ?? ''}`}
                  account={a}
                  booksBalance={saved ? counted.reduce((s, m) => s + m.debit - m.credit, 0) : null}
                  uncounted={lines.length - counted.filter((m) => m.source_table !== 'account_openings').length}
                  firstEntry={firstEntry}
                  saved={saved ? { as_on: saved.as_on, amount: Number(saved.amount) } : null}
                  suggestion={latestTyped ? { month: latestTyped.month, balance: Number(latestTyped.balance) } : null}
                />
              )
            })}
          </tbody>
        </table>
      </div>

      <h3 style={{ margin: '22px 0 6px', fontSize: 15 }}>Step 2: check each month against the statement</h3>
      <div className="pill-tabs" role="group" aria-label="Account" style={{ marginBottom: 8 }}>
        {accounts.map((a) => (
          <button key={a.id ?? 'cash'} type="button" className={a.id === (account?.id ?? null) ? 'pill active' : 'pill'} onClick={() => setPickedId(a.id)}>
            {a.name}
          </button>
        ))}
      </div>
      <div className="note" style={{ marginTop: 0 }}>
        <strong>You type</strong> the balance shown on the {account?.id ? 'bank statement' : 'cash book'} at the <strong>start</strong> of each month (the opening balance printed at the top of that month&rsquo;s statement).{' '}
        <strong>The app calculates</strong> the same balance from your entries, working from the opening balance in Step 1: forward from it for later months, and backward from it for earlier months. If the two differ, entries are
        missing or wrong. The last column shows which month the difference <em>started</em> in: if the difference is the same one month to the next, that month is fine. A month is checked once you have typed its balance and the
        next month&rsquo;s. When a month is right, press <strong>Start the books from</strong> to count it in Cash &amp; bank, the Dashboard and Bank reconciliation.
      </div>
      <div className="note" style={{ fontWeight: 600 }}>
        {agrees} month{agrees === 1 ? '' : 's'} agree{agrees === 1 ? 's' : ''}, <span style={{ color: differs ? 'var(--red)' : undefined }}>{differs} differ{differs === 1 ? 's' : ''}</span>, {waiting} waiting for a balance.
      </div>
      <ReportExportButtons title="Monthly balance check" sections={sections} range={null} />
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Month</th>
              <th style={{ textAlign: 'right' }}>Opening as per statement (you type) ₹</th>
              <th style={{ textAlign: 'right' }}>Opening calculated by the app</th>
              <th style={{ textAlign: 'right' }}>Difference</th>
              <th style={{ textAlign: 'right' }}>Money in (books)</th>
              <th style={{ textAlign: 'right' }}>Money out (books)</th>
              <th>This month&rsquo;s entries</th>
            </tr>
          </thead>
          <tbody>
            {shownRows.map((r) => (
              <tr key={r.month} style={r.status === 'differs' ? { background: 'var(--red-soft)' } : r.status === 'agrees' ? { background: 'var(--green-soft)' } : undefined}>
                <td>{monthLabel(r.month)}</td>
                <td style={{ textAlign: 'right' }}>
                  <MonthBalanceInput key={`${account?.id ?? 'cash'}-${r.month}`} account={account} month={r.month} value={r.statementOpening} />
                </td>
                <td className="amt">{fmt(r.calculatedOpening)}</td>
                <td className="amt" style={{ color: r.openingDifference !== null && Math.abs(r.openingDifference) >= 0.005 ? 'var(--red)' : undefined, fontWeight: r.openingDifference !== null && Math.abs(r.openingDifference) >= 0.005 ? 700 : undefined }}>
                  {r.openingDifference === null ? '—' : Math.abs(r.openingDifference) < 0.005 ? 'Nil' : fmt(r.openingDifference)}
                </td>
                <td className="amt">{fmt(r.moneyIn)}</td>
                <td className="amt">{fmt(r.moneyOut)}</td>
                <td>
                  {r.status === 'agrees' && <span style={{ color: 'var(--green)', fontWeight: 600 }}>Agrees</span>}
                  {r.status === 'differs' && (
                    <>
                      <strong style={{ color: 'var(--red)' }}>Off by {fmt(Math.abs(r.monthDifference as number))}</strong>
                      <div className="retention-note">{differenceHint(r.monthDifference as number)}</div>
                    </>
                  )}
                  {r.status === 'waiting' && <span className="retention-note">Type the next month&rsquo;s balance to check this month</span>}
                  {r.status === 'no-opening' && <span className="retention-note">Type this month&rsquo;s opening balance</span>}
                  {startInfo && monthStart(startInfo.date) === r.month && <div className="retention-note"><strong>Books start {fmtDate(startInfo.date)}</strong></div>}
                  {r.statementOpening !== null && (!startInfo || r.month < startInfo.date) && (
                    <div style={{ marginTop: 4 }}>
                      <StartHereButton account={account} month={r.month} balance={r.statementOpening} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
