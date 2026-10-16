import { confirmAction } from '../../lib/feedback'
import { useState } from 'react'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { SearchableSelect } from '../../components/SearchableSelect'
import { useAuth } from '../../lib/auth'
import { useBankAccounts, useClients } from '../../lib/queries/masters'
import {
  useDeleteJournalVoucher,
  useGlAccounts,
  useJournalVouchers,
  usePostJournalVoucher,
} from '../../lib/queries/books'
import { fmt2, fmtDate, parseINR } from '../../lib/calc/format'
import { clientLabel } from '../../lib/labels'
import { getErrorMessage } from '../../lib/errors'

interface Line {
  account: string
  debit: string
  credit: string
  clientId: string
  /** Which bank a Bank (1020) line is for. Without it the entry could not be counted in Kotak or CBI. */
  bankId: string
}

const BLANK: Line = { account: '', debit: '0', credit: '0', clientId: '', bankId: '' }
// Accounts that hang off a client in the party ledger.
const CLIENT_ACCOUNTS = new Set(['1030', '1035', '2060'])

const TEMPLATES: { label: string; narration: string; lines: Line[] }[] = [
  {
    label: 'Pay GST / set off input credit',
    narration: 'GST for the month - input credit set off and balance paid',
    lines: [
      { ...BLANK, account: '2031' },
      { ...BLANK, account: '2032' },
      { ...BLANK, account: '2033' },
      { ...BLANK, account: '1051' },
      { ...BLANK, account: '1052' },
      { ...BLANK, account: '1053' },
      { ...BLANK, account: '1020' },
    ],
  },
  {
    label: 'Pay TDS deducted to the government',
    narration: 'TDS deducted from vendors, paid by challan',
    lines: [
      { ...BLANK, account: '2070' },
      { ...BLANK, account: '1020' },
    ],
  },
  {
    label: 'Write off a bad debt',
    narration: 'Written off as irrecoverable',
    lines: [
      { ...BLANK, account: '5110' },
      { ...BLANK, account: '1030' },
    ],
  },
]

/** Manual journal vouchers: the adjustments the invoice, receipt and expense
 * screens can't make — paying GST or setting off input credit, writing off a
 * bad debt, correcting a posting. Every voucher must balance, needs a
 * narration, and cannot be edited; to correct one, post a reversing voucher
 * (an Admin can delete a mistaken one). Not scoped to the period filter. */
