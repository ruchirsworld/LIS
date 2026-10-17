import { Fragment, useState } from 'react'
import { PeriodFilterToggle } from '../../components/PeriodFilterToggle'
import { SortableTh } from '../../components/SortableTh'
import { Pagination } from '../../components/Pagination'
import { TableScroll } from '../../components/TableScroll'
import { useSort } from '../../lib/useSort'
import { usePagination } from '../../lib/usePagination'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { RecordRow, useOpenRows } from '../../components/RecordRow'
import { Modal } from '../../components/Modal'
import { RecordDetails } from '../reports/RecordDetailModal'
import { LoanForm } from './LoanForm'
import { confirmAction } from '../../lib/feedback'
import { ReportExportButtons } from '../reports/ReportExportButtons'
import type { ExportSection } from '../../lib/export/report'
import { useLoans, useLoanPayments, useDeleteLoan } from '../../lib/queries/loans'
import { LoanPaymentForm } from './LoanPaymentForm'
import { fmt, fmtDate } from '../../lib/calc/format'
import {
  loanPrincipalPaid,
  loanInterestPaid,
  loanOutstanding,
  monthlyInterestDue,
  monthsInterestDue,
  totalInterestDue,
} from '../../lib/calc/loans'
import type { DateRange } from '../../lib/calc/period'
import type { Database } from '../../types/database'

type Loan = Database['public']['Tables']['loans']['Row']

const LOAN_TYPE_LABEL: Record<string, string> = { private: 'Private Party', bank: 'Bank' }

export function LoanTable() {
  const [range, setRange] = useState<DateRange | null>(null)
  const [search, setSearch] = useState('')
  const { data: loans, isLoading } = useLoans(range)
  const { data: payments } = useLoanPayments()
  const deleteLoan = useDeleteLoan()
  const [payFormId, setPayFormId] = useState<string | null>(null)
  const openRows = useOpenRows()
  const [editing, setEditing] = useState<Loan | null>(null)

  async function removeLoan(l: Loan) {
    const ok = await confirmAction({
      title: 'Delete loan',
      message: `Delete loan ${l.display_id ?? ''} from ${l.lender}? Its repayments go with it. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) deleteLoan.mutate(l.id)
  }

  const paymentsOf = (l: NonNullable<typeof loans>[number]) => payments?.filter((p) => p.loan_id === l.id) ?? []

  const searchedLoans = search
    ? loans?.filter((l) => matchesSearch(search, [l.display_id, l.lender, l.notes, LOAN_TYPE_LABEL[l.loan_type] ?? l.loan_type, l.date_taken, l.principal, l.roi_pct, l.payment_mode]))
    : loans

  const { sorted: sortedLoans, sortKey, direction, toggleSort } = useSort(
    searchedLoans,
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
      interestDueMonths: (l) => monthsInterestDue(l, paymentsOf(l)),
      interestDue: (l) => totalInterestDue(l, paymentsOf(l)),
    },
    'dateTaken'
  )
  const { pageRows, page, setPage, totalPages, totalCount } = usePagination(sortedLoans, search)

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
          monthsInterestDue(l, loanPayments),
          totalInterestDue(l, loanPayments),
        ]
      }),
    },
  ]

  return (
    <details className="toggle-section" open>
      <summary>Loan records</summary>

      <div className="toolbar">
        <div className="toolbar-group toolbar-fill">
          <PeriodFilterToggle range={range} onChange={setRange} />
          <TableSearch value={search} onChange={setSearch} inline />
        </div>
        <ReportExportButtons title="Loan records" sections={exportSections} range={range} iconOnly style={{ marginTop: 0 }} />
      </div>

      <TableScroll>
        <table className="data">
          <thead>
            <tr>
              <th></th>
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
                <td colSpan={14} className="empty-row">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (!sortedLoans || sortedLoans.length === 0) && (
              <tr>
                <td colSpan={14} className="empty-row">
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
              const interestDueMonths = monthsInterestDue(l, loanPayments)
              const interestDue = totalInterestDue(l, loanPayments)
              const hasHistory = loanPayments.length > 0

              return (
                <Fragment key={l.id}>
                  <RecordRow
                    expanded={openRows.isOpen(l.id)}
                    onToggle={() => openRows.toggle(l.id)}
                    colSpan={14}
                    details={
                      <>
                        <RecordDetails sourceTable="loans" sourceId={l.id} />
                        {hasHistory && (
                          <div className="pay-history" style={{ marginTop: 10 }}>
                            <strong>Repayments</strong>
                            {loanPayments.map((p) => (
                              <div key={p.id}>
                                {p.display_id} — {fmtDate(p.date)} — principal {fmt(p.principal_paid)}, interest {fmt(p.interest_paid)}
                                {p.reference ? ` · ${p.reference}` : ''}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    }
                    extraItems={outstanding > 0 ? [{ label: 'Record payment', onClick: () => setPayFormId(l.id) }] : []}
                    onEdit={() => setEditing(l)}
                    onDelete={() => void removeLoan(l)}
                  >
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
                    <td className="amt">{outstanding > 0 ? interestDueMonths : '—'}</td>
                    <td className="amt">{outstanding > 0 ? fmt(interestDue) : '—'}</td>
                  </RecordRow>
                  {payFormId === l.id && (
                    <LoanPaymentForm loanId={l.id} colSpan={14} onClose={() => setPayFormId(null)} />
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </TableScroll>
      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} onChange={setPage} />

      {editing && (
        <Modal title={`Edit loan ${editing.display_id ?? ''}`} onClose={() => setEditing(null)}>
          <LoanForm editingLoan={editing} onDoneEditing={() => setEditing(null)} inModal />
        </Modal>
      )}
    </details>
  )
}
