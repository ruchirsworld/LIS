import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, CircleCheck } from 'lucide-react'
import { Button, EmptyState, StatusTag, TableSkeleton } from '../../components/ui'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { PeriodFilterToggle } from '../../components/PeriodFilterToggle'
import { fmt2, fmtDate } from '../../lib/calc/format'
import { summariseReconciliation, withinTolerance } from '../../lib/calc/bankReconciliation'
import { bankKey, bookKey, groupProblem, ledgerKey, matchKey, partition, passesFilter, suggest, summarise, withRunningBalance, type BookRow, type PairRow, type ReconFilter } from '../../lib/calc/reconView'
import { useBankAccounts } from '../../lib/queries/masters'
import { useBankLines, useClearedBankLines } from '../../lib/queries/books'
import { useAccountOpenings } from '../../lib/queries/openings'
import {
  useBankMatches,
  useReconLock,
  useReconReviews,
  useSaveMatch,
  useStatementLines,
  useToggleReconReview,
  useUnmatch,
  type StatementRecord,
} from '../../lib/queries/recon'
import { useAuth } from '../../lib/auth'
import { getErrorMessage } from '../../lib/errors'
import { confirmAction, toast } from '../../lib/feedback'
import type { DateRange } from '../../lib/calc/reportPeriod'
import type { StatementLine } from '../../lib/import/bankStatement'
import { ImportStatement } from './ImportStatement'
import { ReconLockPanel } from './ReconLockPanel'
import { BankSignoff } from './BankSignoff'
import { RecordPanel } from './RecordPanel'
import { RecordFromStatement } from './RecordFromStatement'
import { EditEntryModal } from './EditEntryModal'
import { canShowRecord } from './RecordDetailModal'
import { useGoTo } from '../../lib/navContext'
import { resolveEntryTarget } from '../../lib/entryTarget'
import './Recon.css'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const FILTERS: { id: ReconFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unreviewed', label: 'Unreviewed' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'matched', label: 'Matched' },
  { id: 'unmatched', label: 'Unmatched' },
]

type Forbidden = { bankLineId: string; ledgerKey: string }
const forbiddenKey = (bankId: string) => `lis.recon.forbidden.${bankId}`
function loadForbidden(bankId: string): Forbidden[] {
  try {
    const raw = localStorage.getItem(forbiddenKey(bankId))
    return raw ? (JSON.parse(raw) as Forbidden[]) : []
  } catch {
    return []
  }
}

/** The reference shown beside a books entry: the part of the system's label after the dash (its ID). */
const refOfBook = (b: BookRow) => (b.description.includes(' — ') ? b.description.split(' — ').slice(1).join(' — ') : '')
const labelOfBook = (b: BookRow) => b.detail || b.description.split(' — ')[0]

/** 15 Oct: the year is clear from the dates being shown. */
const shortDate = (d: string) => fmtDate(d).replace(/ \d{4}$/, '')
const num = (n: number) => fmt2(n).replace('₹', '')

/** The one set of columns both sides use: Date | Description | Reference | Debit | Credit | Balance. Debit is money out, credit is money in. */
function Cells({ date, description, reference, debit, credit, balance }: { date: string; description: string; reference: string; debit: number; credit: number; balance: number | null }) {
  return (
    <>
      <span className="rc-date" title={fmtDate(date)}>{shortDate(date)}</span>
      <span className="rc-desc" title={[description, reference].filter(Boolean).join(' · ')}>
        <span>{description || '(no description)'}</span>
        {reference && <span className="rc-ref">{reference}</span>}
      </span>
      <span className="rc-num rc-debit">{debit ? num(debit) : ''}</span>
      <span className="rc-num rc-credit">{credit ? num(credit) : ''}</span>
      <span className="rc-num rc-bal">{balance === null ? '' : num(balance)}</span>
    </>
  )
}

const bookCells = (b: BookRow) => <Cells date={b.date} description={labelOfBook(b)} reference={refOfBook(b)} debit={b.withdrawal} credit={b.deposit} balance={b.balance} />
const bankCells = (k: StatementRecord) => <Cells date={k.line_date} description={k.description} reference={k.reference} debit={k.debit} credit={k.credit} balance={k.balance} />

const HeadCells = () => (
  <>
    <span>Date</span>
    <span>Description / reference</span>
    <span className="rc-num">Debit</span>
    <span className="rc-num">Credit</span>
    <span className="rc-num">Balance</span>
  </>
)