export function JournalVouchersReport() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { data: accounts } = useGlAccounts()
  const { data: clients } = useClients()
  const { data: banks } = useBankAccounts()
  const { data: vouchers } = useJournalVouchers()
  const post = usePostJournalVoucher()
  const remove = useDeleteJournalVoucher()

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [narration, setNarration] = useState('')
  const [lines, setLines] = useState<Line[]>([{ ...BLANK }, { ...BLANK }])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const totalDebit = lines.reduce((s, l) => s + parseINR(l.debit), 0)
  const totalCredit = lines.reduce((s, l) => s + parseINR(l.credit), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0

  function setLine(i: number, patch: Partial<Line>) {
    setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  async function submit() {
    setError(null)
    const used = lines.filter((l) => l.account && (parseINR(l.debit) > 0 || parseINR(l.credit) > 0))
    if (used.length < 2) {
      setError('Add at least two lines with an account and an amount.')
      return
    }
    if (!balanced) {
      setError('Debits and credits must be equal.')
      return
    }
    if (used.some((l) => l.account === '1020' && !l.bankId)) {
      setError('Choose which bank account the Bank line is for (Kotak or CBI). Without it the entry is not counted in that bank.')
      return
    }
    if (!narration.trim()) {
      setError('Write a narration — say what this voucher is for.')
      return
    }
    setSaving(true)
    try {
      await post.mutateAsync({
        date,
        narration: narration.trim(),
        lines: used.map((l) => ({
          account_code: l.account,
          debit: parseINR(l.debit),
          credit: parseINR(l.credit),
          client_id: l.clientId || null,
          bank_account_id: l.account === '1020' ? l.bankId || null : null,
        })),
      })
      setNarration('')
      setLines([{ ...BLANK }, { ...BLANK }])
    } catch (err) {
      setError(getErrorMessage(err, 'Could not post the voucher.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="report-panel">
      <div className="note" style={{ marginTop: 0 }}>
        For adjustments the invoice, receipt and expense screens can't make. A voucher can't be edited — post a reversing voucher to correct
        one{isAdmin ? ', or delete a mistaken one' : ''}. Anything dated within a locked period is refused.
      </div>

      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              className="pay-btn"
              onClick={() => {
                setNarration(t.narration)
                setLines(t.lines.map((l) => ({ ...l })))
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field full">
            <label>Narration</label>
            <input type="text" value={narration} onChange={(e) => setNarration(e.target.value)} />
          </div>
        </div>

        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Account</th>
                <th>Client or bank (if any)</th>
                <th style={{ textAlign: 'right' }}>Debit</th>
                <th style={{ textAlign: 'right' }}>Credit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td style={{ minWidth: 220 }}>
                    <SearchableSelect
                      items={accounts}
                      value={accounts?.find((a) => a.code === l.account)?.id ?? ''}
                      onChange={(id) => setLine(i, { account: accounts?.find((a) => a.id === id)?.code ?? '', clientId: '', bankId: '' })}
                      getId={(a) => a.id}
                      getLabel={(a) => `${a.code} — ${a.name}`}
                      placeholder="— Select account —"
                    />
                  </td>
                  <td style={{ minWidth: 180 }}>
                    {CLIENT_ACCOUNTS.has(l.account) ? (
                      <SearchableSelect
                        items={clients}
                        value={l.clientId}
                        onChange={(id) => setLine(i, { clientId: id })}
                        getId={(c) => c.id}
                        getLabel={(c) => clientLabel(c)}
                        placeholder="— Client —"
                      />
                    ) : l.account === '1020' ? (
                      <select aria-label="Bank account" value={l.bankId} onChange={(e) => setLine(i, { bankId: e.target.value })}>
                        <option value="">— Which bank? —</option>
                        {(banks ?? []).map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <CurrencyInput value={l.debit} onValueChange={(v) => setLine(i, { debit: v, credit: parseINR(v) > 0 ? '0' : l.credit })} />
                  </td>
                  <td>
                    <CurrencyInput value={l.credit} onValueChange={(v) => setLine(i, { credit: v, debit: parseINR(v) > 0 ? '0' : l.debit })} />
                  </td>
                  <td>
                    {lines.length > 2 && (
                      <button type="button" className="btn danger-link" onClick={() => setLines((cur) => cur.filter((_, idx) => idx !== i))}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 600 }}>
                <td colSpan={2}>Total</td>
                <td className="amt">{fmt2(totalDebit)}</td>
                <td className="amt" style={{ color: balanced || totalDebit + totalCredit === 0 ? undefined : 'var(--red)' }}>
                  {fmt2(totalCredit)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" onClick={() => setLines((cur) => [...cur, { ...BLANK }])}>
            Add a line
          </Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? 'Posting…' : 'Post voucher'}
          </Button>
          {!balanced && totalDebit + totalCredit > 0 && (
            <span className="note" style={{ color: 'var(--red)' }}>
              Out of balance by {fmt2(Math.abs(totalDebit - totalCredit))}
            </span>
          )}
        </div>
        {error && (
          <div className="note" style={{ color: 'var(--red)' }}>
            {error}
          </div>
        )}
      </div>

      <h3 style={{ fontSize: 13, marginTop: 20 }}>Posted vouchers</h3>
      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>No.</th>
              <th>Date</th>
              <th>Narration</th>
              <th>Entries</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(vouchers ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="empty-row">
                  No journal vouchers yet
                </td>
              </tr>
            )}
            {(vouchers ?? []).map((v) => (
              <tr key={v.id}>
                <td>{v.display_id ?? '—'}</td>
                <td>{fmtDate(v.date)}</td>
                <td>{v.description}</td>
                <td>
                  {v.lines.map((l) => (
                    <div key={l.id} style={{ fontSize: 12 }}>
                      {l.debit > 0 ? 'Dr' : 'Cr'} {l.account_code} {l.account_name} — {fmt2(l.debit > 0 ? l.debit : l.credit)}
                    </div>
                  ))}
                </td>
                <td className="amt">{fmt2(v.lines.reduce((s, l) => s + l.debit, 0))}</td>
                <td>
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn danger-link"
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: 'Delete voucher',
                          message: `Delete voucher ${v.display_id}? It is removed from the ledger and kept in the audit log.`,
                          confirmLabel: 'Delete',
                          danger: true,
                        })
                        if (ok) remove.mutate(v.id)
                      }}
                    >
                      Delete
                    </button>
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
