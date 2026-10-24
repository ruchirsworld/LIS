import { confirmAction } from '../../lib/feedback'
import { Fragment, useRef, useState, type FormEvent } from 'react'
import html2canvas from 'html2canvas'
import laavinLogo from '../../assets/laavin-logo.jpg'
import { Button } from '../../components/ui'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useStaff, useBankAccounts } from '../../lib/queries/masters'
import { useProfiles } from '../../lib/queries/admin'
import { useAllStaffAttendance, useAllStaffProjectAssignments } from '../../lib/queries/teamTracking'
import {
  useHolidays,
  useWageAccruals,
  useCreateWageAccrual,
  useUpdateWageAccrual,
  useWagePayments,
  useCreateWagePayment,
  useStaffSalaryAdvances,
  useCreateStaffSalaryAdvance,
  useUpdateStaffSalaryAdvance,
  useDeleteStaffSalaryAdvance,
} from '../../lib/queries/hr'
import { PaymentAccountPicker, bankAccountIdOf, CASH_ACCOUNT } from '../../components/PaymentAccountPicker'
import { computeAccrualBreakdown, computeAccrualDays, nextAccrualStart, todayStr, type AccrualDay, type AttendanceDayType } from '../../lib/calc/payroll'
// Every date on the salary screens and slips reads DD/MM/YYYY.
import { fmt, fmtDateNum as fmtDate, parseINR } from '../../lib/calc/format'
import { monthSlip } from '../../lib/calc/salarySlip'
import { getErrorMessage } from '../../lib/errors'
import { TableSearch, matchesSearch } from '../../components/TableSearch'
import { RecordRow, useOpenRows } from '../../components/RecordRow'
import { Modal } from '../../components/Modal'
import { RecordDetails } from '../reports/RecordDetailModal'

// The pay-slip is meant for the worker to keep, not just the Admin running
// payroll — every label on it shows English and Hindi together rather than
// switching with the viewer's own language (unlike the app's usual i18n,
// which only ever applies to a Supervisor's own UI).
function Bi({ en, hi }: { en: string; hi: string }) {
  return (
    <>
      {en} <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>/ {hi}</span>
    </>
  )
}

// "05/09/2026" from "2026-09-05".
function dayMonth(date: string): string {
  return fmtDate(date)
}

/** The dates behind the day counts of a salary period: which days were Absent (unpaid), Leave (paid), Half days and Holidays. Days worked normally
 * are not listed, they are simply every other day of the period. */