/** Bank reconciliation: your books on one side, the bank statement on the other, over any dates. Matches, groups, review ticks and locks are
 * saved, so the work can be carried on later without loading anything again. */
export function ReconWorkspace() {
  const { profile } = useAuth()
  const goTo = useGoTo()
  const { data: accounts } = useBankAccounts()
  const [bankId, setBankId] = useState<string | null>(null)
  const selected = bankId ?? accounts?.[0]?.id ?? null
  const accountName = accounts?.find((a) => a.id === selected)?.name ?? ''

  // The last 7 days to begin with; the calendar button changes it (or shows everything).
  const defaultRange = useMemo(() => ({ from: iso(addDays(new Date(), -7)), to: iso(new Date()), nonce: 1 }), [])
  const [range, setRange] = useState<DateRange | null>({ from: defaultRange.from, to: defaultRange.to })
  const [filter, setFilter] = useState<ReconFilter>('all')
  const [search, setSearch] = useState('')
  const [days, setDays] = useState(3)
  const [selBooks, setSelBooks] = useState<Set<string>>(new Set())
  const [selBank, setSelBank] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [panel, setPanel] = useState<{ table: string; id: string; book: BookRow } | null>(null)
  const [editing, setEditing] = useState<BookRow | null>(null)
  const [recording, setRecording] = useState<StatementLine | null>(null)
  const [forbiddenState, setForbiddenState] = useState<{ bank: string | null; list: Forbidden[] }>({ bank: null, list: [] })

  const { data: ledger } = useBankLines(selected)
  const { data: openings } = useAccountOpenings()
  const { data: statement, isLoading: loadingStatement } = useStatementLines(selected)
  const { data: matches } = useBankMatches(selected)
  const { data: reviews } = useReconReviews(selected)
  const { data: clearedMap } = useClearedBankLines(selected)
  const { data: lock } = useReconLock(selected)
  const saveMatch = useSaveMatch(selected ?? '')
  const unmatch = useUnmatch(selected ?? '')
  const toggleReview = useToggleReconReview(selected ?? '')

  const booksStart = openings?.find((o) => o.bank_account_id === selected)?.as_on ?? null
  const startMissing = !!selected && !!openings && booksStart === null

  const forbidden = forbiddenState.bank === selected ? forbiddenState.list : selected ? loadForbidden(selected) : []
  function addForbidden(pairs: Forbidden[]) {
    if (!selected) return
    const list = [...forbidden, ...pairs]
    try {
      localStorage.setItem(forbiddenKey(selected), JSON.stringify(list))
    } catch {
      // The choice just will not survive a reload.
    }
    setForbiddenState({ bank: selected, list })
  }

  const inRange = (date: string) => !range || ((!range.from || date >= range.from) && (!range.to || date <= range.to))

  const model = useMemo(() => {
    const books = withRunningBalance((ledger ?? []).map((l) => ({ id: l.id, date: l.date, description: l.description, detail: l.detail, deposit: l.deposit, withdrawal: l.withdrawal, sourceTable: l.sourceTable, sourceId: l.sourceId })))
    const bank = statement ?? []
    const p = partition(books, bank, matches ?? [])
    const matchedShown = p.matched.filter((m) => [...m.books.map((b) => b.date), ...m.bank.map((k) => k.line_date)].some(inRange))
    const booksOnly = p.booksOnly.filter((b) => inRange(b.date))
    const bankOnly = p.bankOnly.filter((k) => inRange(k.line_date))
    const s = suggest(booksOnly, bankOnly, { days, forbidden })
    return { books, bank, matched: matchedShown, suggestions: s.suggestions, booksLeft: s.booksLeft, bankLeft: s.bankLeft }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger, statement, matches, range, days, forbidden.length, selected])

  const isReviewed = (key: string) => !!reviews?.has(key)
  const summary = summarise({ matched: model.matched, suggested: model.suggestions, booksOnly: model.booksLeft, bankOnly: model.bankLeft })

  // What the two sides add up to at the end of the dates shown.
  const toDate = range?.to ?? iso(new Date())
  const lastStatement = [...model.bank].filter((k) => k.line_date <= toDate && k.balance !== null).sort((a, b) => a.line_date.localeCompare(b.line_date)).pop()
  const booksBalance = [...model.books].filter((b) => b.date <= toDate).pop()?.balance ?? 0
  const statementBalance = lastStatement?.balance ?? null

  // The old tick figures still drive the sign-off, since saving a match ticks its books entries.
  const cleared = useMemo(() => {
    const set = new Set(clearedMap?.keys() ?? [])
    for (const l of ledger ?? []) if (l.sourceTable === 'account_openings') set.add(l.id)
    return set
  }, [clearedMap, ledger])
  const signoffSummary = useMemo(() => summariseReconciliation(ledger ?? [], cleared, statementBalance ?? 0, toDate), [ledger, cleared, statementBalance, toDate])

  const textOf = (b: BookRow) => [b.description, b.detail, b.date, b.deposit, b.withdrawal]
  const bankText = (k: StatementRecord) => [k.description, k.reference, k.line_date, k.debit, k.credit]
  const pairText = (m: PairRow) => [m.groupRef, m.total, ...m.books.flatMap(textOf), ...m.bank.flatMap(bankText)]

  const showPair = (m: PairRow) => {
    const matched = m.kind === 'matched'
    return passesFilter(filter, { matched, reviewed: matched && isReviewed(matchKey(m.matchId ?? '')) }) && matchesSearch(search, pairText(m))
  }
  const pairs = [...model.matched, ...model.suggestions].filter(showPair).sort((a, b) => b.date.localeCompare(a.date))
  const showBook = (b: BookRow) => passesFilter(filter, { matched: false, reviewed: isReviewed(bookKey(b)) }) && matchesSearch(search, textOf(b))
  const showBank = (k: StatementRecord) => passesFilter(filter, { matched: false, reviewed: isReviewed(bankKey(k.id)) }) && matchesSearch(search, bankText(k))
  const booksOnly = model.booksLeft.filter(showBook)
  const bankOnly = model.bankLeft.filter(showBank)

  const chosenBooks = model.booksLeft.filter((b) => selBooks.has(b.id))
  const chosenBank = model.bankLeft.filter((k) => selBank.has(k.id))
  const problem = chosenBooks.length + chosenBank.length > 0 ? groupProblem(chosenBank, chosenBooks) : null
  const canMatch = chosenBooks.length > 0 && chosenBank.length > 0 && !problem
  const sideTotal = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100

  const flip = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  async function review(key: string) {
    if (!profile || !selected) return
    try {
      await toggleReview.mutateAsync({ itemKey: key, reviewed: !isReviewed(key), userId: profile.id })
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not save the tick.'))
    }
  }

  async function confirm(m: PairRow, kind: 'auto' | 'manual'): Promise<boolean> {
    try {
      await saveMatch.mutateAsync({ bankLineIds: m.bank.map((k) => k.id), journalLineIds: m.books.map((b) => b.id), kind })
      return true
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not save that match.'))
      return false
    }
  }

  async function confirmAll() {
    let done = 0
    for (const m of model.suggestions) if (await confirm(m, 'auto')) done += 1
    if (done > 0) toast('success', `${done} match${done === 1 ? '' : 'es'} saved.`)
  }

  function reject(m: PairRow) {
    addForbidden(m.bank.flatMap((k) => m.books.map((b) => ({ bankLineId: k.id, ledgerKey: ledgerKey(b) }))))
  }

  async function matchSelected() {
    const pair: PairRow = {
      kind: 'suggested', key: 'hand', matchId: null, groupRef: null, books: chosenBooks, bank: chosenBank,
      total: 0, difference: 0, direction: 'in', date: '',
    }
    if (await confirm(pair, 'manual')) {
      toast('success', chosenBooks.length + chosenBank.length > 2 ? 'Matched as a group.' : 'Matched.')
      setSelBooks(new Set())
      setSelBank(new Set())
    }
  }

  async function doUnmatch(m: PairRow) {
    if (!m.matchId) return
    const ok = await confirmAction({
      title: m.groupRef ? `Take ${m.groupRef} apart?` : 'Unmatch this?',
      message: 'The lines go back to "no match" and are not joined again on their own. Their tick is taken off.',
      confirmLabel: m.groupRef ? 'Ungroup' : 'Unmatch',
      danger: true,
    })
    if (!ok) return
    try {
      await unmatch.mutateAsync({ matchId: m.matchId })
      addForbidden(m.bank.flatMap((k) => m.books.map((b) => ({ bankLineId: k.id, ledgerKey: ledgerKey(b) }))))
    } catch (err) {
      toast('error', getErrorMessage(err, 'Could not unmatch.'))
    }
  }

  async function openScreen(b: BookRow) {
    const target = await resolveEntryTarget(b.sourceTable, b.sourceId, b.date)
    if (!target || !goTo) {
      toast('info', `I cannot open this one directly. Look for it dated ${fmtDate(b.date)} in its own screen.`)
      return
    }
    goTo(target.tab, { costCenter: target.costCenter, filter: target.filter })
  }

  const asStatementLine = (k: StatementRecord): StatementLine => ({ row: 0, date: k.line_date, description: k.description, reference: k.reference, deposit: k.credit, withdrawal: k.debit, balance: k.balance })

  const ReviewTick = ({ itemKey }: { itemKey: string }) => (
    <button
      type="button"
      className={isReviewed(itemKey) ? 'rc-review reviewed' : 'rc-review'}
      aria-pressed={isReviewed(itemKey)}
      aria-label={isReviewed(itemKey) ? 'Reviewed. Click to remove' : 'Mark as reviewed'}
      title={isReviewed(itemKey) ? 'Reviewed' : 'Mark as reviewed'}
      onClick={() => void review(itemKey)}
    >
      {isReviewed(itemKey) ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}
    </button>
  )

  const bookActions = (b: BookRow) => (
    <span className="rc-actions">
      {b.sourceTable && b.sourceId && canShowRecord(b.sourceTable) && (
        <Button type="button" variant="link" onClick={() => setPanel({ table: b.sourceTable as string, id: b.sourceId as string, book: b })}>
          View
        </Button>
      )}
      {b.sourceTable !== 'account_openings' && (
        <Button type="button" variant="link" onClick={() => setEditing(b)}>
          Edit
        </Button>
      )}
    </span>
  )

  return (
    <div className="recon">
      <div className="toolbar">
        <div className="toolbar-group toolbar-fill">
          <PeriodFilterToggle range={range} onChange={setRange} preset={defaultRange} />
          <div className="field" style={{ flex: '0 1 200px' }}>
            <label htmlFor="rec-bank">Bank account</label>
            <select id="rec-bank" value={selected ?? ''} onChange={(e) => { setBankId(e.target.value); setSelBooks(new Set()); setSelBank(new Set()) }}>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: '0 1 160px' }}>
            <label htmlFor="rec-filter">Show</label>
            <select id="rec-filter" value={filter} onChange={(e) => setFilter(e.target.value as ReconFilter)}>
              {FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <TableSearch value={search} onChange={setSearch} inline placeholder="Search description, amount, reference or GRP-…" />
        </div>
        {selected && !startMissing && <ImportStatement bankId={selected} bankName={accountName} />}
      </div>

      {!accounts?.length && <div className="empty-row">No bank accounts yet. Add one in Settings.</div>}
      {startMissing && (
        <div className="note recon-warn">
          <strong>{accountName} has no opening balance yet.</strong> The books for an account start on the date of its opening balance, so nothing is listed here until you set it. Go to Reports, then Opening and monthly balances.
        </div>
      )}
      {booksStart && (
        <div className="note" style={{ marginTop: 0 }}>
          {accountName} is counted from <strong>{fmtDate(booksStart)}</strong>, the date of its opening balance.
        </div>
      )}

      {selected && !startMissing && (
        <>
          <div className="recon-summary" role="status">
            <span className="recon-chip recon-chip-matched">
              <CircleCheck size={14} aria-hidden="true" /> {summary.matched} matched{summary.groups > 0 ? ` (${summary.groups} group${summary.groups === 1 ? '' : 's'})` : ''}
            </span>
            {summary.suggested > 0 && <span className="recon-chip recon-chip-suggested">{summary.suggested} suggested</span>}
            <span className={summary.unmatchedBooks + summary.unmatchedBank > 0 ? 'recon-chip recon-chip-open' : 'recon-chip'}>
              {summary.unmatchedBooks + summary.unmatchedBank} unmatched ({summary.unmatchedBooks} books, {summary.unmatchedBank} bank)
            </span>
            <span className="recon-chip">
              Books {fmt2(booksBalance)}
              {statementBalance !== null ? ` · Statement ${fmt2(statementBalance)}` : ''}
              {statementBalance !== null ? ` · Difference ${fmt2(Math.round((statementBalance - booksBalance) * 100) / 100)}` : ''}
            </span>
            <label className="recon-days">
              Suggest when dates are within
              <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[0, 1, 3, 7].map((d) => (
                  <option key={d} value={d}>
                    {d === 0 ? 'the same day' : `${d} day${d === 1 ? '' : 's'}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {(loadingStatement || !ledger) && <TableSkeleton rows={4} columns={6} />}

          {ledger && (
            <>
              <section className="recon-pairs" aria-label="Matched and suggested">
                <div className="recon-pair recon-pair-head">
                  <span className="rc-lead" />
                  <div className="recon-half">
                    <strong className="recon-title">Your books</strong>
                    <div className="recon-grid">
                      <HeadCells />
                    </div>
                  </div>
                  <div className="recon-half">
                    <strong className="recon-title">Bank statement</strong>
                    <div className="recon-grid">
                      <HeadCells />
                    </div>
                  </div>
                  <span className="rc-tail" />
                </div>

                {model.suggestions.length > 0 && filter !== 'matched' && (
                  <div className="recon-suggest-bar">
                    <span>
                      <strong>{model.suggestions.length}</strong> suggested match{model.suggestions.length === 1 ? '' : 'es'}. Look them over, then confirm.
                    </span>
                    <Button type="button" onClick={() => void confirmAll()} disabled={saveMatch.isPending}>
                      Confirm all suggestions
                    </Button>
                  </div>
                )}

                {pairs.length === 0 && <EmptyState title="No matches to show">Matched and suggested pairs for these dates and filters appear here.</EmptyState>}
                {pairs.map((m) => {
                  const matched = m.kind === 'matched'
                  const many = m.books.length > 1 || m.bank.length > 1
                  const expanded = open.has(m.key)
                  return (
                    <div key={m.key} className={matched ? 'recon-pair recon-matched' : 'recon-pair recon-suggested'}>
                      <span className="rc-lead">
                        {matched ? <CircleCheck size={18} className="rc-matched-icon" aria-label="Matched" /> : null}
                        {matched && m.matchId && <ReviewTick itemKey={matchKey(m.matchId)} />}
                      </span>
                      {([['books', m.books], ['bank', m.bank]] as const).map(([side]) => {
                        const items = side === 'books' ? m.books : m.bank
                        return (
                          <div className="recon-half" key={side}>
                            {many && !expanded ? (
                              <div className="recon-grid">
                                <span className="rc-date">{shortDate(side === 'books' ? m.books[0].date : m.bank[0].line_date)}</span>
                                <span className="rc-desc">
                                  <span>
                                    {m.groupRef ? <strong>{m.groupRef} · </strong> : null}
                                    {items.length} {side === 'books' ? (items.length === 1 ? 'entry' : 'entries') : items.length === 1 ? 'line' : 'lines'}
                                  </span>
                                </span>
                                <span className="rc-num rc-debit">{m.direction === 'out' ? num(m.total) : ''}</span>
                                <span className="rc-num rc-credit">{m.direction === 'in' ? num(m.total) : ''}</span>
                                <span className="rc-num rc-bal" />
                              </div>
                            ) : (
                              items.map((it, i) => (
                                <div className="recon-grid" key={i}>
                                  {side === 'books' ? bookCells(it as BookRow) : bankCells(it as StatementRecord)}
                                </div>
                              ))
                            )}
                          </div>
                        )
                      })}
                      <span className="rc-tail">
                        {many && (
                          <button type="button" className="rc-expand" onClick={() => setOpen((cur) => flip(cur, m.key))} aria-expanded={expanded} aria-label={expanded ? 'Hide the entries' : 'Show the entries'}>
                            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        )}
                        {matched ? (
                          <Button type="button" variant="link" onClick={() => void doUnmatch(m)}>
                            {m.groupRef ? 'Ungroup' : 'Unmatch'}
                          </Button>
                        ) : (
                          <>
                            <Button type="button" onClick={() => void confirm(m, 'auto').then((ok) => ok && toast('success', 'Match saved.'))} disabled={saveMatch.isPending}>
                              Confirm
                            </Button>
                            <Button type="button" variant="link" onClick={() => reject(m)}>
                              Not these
                            </Button>
                          </>
                        )}
                        {m.difference !== 0 && <span className="note" style={{ margin: 0 }} title="Amounts that differ by under a rupee are ignored">differs by {fmt2(Math.abs(m.difference))}</span>}
                        {m.ambiguous && !matched && <StatusTag kind="pending">Check</StatusTag>}
                      </span>
                    </div>
                  )
                })}
              </section>

              <section className="recon-open" aria-label="Not matched">
                <div className="recon-half-panel">
                  <header className="recon-panel-head">
                    <strong>Only in your books</strong>
                    <span className="note" style={{ margin: 0 }}>{booksOnly.length} not on the statement</span>
                  </header>
                  <div className="recon-grid recon-grid-head">
                    <span className="rc-check" />
                    <HeadCells />
                  </div>
                  {booksOnly.length === 0 && <div className="empty-row">Nothing here.</div>}
                  {booksOnly.map((b) => (
                    <div key={b.id} className={selBooks.has(b.id) ? 'recon-row recon-row-selected' : 'recon-row'}>
                      <div className="recon-grid">
                        <span className="rc-check">
                          <input type="checkbox" aria-label={`Select ${labelOfBook(b)} to match`} checked={selBooks.has(b.id)} onChange={() => setSelBooks((c) => flip(c, b.id))} />
                        </span>
                        {bookCells(b)}
                      </div>
                      <div className="recon-row-foot">
                        <ReviewTick itemKey={bookKey(b)} />
                        {clearedMap?.has(b.id) && <span className="note" style={{ margin: 0 }}>ticked earlier</span>}
                        {bookActions(b)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="recon-half-panel">
                  <header className="recon-panel-head">
                    <strong>Only on the statement</strong>
                    <span className="note" style={{ margin: 0 }}>{bankOnly.length} not in your books</span>
                  </header>
                  <div className="recon-grid recon-grid-head">
                    <span className="rc-check" />
                    <HeadCells />
                  </div>
                  {model.bank.length === 0 && (
                    <div className="empty-row">No statement loaded for {accountName} yet. Use “Load statement”.</div>
                  )}
                  {model.bank.length > 0 && bankOnly.length === 0 && <div className="empty-row">Nothing here.</div>}
                  {bankOnly.map((k) => (
                    <div key={k.id} className={selBank.has(k.id) ? 'recon-row recon-row-selected' : 'recon-row'}>
                      <div className="recon-grid">
                        <span className="rc-check">
                          <input type="checkbox" aria-label={`Select ${k.description} to match`} checked={selBank.has(k.id)} onChange={() => setSelBank((c) => flip(c, k.id))} />
                        </span>
                        {bankCells(k)}
                      </div>
                      <div className="recon-row-foot">
                        <ReviewTick itemKey={bankKey(k.id)} />
                        <Button type="button" variant="link" onClick={() => setRecording(asStatementLine(k))}>
                          Record this
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {(chosenBooks.length > 0 || chosenBank.length > 0) && (
                <div className="recon-matchbar" role="region" aria-label="Match by hand">
                  <span>
                    Books: <b>{chosenBooks.length}</b>, {fmt2(sideTotal(chosenBooks.map((b) => (b.deposit > 0 ? b.deposit : b.withdrawal))))} · Statement: <b>{chosenBank.length}</b>, {fmt2(sideTotal(chosenBank.map((k) => (k.credit > 0 ? k.credit : k.debit))))}
                  </span>
                  {problem && <span className="recon-bad">{problem}</span>}
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <Button type="button" onClick={() => void matchSelected()} disabled={!canMatch || saveMatch.isPending}>
                      Match as group
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => { setSelBooks(new Set()); setSelBank(new Set()) }}>
                      Clear
                    </Button>
                  </span>
                </div>
              )}

              <BankSignoff
                key={selected}
                bankId={selected}
                bankName={accountName}
                statementDate={toDate}
                balanceText={statementBalance === null ? '' : String(statementBalance)}
                statementBalance={statementBalance ?? 0}
                summary={signoffSummary}
                ledger={ledger}
                pendingMatches={model.suggestions.length}
              />
              {statementBalance !== null && (
                <div className="note" style={{ fontWeight: 600, color: withinTolerance(signoffSummary.difference) ? 'var(--success-text)' : 'var(--error-text)' }}>
                  {withinTolerance(signoffSummary.difference) ? 'The books and the statement agree on these dates.' : `Difference still to explain: ${fmt2(signoffSummary.difference)}`}
                </div>
              )}
              <ReconLockPanel key={`${selected}-${lock?.locked_until ?? ''}`} bankId={selected} defaultLockDate={toDate} />
            </>
          )}
        </>
      )}

      {panel && (
        <RecordPanel
          sourceTable={panel.table}
          sourceId={panel.id}
          onClose={() => setPanel(null)}
          onEdit={() => {
            const b = panel.book
            setPanel(null)
            setEditing(b)
          }}
        />
      )}
      {editing && <EditEntryModal line={editing} onClose={() => setEditing(null)} onOpenScreen={() => void openScreen(editing)} />}
      {recording && selected && <RecordFromStatement line={recording} bankAccountId={selected} bankName={accountName} onClose={() => setRecording(null)} />}
    </div>
  )
}
