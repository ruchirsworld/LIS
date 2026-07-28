import { Fragment, useState } from 'react'
import { PeriodFilter } from '../../components/PeriodFilter'
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
              <th>ID</th>
              <th>Type</th>
              <th>Lender</th>
              <th>Date taken</th>
              <th>Interest payment date</th>
              <th style={{ textAlign: 'right' }}>Principal</th>
              <th style={{ textAlign: 'right' }}>ROI</th>
              <th style={{ textAlign: 'right' }}>Principal repaid</th>
              <th style={{ textAlign: 'right' }}>Interest paid</th>
              <th style={{ textAlign: 'right' }}>Outstanding</th>
              <th style={{ textAlign: 'right' }}>Monthly interest</th>
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
            {!isLoading && (!loans || loans.length === 0) && (
              <tr>
                <td colSpan={12} className="empty-row">
                  No loans in this period
                </td>
              </tr>
            )}
            {loans?.map((l) => {
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
