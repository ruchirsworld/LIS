import { Fragment, useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useLoans, useLoanPayments, useDeleteLoan, useUpdateLoan } from '../../lib/queries/loans'
import { fmt, fmtDate } from '../../lib/calc/format'
import { loanPrincipalPaid, loanInterestPaid, loanOutstanding, monthlyInterestDue, totalInterestDue } from '../../lib/calc/loans'
import type { DateRange } from '../../lib/calc/period'
import { LoanPaymentForm } from './LoanPaymentForm'
import type { Database } from '../../types/database'

type Loan = Database['public']['Tables']['loans']['Row']

const LOAN_TYPE_LABEL: Record<string, string> = { private: 'Private Party', bank: 'Bank' }

export function LoanTable({ onEdit }: { onEdit: (loan: Loan) => void }) {
  const [range, setRange] = useState<DateRange | null>(null)
  const { data: loans, isLoading } = useLoans(range)
  const { data: payments } = useLoanPayments()
  const deleteLoan = useDeleteLoan()
  const updateLoan = useUpdateLoan()
  const [payFormId, setPayFormId] = useState<string | null>(null)

  const paymentsOf = (l: NonNullable<typeof loans>[number]) => payments?.filter((p) => p.loan_id === l.id) ?? []

  const { sorted: sortedLoans, sortKey, direction, toggleSort } = useSort(
    loans,
    {
      id: (l) => l.display_id,
      type: (l) => LOAN_TYPE_LABEL[l.loan_type] ?? l.loan_type,
      lender: (l) => l.lender,
      dateTaken: (l) => l.date_taken,
      principal: (l) => l.principal,
      roi: (l) => l.roi_pct,
      principalPaid: (l) => loanPrincipalPaid(paymentsOf(l)),
      interestPaid: (l) => loanInterestPaid(paymentsOf(l)),
      outstanding: (l) => loanOutstanding(l, paymentsOf(l)),
      monthlyInterest: (l) => monthlyInterestDue(l, paymentsOf(l)),
      interestDueMonths: (l) => l.interest_due_months,
      interestDue: (l) => totalInterestDue(l, paymentsOf(l)),
    },
    'dateTaken'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedLoans)

  const exportSections: ExportSection[] = [
    {
      title: 'Loan records',
      columns: ['ID', 'Type', 'Lender', 'Date taken', 'Principal', 'ROI', 'Principal repaid', 'Interest paid', 'Outstanding', 'Monthly interest', 'Interest due (months)', 'Interest due (₹)'],
      rows: (sortedLoans ?? []).map((l) => {
        const loanPayments = paymentsOf(l)
        return [
          l.display_id ?? '',
          LOAN_TYPE_LABEL[l.loan_type] ?? l.loan_type,
          l.lender,
          l.date_taken ? fmtDate(l.date_taken) : '',
          l.principal,
          l.roi_pct ?? 0,
          loanPrincipalPaid(loanPayments),
          loanInterestPaid(loanPayments),
          loanOutstanding(l, loanPayments),
          monthlyInterestDue(l, loanPayments),
          l.interest_due_months,
          totalInterestDue(l, loanPayments),
        ]
      }),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Loan records</summary>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        <PeriodFilter onChange={setRange} allowCustom style={{ marginBottom: 0 }} />
        <ReportExportButtons title="Loan records" sections={exportSections} range={range} style={{ marginTop: 0 }} />
      </div>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Type" sortKey="type" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Lender" sortKey="lender" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date taken" sortKey="dateTaken" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Principal" sortKey="principal" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="ROI" sortKey="roi" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Principal repaid" sortKey="principalPaid" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Interest paid" sortKey="interestPaid" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Outstanding" sortKey="outstanding" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Monthly interest" sortKey="monthlyInterest" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Interest due (months)" sortKey="interestDueMonths" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Interest due (₹)" sortKey="interestDue" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={13} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedLoans || sortedLoans.length === 0) && (
              <tr>
                <td colSpan={13} className="empty-row">
                  No loans in this period
                </td>
              </tr>
            )}
            {pageRows?.map((l) => {
              const loanPayments = payments?.filter((p) => p.loan_id === l.id) ?? []
              const principalPaid = loanPrincipalPaid(loanPayments)
              const interestPaid = loanInterestPaid(loanPayments)
              const outstanding = loanOutstanding(l, loanPayments)
              const monthlyInterest = monthlyInterestDue(l, loanPayments)
              const interestDue = totalInterestDue(l, loanPayments)
              const hasHistory = loanPayments.length > 0

              return (
                <Fragment key={l.id}>
                  <tr>
                    <td>{l.display_id ?? '—'}</td>
                    <td>{LOAN_TYPE_LABEL[l.loan_type] ?? l.loan_type}</td>
                    <td>{l.lender}</td>
                    <td>{l.date_taken ? fmtDate(l.date_taken) : '—'}</td>
                    <td className="amt">{fmt(l.principal)}</td>
                    <td className="amt">{l.roi_pct || 0}%</td>
                    <td className="amt">{fmt(principalPaid)}</td>
                    <td className="amt">{fmt(interestPaid)}</td>
                    <td className="amt">{fmt(outstanding)}</td>
                    <td className="amt">{outstanding > 0 ? fmt(monthlyInterest) : '—'}</td>
                    <td className="amt">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={l.interest_due_months}
                        style={{ width: 56, textAlign: 'right' }}
                        onBlur={(e) => {
                          const next = Number(e.target.value) || 0
                          if (next !== l.interest_due_months) {
                            updateLoan.mutate({ id: l.id, patch: { interest_due_months: next } })
                          }
                        }}
                      />
                    </td>
                    <td className="amt">{outstanding > 0 ? fmt(interestDue) : '—'}</td>
                    <td>
                      {outstanding > 0 && (
                        <button type="button" className="pay-btn" onClick={() => setPayFormId(l.id)}>
                          Record repayment
                        </button>
                      )}
                      <button type="button" className="pay-btn" onClick={() => onEdit(l)}>
                        Edit
                      </button>
                      <button type="button" className="btn danger-link" onClick={() => deleteLoan.mutate(l.id)}>
                        Remove
                      </button>
                      {hasHistory && (
                        <div className="pay-history">
                          {loanPayments.map((p) => (
                            <div key={p.id}>
                              {p.display_id} — {fmtDate(p.date)} — principal {fmt(p.principal_paid)}, interest{' '}
                              {fmt(p.interest_paid)}
                              {p.reference ? ` · ${p.reference}` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                  {payFormId === l.id && (
                    <LoanPaymentForm loanId={l.id} loan={l} payments={loanPayments} onClose={() => setPayFormId(null)} />
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />
    </details>
  )
}