function DayDates({ days, compact, bilingual }: { days: AccrualDay[]; compact?: boolean; bilingual?: boolean }) {
  const groups: { type: AccrualDay['type']; en: string; hi: string; note: string }[] = [
    { type: 'unpaid_off', en: 'Absent — unpaid', hi: 'अनुपस्थित — अवैतनिक', note: 'no pay for these days' },
    { type: 'paid_off', en: 'Leave — paid', hi: 'अवकाश — सशुल्क', note: 'the free days each month, paid in full' },
    { type: 'half_day', en: 'Half days', hi: 'आधे दिन', note: 'half pay' },
    { type: 'holiday', en: 'Holidays', hi: 'छुट्टियाँ', note: 'paid in full' },
  ]
  const rows = groups
    .map((g) => ({ ...g, dates: days.filter((d) => d.type === g.type).map((d) => dayMonth(d.date)) }))
    .filter((g) => g.dates.length > 0)
  if (days.length === 0) return null
  if (rows.length === 0) return compact ? null : <div className="note" style={{ margin: 0 }}>Every day in this period was worked: no absence, half day or holiday.</div>
  if (compact) {
    return (
      <>
        {rows.map((g) => (
          <div key={g.type} className="retention-note">
            {g.en} ({g.dates.length}): {g.dates.join(', ')}
          </div>
        ))}
      </>
    )
  }
  return (
    <table className="data table-compact keep-table">
      <thead>
        <tr>
          <th colSpan={2}>{bilingual ? <Bi en="Dates" hi="तारीखें" /> : 'Dates'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((g) => (
          <tr key={g.type}>
            <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>
              {bilingual ? <Bi en={g.en} hi={g.hi} /> : g.en} ({g.dates.length})
            </td>
            <td>
              {g.dates.join(', ')}
              <div className="retention-note">{g.note}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

// The accrual period always runs through the end of the selected month —
// capped at today, since a future or still-in-progress month can't be paid
// out past whatever's actually happened so far.
function monthEndCapped(ym: string, todayIso: string): string {
  const lastDay = lastDayOfMonth(ym)
  return lastDay < todayIso ? lastDay : todayIso
}

function dayBefore(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function SalarySection() {
  const { data: staff } = useStaff()
  const { data: profiles } = useProfiles()
  const { data: allLeave } = useAllStaffAttendance()
  const { data: holidays } = useHolidays()
  const { data: allAssignments } = useAllStaffProjectAssignments()
  const openRows = useOpenRows()
  const [accrualSearch, setAccrualSearch] = useState('')
  const [paymentSearch, setPaymentSearch] = useState('')
  const [advanceSearch, setAdvanceSearch] = useState('')
  const { data: accruals } = useWageAccruals()
  const { data: payments } = useWagePayments()
  const { data: bankAccounts } = useBankAccounts()
  const { data: salaryAdvances } = useStaffSalaryAdvances()
  const createAccrual = useCreateWageAccrual()
  const updateAccrual = useUpdateWageAccrual()
  const createPayment = useCreateWagePayment()
  const createSalaryAdvance = useCreateStaffSalaryAdvance()
  const updateSalaryAdvance = useUpdateStaffSalaryAdvance()
  const deleteSalaryAdvance = useDeleteStaffSalaryAdvance()

  const [payFormStaffId, setPayFormStaffId] = useState<string | null>(null)
  const [payDate, setPayDate] = useState(todayStr())
  const [payAmount, setPayAmount] = useState('0')
  const [payBankAccountId, setPayBankAccountId] = useState('')
  const [payAdvanceRecovered, setPayAdvanceRecovered] = useState('0')
  const [payNotes, setPayNotes] = useState('')
  const [payError, setPayError] = useState<string | null>(null)
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [confirmingRow, setConfirmingRow] = useState<(typeof rows)[number] | null>(null)
  const [bonusAmount, setBonusAmount] = useState('0')
  const [incentiveAmount, setIncentiveAmount] = useState('0')
  // Allowance is a per-day rate, not a lump sum — the actual amount is rate
  // × days actually worked (present days), e.g. 21 days × ₹50/day.
  const [allowanceRate, setAllowanceRate] = useState('0')

  const [advanceFormStaffId, setAdvanceFormStaffId] = useState<string | null>(null)
  const [advanceDate, setAdvanceDate] = useState(todayStr())
  const [advanceAmount, setAdvanceAmount] = useState('0')
  const [advanceBankAccountId, setAdvanceBankAccountId] = useState('')
  const [advanceRemarks, setAdvanceRemarks] = useState('')
  const [advanceError, setAdvanceError] = useState<string | null>(null)
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false)
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null)
  const [advanceEditDraft, setAdvanceEditDraft] = useState({ date: '', amount: '', bankAccountId: '', remarks: '' })
  const [advanceEditError, setAdvanceEditError] = useState<Record<string, string>>({})
  const [advanceEditBusyId, setAdvanceEditBusyId] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(todayStr().slice(0, 7))
  const [viewingAccrual, setViewingAccrual] = useState<NonNullable<typeof accruals>[number] | null>(null)
  const [editingAccrual, setEditingAccrual] = useState(false)
  const [editAccrualAmount, setEditAccrualAmount] = useState('0')
  const [editAccrualNotes, setEditAccrualNotes] = useState('')
  const [editAccrualError, setEditAccrualError] = useState<string | null>(null)
  const [editAccrualSubmitting, setEditAccrualSubmitting] = useState(false)
  const [downloadingImage, setDownloadingImage] = useState(false)
  // The staff member whose "Payable" breakup (runs accrued, payments made) is open.
  const [breakupStaffId, setBreakupStaffId] = useState<string | null>(null)
  const payslipRef = useRef<HTMLDivElement>(null)
  const slipRef = useRef<HTMLDivElement>(null)

  async function handleDownloadImage() {
    if (!payslipRef.current || !viewingStaff) return
    setDownloadingImage(true)
    try {
      const canvas = await html2canvas(payslipRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        ignoreElements: (el) => el.classList.contains('payslip-no-print') || el.classList.contains('modal-close'),
      })
      const link = document.createElement('a')
      link.download = `Payslip-${viewingStaff.name.replace(/\s+/g, '-')}-${viewingAccrual?.period_end ?? ''}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setDownloadingImage(false)
    }
  }

  async function handleDownloadSlip() {
    if (!slipRef.current || !breakupRow) return
    setDownloadingImage(true)
    try {
      const canvas = await html2canvas(slipRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        ignoreElements: (el) => el.classList.contains('payslip-no-print') || el.classList.contains('modal-close'),
      })
      const link = document.createElement('a')
      link.download = `Salary-slip-${breakupRow.staff.name.replace(/\s+/g, '-')}-${selectedMonth}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setDownloadingImage(false)
    }
  }

  function openViewAccrual(a: NonNullable<typeof accruals>[number]) {
    setViewingAccrual(a)
    setEditingAccrual(false)
    setEditAccrualAmount(String(a.amount))
    setEditAccrualNotes(a.notes ?? '')
    setEditAccrualError(null)
  }

  async function handleSaveAccrualEdit() {
    if (!viewingAccrual) return
    const amt = parseINR(editAccrualAmount)
    if (amt <= 0) {
      setEditAccrualError('Enter an amount.')
      return
    }
    setEditAccrualSubmitting(true)
    setEditAccrualError(null)
    try {
      const updated = await updateAccrual.mutateAsync({
        id: viewingAccrual.id,
        patch: { amount: amt, notes: editAccrualNotes.trim() || null },
      })
      setViewingAccrual(updated)
      setEditingAccrual(false)
    } catch (err) {
      setEditAccrualError(getErrorMessage(err, 'Could not save changes.'))
    } finally {
      setEditAccrualSubmitting(false)
    }
  }

  const today = todayStr()
  const periodEnd = monthEndCapped(selectedMonth, today)
  const holidayDates = new Set((holidays ?? []).map((h) => h.date))
  const monthStart = `${selectedMonth}-01`
  const currentRealMonthStart = `${today.slice(0, 7)}-01`

  const rows = (staff ?? []).map((s) => {
    const staffAttendanceDays = (allLeave ?? [])
      .filter((a) => a.staff_id === s.id)
      .map((a) => ({ date: a.date, day_type: a.day_type as AttendanceDayType }))
    const staffAccruals = (accruals ?? []).filter((a) => a.staff_id === s.id)
    const staffPayments = (payments ?? []).filter((p) => p.staff_id === s.id)
    const totalAccrued = staffAccruals.reduce((sum, a) => sum + Number(a.amount || 0), 0)
    const totalPaid = staffPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const payable = Math.round((totalAccrued - totalPaid) * 100) / 100
    const nextStart = nextAccrualStart(s, staffAccruals.map((a) => a.period_end))
    // Salaries accrue one calendar month at a time — never reach back
    // further than the selected month's own start, even if the last run
    // was further back than that. Whatever falls before this month (if
    // anything) shows up as `priorGap` below instead, so it's processed as
    // its own month rather than silently folded into this one.
    const effectiveStart = nextStart > monthStart ? nextStart : monthStart
    // Compensatory leave: any Holiday the staff member actually logged
    // site-work on earns them an extra free day that month.
    const workedHolidayDates = (allAssignments ?? [])
      .filter((a) => a.staff_id === s.id && holidayDates.has(a.date))
      .map((a) => a.date)
    const breakdown = computeAccrualBreakdown(s, staffAttendanceDays, holidayDates, effectiveStart, periodEnd, workedHolidayDates)
    const pendingAccrual = breakdown.amount

    // A past month that's never been run at all — surfaced so it doesn't
    // silently vanish into this month's number, and blocked from being run
    // out of order (running a later month first would corrupt the "next
    // start" tracking, which is based on the latest period_end so far).
    let priorGap: { from: string; to: string; amount: number } | null = null
    if (nextStart < monthStart) {
      const gapEnd = dayBefore(monthStart)
      const gapBreakdown = computeAccrualBreakdown(s, staffAttendanceDays, holidayDates, nextStart, gapEnd, workedHolidayDates)
      if (gapBreakdown.totalDays > 0) priorGap = { from: nextStart, to: gapEnd, amount: gapBreakdown.amount }
    }

    // Salary already accrued (a real payroll run happened) for a month
    // that's now fully in the past, and still not fully paid out.
    const hasPastMonthUnpaid = payable > 0 && staffAccruals.some((a) => a.period_end < currentRealMonthStart)

    const totalAdvanced = (salaryAdvances ?? []).filter((a) => a.staff_id === s.id).reduce((sum, a) => sum + Number(a.amount || 0), 0)
    const totalRecovered = staffPayments.reduce((sum, p) => sum + Number(p.advance_recovered || 0), 0)
    const advanceOutstanding = Math.round((totalAdvanced - totalRecovered) * 100) / 100

    return {
      staff: s,
      payable,
      pendingAccrual,
      nextStart,
      effectiveStart,
      advanceOutstanding,
      breakdown,
      priorGap,
      hasPastMonthUnpaid,
    }
  })

  async function handleRunPayroll(row: (typeof rows)[number]) {
    setRunError(null)
    setRunningId(row.staff.id)
    try {
      const bonus = parseINR(bonusAmount)
      const incentive = parseINR(incentiveAmount)
      const allowanceRateNum = parseINR(allowanceRate)
      const allowance = allowanceRateNum * row.breakdown.presentDays
      const extras: string[] = []
      if (bonus > 0) extras.push(`Bonus ${fmt(bonus)}`)
      if (incentive > 0) extras.push(`Incentive ${fmt(incentive)}`)
      if (allowance > 0) extras.push(`Allowance ${fmt(allowance)} (${row.breakdown.presentDays} × ${fmt(allowanceRateNum)})`)
      const created = await createAccrual.mutateAsync({
        staff_id: row.staff.id,
        period_start: row.effectiveStart,
        period_end: periodEnd,
        amount: row.pendingAccrual + bonus + incentive + allowance,
        notes: extras.length ? `Base ${fmt(row.pendingAccrual)} + ${extras.join(' + ')}` : null,
      })
      setConfirmingRow(null)
      // Show the same breakdown right away instead of making the user go
      // find this run in the history table below and click on it.
      openViewAccrual(created)
    } catch (err) {
      setRunError(getErrorMessage(err, 'Could not run payroll.'))
    } finally {
      setRunningId(null)
    }
  }

  function openPayForm(staffId: string, suggestedAmount: number) {
    setPayFormStaffId(payFormStaffId === staffId ? null : staffId)
    setPayDate(todayStr())
    setPayAmount(suggestedAmount > 0 ? String(suggestedAmount) : '0')
    setPayBankAccountId('')
    setPayAdvanceRecovered('0')
    setPayNotes('')
    setPayError(null)
  }

  async function handlePaySubmit(e: FormEvent) {
    e.preventDefault()
    if (!payFormStaffId) return
    const amt = parseINR(payAmount)
    const recovered = parseINR(payAdvanceRecovered)
    if (amt <= 0) {
      setPayError('Enter an amount.')
      return
    }
    if (recovered > amt) {
      setPayError('Recovered amount can’t exceed the payment amount.')
      return
    }
    const outstanding = rows.find((r) => r.staff.id === payFormStaffId)?.advanceOutstanding ?? 0
    if (recovered > outstanding) {
      setPayError(`Only ${fmt(outstanding)} of salary advance is outstanding for this staff member.`)
      return
    }
    setPaySubmitting(true)
    setPayError(null)
    try {
      await createPayment.mutateAsync({
        staff_id: payFormStaffId,
        date: payDate,
        amount: amt,
        bank_account_id: bankAccountIdOf(payBankAccountId),
        advance_recovered: recovered,
        notes: payNotes.trim() || null,
      })
      setPayFormStaffId(null)
    } catch (err) {
      setPayError(getErrorMessage(err, 'Could not record payment.'))
    } finally {
      setPaySubmitting(false)
    }
  }

  function openAdvanceForm(staffId: string) {
    setAdvanceFormStaffId(advanceFormStaffId === staffId ? null : staffId)
    setAdvanceDate(todayStr())
    setAdvanceAmount('0')
    setAdvanceBankAccountId('')
    setAdvanceRemarks('')
    setAdvanceError(null)
  }

  async function handleAdvanceSubmit(e: FormEvent) {
    e.preventDefault()
    if (!advanceFormStaffId) return
    const amt = parseINR(advanceAmount)
    if (amt <= 0) {
      setAdvanceError('Enter an amount.')
      return
    }
    setAdvanceSubmitting(true)
    setAdvanceError(null)
    try {
      await createSalaryAdvance.mutateAsync({
        staff_id: advanceFormStaffId,
        date: advanceDate,
        amount: amt,
        bank_account_id: bankAccountIdOf(advanceBankAccountId),
        remarks: advanceRemarks.trim() || null,
      })
      setAdvanceFormStaffId(null)
    } catch (err) {
      setAdvanceError(getErrorMessage(err, 'Could not record advance.'))
    } finally {
      setAdvanceSubmitting(false)
    }
  }

  function startEditAdvance(a: NonNullable<typeof salaryAdvances>[number]) {
    setEditingAdvanceId(a.id)
    setAdvanceEditDraft({
      date: a.date,
      amount: String(a.amount),
      bankAccountId: a.bank_account_id ?? CASH_ACCOUNT,
      remarks: a.remarks ?? '',
    })
    setAdvanceEditError((m) => ({ ...m, [a.id]: '' }))
  }

  async function handleSaveAdvanceEdit(id: string) {
    const amt = parseINR(advanceEditDraft.amount)
    if (amt <= 0) {
      setAdvanceEditError((m) => ({ ...m, [id]: 'Enter an amount.' }))
      return
    }
    setAdvanceEditBusyId(id)
    setAdvanceEditError((m) => ({ ...m, [id]: '' }))
    try {
      await updateSalaryAdvance.mutateAsync({
        id,
        patch: {
          date: advanceEditDraft.date,
          amount: amt,
          bank_account_id: bankAccountIdOf(advanceEditDraft.bankAccountId),
          remarks: advanceEditDraft.remarks.trim() || null,
        },
      })
      setEditingAdvanceId(null)
    } catch (err) {
      setAdvanceEditError((m) => ({ ...m, [id]: getErrorMessage(err, 'Could not save changes.') }))
    } finally {
      setAdvanceEditBusyId(null)
    }
  }

  async function handleDeleteAdvance(a: NonNullable<typeof salaryAdvances>[number]) {
    const ok = await confirmAction({
      title: 'Delete advance',
      message: `Delete this advance of ${fmt(a.amount)} to ${staffName(a.staff_id)} dated ${fmtDate(a.date)}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setAdvanceEditBusyId(a.id)
    setAdvanceEditError((m) => ({ ...m, [a.id]: '' }))
    try {
      await deleteSalaryAdvance.mutateAsync(a.id)
    } catch (err) {
      setAdvanceEditError((m) => ({ ...m, [a.id]: getErrorMessage(err, 'Could not delete this advance.') }))
    } finally {
      setAdvanceEditBusyId(null)
    }
  }

  const staffName = (id: string) => staff?.find((s) => s.id === id)?.name ?? '—'
  const bankAccountName = (id: string | null) => (id ? bankAccounts?.find((a) => a.id === id)?.name ?? '—' : 'Cash')
  const supervisorName = (id: string | null) => (id ? profiles?.find((p) => p.id === id)?.name ?? '—' : '—')

  // "Payable by staff" grouped by supervisor, so an Admin reviewing payroll
  // sees each supervisor's team together instead of one flat alphabetical
  // list. Staff with no supervisor set are grouped last.
  const rowGroups = new Map<string, typeof rows>()
  for (const r of rows) {
    const key = r.staff.supervisor_id ?? ''
    const list = rowGroups.get(key) ?? []
    list.push(r)
    rowGroups.set(key, list)
  }
  const rowGroupKeys = [...rowGroups.keys()].sort((a, b) => {
    if (!a) return 1
    if (!b) return -1
    return supervisorName(a).localeCompare(supervisorName(b))
  })

  // Reconstructs the days-worked breakdown for an already-recorded payroll
  // run, from the same attendance/holiday records the run itself used —
  // there's nothing else stored on the accrual row to show it from.
  const viewingStaff = viewingAccrual ? staff?.find((s) => s.id === viewingAccrual.staff_id) : undefined
  const viewingBreakdown =
    viewingAccrual && viewingStaff
      ? computeAccrualBreakdown(
          viewingStaff,
          (allLeave ?? [])
            .filter((a) => a.staff_id === viewingAccrual.staff_id)
            .map((a) => ({ date: a.date, day_type: a.day_type as AttendanceDayType })),
          holidayDates,
          viewingAccrual.period_start,
          viewingAccrual.period_end,
          (allAssignments ?? [])
            .filter((a) => a.staff_id === viewingAccrual.staff_id && holidayDates.has(a.date))
            .map((a) => a.date)
        )
      : null

  // The day-by-day list behind a period's pay (same attendance, holidays and compensatory leave the run itself used).
  const accrualDaysFor = (st: NonNullable<typeof staff>[number], from: string, to: string): AccrualDay[] =>
    computeAccrualDays(
      st,
      (allLeave ?? []).filter((a) => a.staff_id === st.id).map((a) => ({ date: a.date, day_type: a.day_type as AttendanceDayType })),
      holidayDates,
      from,
      to,
      (allAssignments ?? []).filter((a) => a.staff_id === st.id && holidayDates.has(a.date)).map((a) => a.date)
    )
  const viewingDays = viewingAccrual && viewingStaff ? accrualDaysFor(viewingStaff, viewingAccrual.period_start, viewingAccrual.period_end) : []

  // How much salary advance is still outstanding for this worker right now
  // — shown on the pay-slip as what this period's pay would clear if fully
  // adjusted against it. The actual recovery is only confirmed later, when
  // a payment against this (or another) period is recorded — this is
  // indicative, not a booked transaction.
  const viewingAdvanceOutstanding = viewingAccrual
    ? Math.round(
        ((salaryAdvances ?? [])
          .filter((a) => a.staff_id === viewingAccrual.staff_id)
          .reduce((s, a) => s + Number(a.amount || 0), 0) -
          (payments ?? [])
            .filter((p) => p.staff_id === viewingAccrual.staff_id)
            .reduce((s, p) => s + Number(p.advance_recovered || 0), 0)) *
          100
      ) / 100
    : 0
  const viewingAdvanceAdjustment = viewingAccrual ? Math.min(viewingAdvanceOutstanding, viewingAccrual.amount) : 0

  // Wages already paid out to this worker before this run even happened —
  // e.g. an early/partial payment made ahead of formally running payroll.
  // That cash still counts against what this period owes, so it comes off
  // Net Pay too, same as an advance recovery does.
  const viewingPriorPayments = viewingAccrual
    ? (payments ?? []).filter((p) => p.staff_id === viewingAccrual.staff_id && p.created_at < viewingAccrual.created_at)
    : []
  const viewingPriorPaymentsTotal = Math.round(viewingPriorPayments.reduce((s, p) => s + Number(p.amount || 0), 0) * 100) / 100
  const viewingPriorPaymentsAdjustment = viewingAccrual
    ? Math.min(viewingPriorPaymentsTotal, Math.max(0, viewingAccrual.amount - viewingAdvanceAdjustment))
    : 0
  const viewingNetPay = viewingAccrual ? viewingAccrual.amount - viewingAdvanceAdjustment - viewingPriorPaymentsAdjustment : 0

  // The salary slip for one staff member and the chosen month: the salary worked out day by day, the payments made in the NEXT month against it
  // (wages are paid in arrears), and what is still due, which carries into the next month's slip.
  const breakupRow = breakupStaffId ? rows.find((r) => r.staff.id === breakupStaffId) : undefined
  const slip = breakupRow
    ? monthSlip({
        staff: breakupRow.staff,
        month: selectedMonth,
        attendance: (allLeave ?? []).filter((a) => a.staff_id === breakupRow.staff.id).map((a) => ({ date: a.date, day_type: a.day_type as AttendanceDayType })),
        holidayDates,
        workedHolidayDates: (allAssignments ?? []).filter((a) => a.staff_id === breakupRow.staff.id && holidayDates.has(a.date)).map((a) => a.date),
        runs: (accruals ?? [])
          .filter((a) => a.staff_id === breakupRow.staff.id)
          .map((a) => ({ id: a.id, display_id: a.display_id, period_start: a.period_start, period_end: a.period_end, amount: Number(a.amount || 0) })),
        payments: (payments ?? [])
          .filter((p) => p.staff_id === breakupRow.staff.id)
          .map((p) => ({
            id: p.id,
            display_id: p.display_id,
            date: p.date,
            amount: Number(p.amount || 0),
            advance_recovered: p.advance_recovered === null ? null : Number(p.advance_recovered),
            bank_account_id: p.bank_account_id,
            notes: p.notes,
          })),
      })
    : null

  const accrualRows = (accruals ?? []).filter((a) => matchesSearch(accrualSearch, [a.display_id, staffName(a.staff_id), a.period_start, a.period_end, a.amount, a.notes]))
  const paymentRows = (payments ?? []).filter((p) =>
    matchesSearch(paymentSearch, [p.display_id, staffName(p.staff_id), p.date, bankAccountName(p.bank_account_id), p.amount, p.advance_recovered, p.notes])
  )
  const advanceRows = (salaryAdvances ?? []).filter((a) => matchesSearch(advanceSearch, [a.display_id, staffName(a.staff_id), a.date, bankAccountName(a.bank_account_id), a.amount, a.remarks]))

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0, fontSize: 13 }}>Payable by staff</h3>
        <div className="field field-narrow" style={{ marginBottom: 12 }}>
          <label>Month</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="pay-btn"
              onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || todayStr().slice(0, 7))}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="pay-btn"
              onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </div>
        <details className="note" style={{ marginTop: -4, marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>How is this worked out?</summary>
          Salaries accrue one calendar month at a time. Pending accrual is what "Run payroll" would record right now
          for {monthLabel(selectedMonth)} — from the start of the month (or the last run, if that was later)
          through its end{periodEnd < lastDayOfMonth(selectedMonth) ? ` (capped at today, ${fmtDate(today)})` : ''} —
          holidays always paid; the first 4 absent/leave days each month are paid too, plus one more per Holiday
          actually worked, as compensatory leave. If an earlier month was never run, it shows up below as its own
          warning instead of being folded into this one.
        </details>
        <div className="table-scroll">
          <table className="data payable-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th style={{ textAlign: 'right' }}>Payable</th>
                <th style={{ textAlign: 'right' }}>Pending accrual</th>
                <th style={{ textAlign: 'right' }}>Advance outstanding</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No staff yet
                  </td>
                </tr>
              )}
              {rowGroupKeys.map((groupKey) => (
                <Fragment key={groupKey || 'none'}>
                  <tr className="group-header-row">
                    <td colSpan={5}>
                      {groupKey ? supervisorName(groupKey) : 'No supervisor'}{' '}
                      <span className="note" style={{ margin: 0 }}>
                        ({rowGroups.get(groupKey)!.length})
                      </span>
                    </td>
                  </tr>
                  {rowGroups.get(groupKey)!.map((r) => (
                    <Fragment key={r.staff.id}>
                  <tr className={r.hasPastMonthUnpaid || r.priorGap ? 'row-overdue' : undefined}>
                    <td>
                      <button type="button" className="btn link" title="Show how this payable is made up" onClick={() => setBreakupStaffId(r.staff.id)}>
                        {r.staff.name}
                      </button>
                    </td>
                    <td
                      className="amt"
                      style={r.hasPastMonthUnpaid ? { color: 'var(--red)', fontWeight: 700 } : undefined}
                      title={r.hasPastMonthUnpaid ? 'Includes salary accrued for a past month that still hasn’t been paid' : undefined}
                    >
                      {fmt(r.payable)}
                    </td>
                    <td className="amt">{fmt(r.pendingAccrual)}</td>
                    <td className="amt">{fmt(r.advanceOutstanding)}</td>
                    <td>
                      <button
                        type="button"
                        className="pay-btn"
                        disabled={r.pendingAccrual <= 0 || !!r.priorGap || runningId === r.staff.id}
                        title={r.priorGap ? 'Run payroll for the missed earlier month first' : undefined}
                        onClick={() => {
                          setConfirmingRow(r)
                          setBonusAmount('0')
                          setIncentiveAmount('0')
                          setAllowanceRate('0')
                        }}
                      >
                        {runningId === r.staff.id ? 'Running…' : 'Run payroll'}
                      </button>
                      <button type="button" className="pay-btn" onClick={() => openPayForm(r.staff.id, r.payable)}>
                        Record payment
                      </button>
                      <button type="button" className="pay-btn" onClick={() => openAdvanceForm(r.staff.id)}>
                        Give advance
                      </button>
                    </td>
                  </tr>
                  {r.priorGap && (
                    <tr>
                      <td colSpan={5}>
                        <div className="note" style={{ color: 'var(--red)', margin: 0 }}>
                          ⚠ Payroll was never run for {fmtDate(r.priorGap.from)} – {fmtDate(r.priorGap.to)} (
                          {fmt(r.priorGap.amount)} owed). Switch the Month above to{' '}
                          <button
                            type="button"
                            className="btn link"
                            style={{ fontSize: 12 }}
                            onClick={() => setSelectedMonth(r.priorGap!.from.slice(0, 7))}
                          >
                            {monthLabel(r.priorGap.from.slice(0, 7))}
                          </button>{' '}
                          and run that month first.
                        </div>
                      </td>
                    </tr>
                  )}
                  {payFormStaffId === r.staff.id && (
                    <tr className="pay-form-row">
                      <td colSpan={5}>
                        <form className="pay-form" onSubmit={handlePaySubmit}>
                          <div className="field">
                            <label>Date</label>
                            <input type="date" required value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                          </div>
                          <div className="field">
                            <label>Amount (₹)</label>
                            <CurrencyInput value={payAmount} onValueChange={setPayAmount} required />
                          </div>
                          <PaymentAccountPicker style={{ flexBasis: '100%' }} value={payBankAccountId} onChange={setPayBankAccountId} />

                          {r.advanceOutstanding > 0 && (
                            <div className="field">
                              <label>Recover from advance (₹) — {fmt(r.advanceOutstanding)} outstanding</label>
                              <CurrencyInput value={payAdvanceRecovered} onValueChange={setPayAdvanceRecovered} />
                            </div>
                          )}
                          <div className="field">
                            <label>Notes (optional)</label>
                            <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
                          </div>
                          <Button type="submit" disabled={paySubmitting}>
                            {paySubmitting ? 'Saving…' : 'Record payment'}
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => setPayFormStaffId(null)}>
                            Cancel
                          </Button>
                        </form>
                        {payError && (
                          <div className="note" style={{ color: 'var(--red)' }}>
                            {payError}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  {advanceFormStaffId === r.staff.id && (
                    <tr className="pay-form-row">
                      <td colSpan={5}>
                        <form className="pay-form" onSubmit={handleAdvanceSubmit}>
                          <div className="field">
                            <label>Date</label>
                            <input type="date" required value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} />
                          </div>
                          <div className="field">
                            <label>Amount (₹)</label>
                            <CurrencyInput value={advanceAmount} onValueChange={setAdvanceAmount} required />
                          </div>
                          <PaymentAccountPicker style={{ flexBasis: '100%' }} value={advanceBankAccountId} onChange={setAdvanceBankAccountId} />

                          <div className="field">
                            <label>Remarks (optional)</label>
                            <input type="text" value={advanceRemarks} onChange={(e) => setAdvanceRemarks(e.target.value)} />
                          </div>
                          <Button type="submit" disabled={advanceSubmitting}>
                            {advanceSubmitting ? 'Saving…' : 'Give advance'}
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => setAdvanceFormStaffId(null)}>
                            Cancel
                          </Button>
                        </form>
                        {advanceError && (
                          <div className="note" style={{ color: 'var(--red)' }}>
                            {advanceError}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {runError && (
          <div className="note" style={{ color: 'var(--red)' }}>
            {runError}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0, fontSize: 13 }}>Wage accrual history</h3>
        <div className="toolbar" style={{ marginTop: 0 }}>
          <div className="toolbar-group toolbar-fill">
            <TableSearch value={accrualSearch} onChange={setAccrualSearch} inline placeholder="Search by ID, staff name, period or amount…" />
          </div>
        </div>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th></th>
                <th>ID</th>
                <th>Staff</th>
                <th>Period</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(!accruals || accruals.length === 0) && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No payroll runs yet
                  </td>
                </tr>
              )}
              {accruals && accruals.length > 0 && accrualRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    Nothing matches your search
                  </td>
                </tr>
              )}
              {accrualRows.map((a) => (
                <RecordRow
                  key={a.id}
                  expanded={openRows.isOpen(a.id)}
                  onToggle={() => openRows.toggle(a.id)}
                  colSpan={6}
                  details={<RecordDetails sourceTable="wage_accruals" sourceId={a.id} />}
                  // A payroll run is final: it is viewed (the pay-slip), not edited or deleted.
                  extraItems={[{ label: 'View pay-slip', onClick: () => openViewAccrual(a) }]}
                >
                  <td>{a.display_id ?? '—'}</td>
                  <td>
                    <button type="button" className="btn link" onClick={() => openViewAccrual(a)}>
                      {staffName(a.staff_id)}
                    </button>
                  </td>
                  <td>
                    {fmtDate(a.period_start)} – {fmtDate(a.period_end)}
                  </td>
                  <td className="amt">{fmt(a.amount)}</td>
                </RecordRow>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 13 }}>Wage payment history</h3>
        <div className="toolbar" style={{ marginTop: 0 }}>
          <div className="toolbar-group toolbar-fill">
            <TableSearch value={paymentSearch} onChange={setPaymentSearch} inline placeholder="Search by ID, staff name, date, account or amount…" />
          </div>
        </div>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th></th>
                <th>ID</th>
                <th>Staff</th>
                <th>Date</th>
                <th>Account</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Advance recovered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(!payments || payments.length === 0) && (
                <tr>
                  <td colSpan={8} className="empty-row">
                    No payments recorded yet
                  </td>
                </tr>
              )}
              {payments && payments.length > 0 && paymentRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-row">
                    Nothing matches your search
                  </td>
                </tr>
              )}
              {paymentRows.map((p) => (
                <RecordRow
                  key={p.id}
                  expanded={openRows.isOpen(p.id)}
                  onToggle={() => openRows.toggle(p.id)}
                  colSpan={8}
                  details={<RecordDetails sourceTable="wage_payments" sourceId={p.id} />}
                >
                  <td>{p.display_id ?? '—'}</td>
                  <td>{staffName(p.staff_id)}</td>
                  <td>{fmtDate(p.date)}</td>
                  <td>{bankAccountName(p.bank_account_id)}</td>
                  <td className="amt">{fmt(p.amount)}</td>
                  <td className="amt">{p.advance_recovered ? fmt(p.advance_recovered) : '—'}</td>
                </RecordRow>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <h3 style={{ marginTop: 0, fontSize: 13 }}>Salary advance history</h3>
        <div className="toolbar" style={{ marginTop: 0 }}>
          <div className="toolbar-group toolbar-fill">
            <TableSearch value={advanceSearch} onChange={setAdvanceSearch} inline placeholder="Search by ID, staff name, date, account or amount…" />
          </div>
        </div>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th></th>
                <th>ID</th>
                <th>Staff</th>
                <th>Date</th>
                <th>Account</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(!salaryAdvances || salaryAdvances.length === 0) && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    No salary advances given yet
                  </td>
                </tr>
              )}
              {salaryAdvances && salaryAdvances.length > 0 && advanceRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    Nothing matches your search
                  </td>
                </tr>
              )}
              {advanceRows.map((a) => (
                <RecordRow
                  key={a.id}
                  expanded={openRows.isOpen(a.id)}
                  onToggle={() => openRows.toggle(a.id)}
                  colSpan={7}
                  details={<RecordDetails sourceTable="staff_salary_advances" sourceId={a.id} />}
                  onEdit={() => startEditAdvance(a)}
                  onDelete={() => void handleDeleteAdvance(a)}
                >
                  <td>{a.display_id ?? '—'}</td>
                  <td>{staffName(a.staff_id)}</td>
                  <td>{fmtDate(a.date)}</td>
                  <td>{bankAccountName(a.bank_account_id)}</td>
                  <td className="amt">
                    {fmt(a.amount)}
                    {advanceEditError[a.id] && (
                      <div className="note" style={{ color: 'var(--red)', marginTop: 4 }}>
                        {advanceEditError[a.id]}
                      </div>
                    )}
                  </td>
                </RecordRow>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {breakupRow && slip && (
        <div className="modal-backdrop" onClick={() => setBreakupStaffId(null)}>
          <div ref={slipRef} className="modal-panel payslip-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="modal-close" onClick={() => setBreakupStaffId(null)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="payslip-no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <button type="button" className="pay-btn" onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))} aria-label="Previous month">
                  ‹
                </button>
                <strong style={{ minWidth: 140, textAlign: 'center' }}>{monthLabel(selectedMonth)}</strong>
                <button type="button" className="pay-btn" onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))} aria-label="Next month">
                  ›
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingBottom: 4 }}>
                <img src={laavinLogo} alt="Laavin InfraScapes" style={{ height: 28, mixBlendMode: 'multiply' }} />
                <strong style={{ fontSize: 14 }}>
                  <Bi en="SALARY SLIP" hi="वेतन पर्ची" /> ({monthLabel(selectedMonth)})
                </strong>
              </div>

              <table className="data table-compact keep-table">
                <tbody>
                  <tr>
                    <td>
                      <Bi en="Staff" hi="कर्मचारी" />
                    </td>
                    <td className="amt">
                      <strong>{breakupRow.staff.name}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Bi en="Period" hi="अवधि" />
                    </td>
                    <td className="amt">
                      {slip.counts.total > 0 ? (
                        <>
                          {fmtDate(slip.days[0].date)} – {fmtDate(slip.days[slip.days.length - 1].date)} ({slip.counts.total} days)
                        </>
                      ) : (
                        'Not on the job this month'
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Bi en="Daily rate" hi="दैनिक दर" />
                    </td>
                    <td className="amt">{fmt(breakupRow.staff.daily_rate)}</td>
                  </tr>
                </tbody>
              </table>

              <table className="data table-compact keep-table">
                <thead>
                  <tr>
                    <th colSpan={2}>
                      <Bi en="Days Breakdown" hi="दिनों का विवरण" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <Bi en="Days worked (present)" hi="उपस्थित दिन" />
                    </td>
                    <td className="amt">{slip.counts.present}</td>
                  </tr>
                  <tr>
                    <td>
                      <Bi en="Leave — paid" hi="अवकाश — सशुल्क" />
                    </td>
                    <td className="amt">{slip.counts.paidLeave}</td>
                  </tr>
                  <tr>
                    <td>
                      <Bi en="Absent — unpaid" hi="अनुपस्थित — अवैतनिक" />
                    </td>
                    <td className="amt" style={slip.counts.unpaidLeave > 0 ? { color: 'var(--red)' } : undefined}>
                      {slip.counts.unpaidLeave}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Bi en="Half days" hi="आधे दिन" />
                    </td>
                    <td className="amt">{slip.counts.halfDays}</td>
                  </tr>
                  <tr>
                    <td>
                      <Bi en="Holidays" hi="छुट्टियाँ" />
                    </td>
                    <td className="amt">{slip.counts.holidays}</td>
                  </tr>
                </tbody>
              </table>

              <DayDates days={slip.days} bilingual />

              <table className="data table-compact keep-table">
                <thead>
                  <tr>
                    <th colSpan={2}>
                      <Bi en="Salary for the month" hi="माह का वेतन" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <Bi en="Gross" hi="सकल" /> ({slip.counts.total} days × {fmt(breakupRow.staff.daily_rate)})
                    </td>
                    <td className="amt">{fmt(slip.counts.total * breakupRow.staff.daily_rate)}</td>
                  </tr>
                  {slip.counts.unpaidLeave > 0 && (
                    <tr>
                      <td>
                        <Bi en="Less: Absent — unpaid" hi="घटाएं: अनुपस्थित" /> ({slip.counts.unpaidLeave} × {fmt(breakupRow.staff.daily_rate)})
                      </td>
                      <td className="amt" style={{ color: 'var(--red)' }}>
                        −{fmt(slip.counts.unpaidLeave * breakupRow.staff.daily_rate)}
                      </td>
                    </tr>
                  )}
                  {slip.counts.halfDays > 0 && (
                    <tr>
                      <td>
                        <Bi en="Less: Half days" hi="घटाएं: आधे दिन" /> ({slip.counts.halfDays} × {fmt(breakupRow.staff.daily_rate * 0.5)})
                      </td>
                      <td className="amt" style={{ color: 'var(--red)' }}>
                        −{fmt(slip.counts.halfDays * breakupRow.staff.daily_rate * 0.5)}
                      </td>
                    </tr>
                  )}
                  {slip.extras !== 0 && (
                    <tr>
                      <td>
                        <Bi en="Bonus, incentive, allowance, adjustments" hi="बोनस, प्रोत्साहन, भत्ता, समायोजन" />
                        <div className="retention-note">{slip.runs.map((r) => r.display_id ?? 'Payroll run').join(', ')}</div>
                      </td>
                      <td className="amt" style={slip.extras < 0 ? { color: 'var(--red)' } : undefined}>
                        {slip.extras < 0 ? '−' : '+'}
                        {fmt(Math.abs(slip.extras))}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>
                      <strong>
                        <Bi en="Salary for the month" hi="माह का वेतन" />
                      </strong>
                    </td>
                    <td className="amt">
                      <strong style={{ fontSize: 16 }}>{fmt(slip.salary)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
              {slip.sharedRuns.length > 0 && (
                <div className="note" style={{ margin: 0 }}>
                  Payroll for this month was run together with other months ({slip.sharedRuns.map((r) => `${r.display_id ?? 'run'} ${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}`).join('; ')}), so
                  the salary above is worked out from the days alone.
                </div>
              )}

              <table className="data table-compact keep-table">
                <thead>
                  <tr>
                    <th colSpan={2}>
                      <Bi en="Payment" hi="भुगतान" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slip.broughtForward !== 0 && (
                    <tr>
                      <td>
                        {slip.broughtForward > 0 ? (
                          <Bi en="Due from earlier months" hi="पिछले महीनों का बकाया" />
                        ) : (
                          <Bi en="Paid ahead in earlier months" hi="पहले से अधिक भुगतान" />
                        )}
                      </td>
                      <td className="amt">{fmt(slip.broughtForward)}</td>
                    </tr>
                  )}
                  <tr>
                    <td>
                      <Bi en="Salary for the month" hi="माह का वेतन" />
                    </td>
                    <td className="amt">{fmt(slip.salary)}</td>
                  </tr>
                  {slip.paid.length === 0 && (
                    <tr>
                      <td>
                        <Bi en={`Paid in ${monthLabel(slip.paidMonth)}`} hi="भुगतान" />
                      </td>
                      <td className="amt">{fmt(0)}</td>
                    </tr>
                  )}
                  {slip.paid.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Bi en="Paid" hi="भुगतान" /> {fmtDate(p.date)} <span className="note" style={{ margin: 0 }}>{p.display_id ?? ''}</span>
                        <div className="retention-note">
                          {bankAccountName(p.bank_account_id)}
                          {Number(p.advance_recovered) > 0 ? ` · ${fmt(p.advance_recovered)} was an advance recovered` : ''}
                          {p.notes ? ` · ${p.notes}` : ''}
                        </div>
                      </td>
                      <td className="amt" style={{ color: 'var(--red)' }}>
                        −{fmt(p.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <strong>
                        <Bi en="Due" hi="बकाया" />
                      </strong>
                    </td>
                    <td className="amt">
                      <strong style={{ fontSize: 16, color: slip.due > 0 ? 'var(--red)' : undefined }}>{fmt(slip.due)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="note" style={{ margin: 0 }}>
                Wages are paid a month later: what is paid in {monthLabel(slip.paidMonth)} counts against {monthLabel(slip.month)}.
                {slip.due > 0 ? ` The ${fmt(slip.due)} still due is carried to the ${monthLabel(slip.paidMonth)} slip.` : ''}
              </div>

              <div className="payslip-no-print" style={{ display: 'flex', gap: 8 }}>
                <Button type="button" variant="secondary" onClick={handleDownloadSlip} disabled={downloadingImage}>
                  {downloadingImage ? 'Capturing…' : 'Download screenshot'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => window.print()}>
                  Print / Save as PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingAdvanceId && (salaryAdvances ?? []).find((x) => x.id === editingAdvanceId) && (
        <Modal title="Edit salary advance" onClose={() => setEditingAdvanceId(null)}>
          <div className="form-grid">
            <div className="field">
              <label>Date</label>
              <input type="date" aria-label="Date" value={advanceEditDraft.date} onChange={(e) => setAdvanceEditDraft((d) => ({ ...d, date: e.target.value }))} />
            </div>
            <div className="field">
              <label>Amount (₹)</label>
              <CurrencyInput value={advanceEditDraft.amount} onValueChange={(v) => setAdvanceEditDraft((d) => ({ ...d, amount: v }))} />
            </div>
            <PaymentAccountPicker className="full" value={advanceEditDraft.bankAccountId} onChange={(id) => setAdvanceEditDraft((d) => ({ ...d, bankAccountId: id }))} />
            <div className="field full">
              <label>Remarks (optional)</label>
              <input type="text" value={advanceEditDraft.remarks} onChange={(e) => setAdvanceEditDraft((d) => ({ ...d, remarks: e.target.value }))} />
            </div>
            <div className="field full" style={{ display: 'flex', gap: 8 }}>
              <Button type="button" disabled={advanceEditBusyId === editingAdvanceId} onClick={() => void handleSaveAdvanceEdit(editingAdvanceId)}>
                Save changes
              </Button>
              <Button type="button" variant="secondary" disabled={advanceEditBusyId === editingAdvanceId} onClick={() => setEditingAdvanceId(null)}>
                Cancel
              </Button>
            </div>
            {advanceEditError[editingAdvanceId] && (
              <div className="note full" style={{ color: 'var(--red)' }}>
                {advanceEditError[editingAdvanceId]}
              </div>
            )}
          </div>
        </Modal>
      )}

      {confirmingRow && (
        <div className="modal-backdrop" onClick={() => (runningId ? null : setConfirmingRow(null))}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong>Confirm payroll run</strong>
              <button type="button" className="modal-close" onClick={() => setConfirmingRow(null)} disabled={!!runningId}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(() => {
                const b = confirmingRow.breakdown
                const bonus = parseINR(bonusAmount)
                const incentive = parseINR(incentiveAmount)
                const rate = parseINR(allowanceRate)
                const allowance = rate * b.presentDays
                const total = confirmingRow.pendingAccrual + bonus + incentive + allowance
                return (
                  <>
                    <table className="data">
                      <tbody>
                        <tr>
                          <td>Staff</td>
                          <td className="amt">{confirmingRow.staff.name}</td>
                        </tr>
                        <tr>
                          <td>Period</td>
                          <td className="amt">
                            {fmtDate(confirmingRow.effectiveStart)} – {fmtDate(periodEnd)} ({b.totalDays} days)
                          </td>
                        </tr>
                        <tr>
                          <td>Daily rate</td>
                          <td className="amt">{fmt(confirmingRow.staff.daily_rate)}</td>
                        </tr>
                      </tbody>
                    </table>

                    <table className="data">
                      <thead>
                        <tr>
                          <th colSpan={2}>Days breakdown</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Days worked (present)</td>
                          <td className="amt">{b.presentDays}</td>
                        </tr>
                        <tr>
                          <td>Leave — paid</td>
                          <td className="amt">{b.paidOffDays}</td>
                        </tr>
                        <tr>
                          <td>Absent — unpaid</td>
                          <td className="amt" style={b.unpaidOffDays > 0 ? { color: 'var(--red)' } : undefined}>
                            {b.unpaidOffDays}
                          </td>
                        </tr>
                        <tr>
                          <td>Half days</td>
                          <td className="amt">{b.halfDays}</td>
                        </tr>
                        <tr>
                          <td>Holidays</td>
                          <td className="amt">{b.holidayDays}</td>
                        </tr>
                      </tbody>
                    </table>

                    <table className="data">
                      <thead>
                        <tr>
                          <th colSpan={2}>Bonus / Incentive / Allowance (optional)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Bonus (₹)</td>
                          <td className="amt" style={{ maxWidth: 140 }}>
                            <CurrencyInput value={bonusAmount} onValueChange={setBonusAmount} />
                          </td>
                        </tr>
                        <tr>
                          <td>Incentive (₹)</td>
                          <td className="amt" style={{ maxWidth: 140 }}>
                            <CurrencyInput value={incentiveAmount} onValueChange={setIncentiveAmount} />
                          </td>
                        </tr>
                        <tr>
                          <td>Allowance rate (₹/day)</td>
                          <td className="amt" style={{ maxWidth: 140 }}>
                            <CurrencyInput value={allowanceRate} onValueChange={setAllowanceRate} />
                          </td>
                        </tr>
                        <tr>
                          <td>Allowance = {b.presentDays} days × {fmt(rate)}</td>
                          <td className="amt">{fmt(allowance)}</td>
                        </tr>
                      </tbody>
                    </table>

                    <table className="data">
                      <tbody>
                        <tr>
                          <td>Base accrual</td>
                          <td className="amt">{fmt(confirmingRow.pendingAccrual)}</td>
                        </tr>
                        <tr>
                          <td>
                            <strong>Amount to accrue</strong>
                          </td>
                          <td className="amt">
                            <strong style={{ fontSize: 16 }}>{fmt(total)}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="note" style={{ margin: 0 }}>
                      This records {fmt(total)} as payable to {confirmingRow.staff.name} for this period. It doesn't
                      pay them — use "Record payment" separately for that.
                    </div>
                  </>
                )
              })()}
              {runError && (
                <div className="note" style={{ color: 'var(--red)' }}>
                  {runError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Button type="button" disabled={!!runningId} onClick={() => handleRunPayroll(confirmingRow)}>
                  {runningId === confirmingRow.staff.id ? 'Running…' : 'Confirm & run payroll'}
                </Button>
                <Button type="button" variant="secondary" disabled={!!runningId} onClick={() => setConfirmingRow(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingAccrual && viewingStaff && viewingBreakdown && (
        <div className="modal-backdrop" onClick={() => setViewingAccrual(null)}>
          <div ref={payslipRef} className="modal-panel payslip-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="modal-close" onClick={() => setViewingAccrual(null)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 }}>
                <img src={laavinLogo} alt="Laavin InfraScapes" style={{ height: 28, mixBlendMode: 'multiply' }} />
                <strong style={{ fontSize: 14 }}>PAYSLIP ({monthLabel(viewingAccrual.period_end.slice(0, 7))})</strong>
              </div>
              <table className="data table-compact keep-table">
                <tbody>
                  <tr>
                    <td>
                      <Bi en="Staff" hi="कर्मचारी" />
                    </td>
                    <td className="amt">
                      <strong>{viewingStaff.name}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Bi en="Period" hi="अवधि" />
                    </td>
                    <td className="amt">
                      {fmtDate(viewingAccrual.period_start)} – {fmtDate(viewingAccrual.period_end)} ({viewingBreakdown.totalDays} days)
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Bi en="Salary" hi="वेतन" />
                    </td>
                    <td className="amt">{fmt(viewingStaff.daily_rate * 30)}</td>
                  </tr>
                </tbody>
              </table>

              <table className="data table-compact keep-table">
                <thead>
                  <tr>
                    <th colSpan={2}>
                      <Bi en="Days Breakdown" hi="दिनों का विवरण" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <Bi en="Days worked (present)" hi="उपस्थित दिन" />
                    </td>
                    <td className="amt">{viewingBreakdown.presentDays}</td>
                  </tr>
                  <tr>
                    <td>
                      <Bi en="Leave — paid" hi="अवकाश — सशुल्क" />
                    </td>
                    <td className="amt">{viewingBreakdown.paidOffDays}</td>
                  </tr>
                  <tr>
                    <td>
                      <Bi en="Absent — unpaid" hi="अनुपस्थित — अवैतनिक" />
                    </td>
                    <td className="amt" style={viewingBreakdown.unpaidOffDays > 0 ? { color: 'var(--red)' } : undefined}>
                      {viewingBreakdown.unpaidOffDays}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Bi en="Half days" hi="आधे दिन" />
                    </td>
                    <td className="amt">{viewingBreakdown.halfDays}</td>
                  </tr>
                  <tr>
                    <td>
                      <Bi en="Holidays" hi="छुट्टियाँ" />
                    </td>
                    <td className="amt">{viewingBreakdown.holidayDays}</td>
                  </tr>
                </tbody>
              </table>

              <DayDates days={viewingDays} bilingual />

              {(() => {
                const gross = viewingBreakdown.totalDays * viewingStaff.daily_rate
                const absentDeduction = viewingBreakdown.unpaidOffDays * viewingStaff.daily_rate
                const halfDayDeduction = viewingBreakdown.halfDays * viewingStaff.daily_rate * 0.5
                return (
                  <table className="data table-compact keep-table">
                    <thead>
                      <tr>
                        <th colSpan={2}>
                          <Bi en="Wage Calculation" hi="वेतन गणना" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <Bi en="Gross" hi="सकल" /> ({viewingBreakdown.totalDays} days × {fmt(viewingStaff.daily_rate)})
                        </td>
                        <td className="amt">{fmt(gross)}</td>
                      </tr>
                      {absentDeduction > 0 && (
                        <tr>
                          <td>
                            <Bi en="Less: Absent — unpaid" hi="घटाएं: अनुपस्थित" /> ({viewingBreakdown.unpaidOffDays} ×{' '}
                            {fmt(viewingStaff.daily_rate)})
                          </td>
                          <td className="amt" style={{ color: 'var(--red)' }}>
                            −{fmt(absentDeduction)}
                          </td>
                        </tr>
                      )}
                      {halfDayDeduction > 0 && (
                        <tr>
                          <td>
                            <Bi en="Less: Half days" hi="घटाएं: आधे दिन" /> ({viewingBreakdown.halfDays} ×{' '}
                            {fmt(viewingStaff.daily_rate * 0.5)})
                          </td>
                          <td className="amt" style={{ color: 'var(--red)' }}>
                            −{fmt(halfDayDeduction)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )
              })()}

              <table className="data table-compact keep-table">
                <tbody>
                  <tr>
                    <td>
                      <Bi en="Base accrual" hi="मूल उपार्जन" />
                    </td>
                    <td className="amt">{fmt(viewingBreakdown.amount)}</td>
                  </tr>
                  {editingAccrual ? (
                    <tr>
                      <td>
                        <Bi en="Notes" hi="टिप्पणी" />
                      </td>
                      <td className="amt">
                        <input
                          type="text"
                          value={editAccrualNotes}
                          onChange={(e) => setEditAccrualNotes(e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </td>
                    </tr>
                  ) : (
                    viewingAccrual.notes && (
                      <tr>
                        <td>
                          <Bi en="Notes" hi="टिप्पणी" />
                        </td>
                        <td className="amt">{viewingAccrual.notes}</td>
                      </tr>
                    )
                  )}
                  <tr>
                    <td>
                      <strong>
                        <Bi en="Amount accrued" hi="अर्जित राशि" />
                      </strong>
                    </td>
                    <td className="amt">
                      {editingAccrual ? (
                        <CurrencyInput value={editAccrualAmount} onValueChange={setEditAccrualAmount} />
                      ) : (
                        <strong style={{ fontSize: 16 }}>{fmt(viewingAccrual.amount)}</strong>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="data table-compact keep-table">
                <tbody>
                  {viewingPriorPaymentsTotal > 0 && (
                    <tr>
                      <td>
                        <Bi en="Less: Already paid" hi="घटाएं: पहले से भुगतान" />
                      </td>
                      <td className="amt" style={{ color: 'var(--red)' }}>
                        −{fmt(viewingPriorPaymentsAdjustment)}
                      </td>
                    </tr>
                  )}
                  {viewingAdvanceAdjustment > 0 && (
                    <tr>
                      <td>
                        <Bi en="Less: Advance recovery" hi="घटाएं: अग्रिम वसूली" />
                      </td>
                      <td className="amt" style={{ color: 'var(--red)' }}>
                        −{fmt(viewingAdvanceAdjustment)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>
                      <strong>
                        <Bi en="Net Pay" hi="नेट वेतन" />
                      </strong>
                    </td>
                    <td className="amt">
                      <strong style={{ fontSize: 16 }}>{fmt(viewingNetPay)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
              {viewingPriorPaymentsTotal > 0 && (
                <div className="note" style={{ margin: 0 }}>
                  {viewingPriorPayments.length} payment{viewingPriorPayments.length === 1 ? '' : 's'} totaling{' '}
                  {fmt(viewingPriorPaymentsTotal)} {viewingPriorPayments.length === 1 ? 'was' : 'were'} recorded for this
                  worker before this payroll run — applied here against what this period owes.
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {viewingPriorPayments.map((p) => (
                      <li key={p.id}>
                        {fmtDate(p.date)} — {fmt(p.amount)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {viewingAdvanceAdjustment > 0 && (
                <div className="note" style={{ margin: 0 }}>
                  Assumes the full {fmt(viewingAdvanceOutstanding)} outstanding advance is adjusted against this
                  period — actual recovery is only booked when a payment is recorded, and may differ.
                </div>
              )}

              {editAccrualError && (
                <div className="note" style={{ color: 'var(--red)', margin: 0 }}>
                  {editAccrualError}
                </div>
              )}

              <div className="payslip-no-print" style={{ display: 'flex', gap: 8 }}>
                {editingAccrual ? (
                  <>
                    <Button type="button" disabled={editAccrualSubmitting} onClick={handleSaveAccrualEdit}>
                      {editAccrualSubmitting ? 'Saving…' : 'Save'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={editAccrualSubmitting}
                      onClick={() => {
                        setEditingAccrual(false)
                        setEditAccrualAmount(String(viewingAccrual.amount))
                        setEditAccrualNotes(viewingAccrual.notes ?? '')
                        setEditAccrualError(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="secondary" onClick={() => setEditingAccrual(true)}>
                      Edit
                    </Button>
                    <Button type="button" variant="secondary" onClick={handleDownloadImage} disabled={downloadingImage}>
                      {downloadingImage ? 'Capturing…' : 'Download screenshot'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => window.print()}>
                      Print / Save as PDF
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
