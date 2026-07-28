import { Fragment, useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
import { SortableTh } from '../../components/SortableTh'
import { useSort } from '../../lib/useSort'
import { useLoans, useLoanPayments, useDeleteLoan } from '../../lib/queries/loans'
import { fmt } from '../../lib/calc/format'
import { loanPrincipalPaid, loanInterestPaid, loanOutstanding, monthlyInterestDue } from '../../lib/calc/loans'
import type { DateRange } from '../../lib/calc/period'
import { LoanPaymentForm } from './LoanPaymentForm'

const LOAN_TYPE_LABEL: Record<string, string> = { private: 'Private Party', bank: 'Bank' }

export function LoanTable() {
  const [range, setRange] = useState<DateRange | null>(null)
  const { data: loans, isLoading } = useLoans(range)
  const { data: payments } = useLoanPayments()
  const deleteLoan = useDeleteLoan()
  const [payFormId, setPayFormId] = useState<string | null>(null)

  const paymentsOf = (l: NonNullable<typeof loans>[number]) => payments?.filter((p) => p.loan_id === l.id) ?? []

  const { sorted: sortedLoans, sortKey, direction, toggleSort } = useSort(
    loans,
    {
      id: (l) => l.display_id,
      type: (l) => LOAN_TYPE_LABEL[l.loan_type] ?? l.loan_type,
      lender: (l) => l.lender,
      dateTaken: (l) => l.date_taken,
      interestPaymentDate: (l) => l.interest_payment_date,
      principal: (l) => l.principal,
      roi: (l) => l.roi_pct,
      principalPaid: (l) => loanPrincipalPaid(paymentsOf(l)),
      interestPaid: (l) => loanInterestPaid(paymentsOf(l)),
      outstanding: (l) => loanOutstanding(l, paymentsOf(l)),
      monthlyInterest: (l) => monthlyInterestDue(l, paymentsOf(l)),
    },
    'dateTaken'
  )

  return (
    <details className="toggle-section" open>
      <summary>Loan records</summary>

      <div style={{ marginTop: 16 }}>
        <PeriodFilter onChange={setRange} />
      </div>

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <SortableTh label="ID" sortKey="id" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Type" sortKey="type" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Lender" sortKey="lender" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Date taken" sortKey="dateTaken" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Interest payment date" sortKey="interestPaymentDate" activeKey={sortKey} direction={direction} onSort={toggleSort} />
              <SortableTh label="Principal" sortKey="principal" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="ROI" sortKey="roi" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Principal repaid" sortKey="principalPaid" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Interest paid" sortKey="interestPaid" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Outstanding" sortKey="outstanding" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <SortableTh label="Monthly interest" sortKey="monthlyInterest" activeKey={sortKey} direction={direction} onSort={toggleSort} align="right" />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={12} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedLoans || sortedLoans.length === 0) && (
              <tr>
                <td colSpan={12} className="empty-row">
                  No loans in this period
                </td>
              </tr>
            )}
            {sortedLoans?.map((l) => {
              const loanPayments = payments?.filter((p) => p.loan_id === l.id) ?? []
              const principalPaid = loanPrincipalPaid(loanPayments)
              const interestPaid = loanInterestPaid(loanPayments)
              const outstanding = loanOutstanding(l, loanPayments)
              const monthlyInterest = monthlyInterestDue(l, loanPayments)
              const hasHistory = loanPayments.length > 0

              return (
                <Fragment key={l.id}>
                  <tr>
                    <td>{l.display_id ?? '—'}</td>
                    <td>{LOAN_TYPE_LABEL[l.loan_type] ?? l.loan_type}</td>
                    <td>{l.lender}</td>
                    <td>{l.date_taken ?? '—'}</td>
                    <td>{l.interest_payment_date ?? '—'}</td>
                    <td className="amt">{fmt(l.principal)}</td>
                    <td className="amt">{l.roi_pct || 0}%</td>
                    <td className="amt">{fmt(principalPaid)}</td>
                    <td className="amt">{fmt(interestPaid)}</td>
                    <td className="amt">{fmt(outstanding)}</td>
                    <td className="amt">{outstanding > 0 ? fmt(monthlyInterest) : '—'}</td>
                    <td>
                      {outstanding > 0 && (
                        <button type="button" className="pay-btn" onClick={() => setPayFormId(l.id)}>
                          Record repayment
                        </button>
                      )}
                      <button type="button" className="btn danger-link" onClick={() => deleteLoan.mutate(l.id)}>
                        Remove
                      </button>
                      {hasHistory && (
                        <div className="pay-history">
                          {loanPayments.map((p) => (
                            <div key={p.id}>
                              {p.display_id} — {p.date} — principal {fmt(p.principal_paid)}, interest{' '}
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
    </details>
  )
}
