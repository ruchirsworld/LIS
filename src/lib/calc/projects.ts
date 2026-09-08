import { billTotal, type VendorBillRow } from './vendorBills'
import { netPayable, totalPaid, type InvoiceRow, type InvoicePaymentRow } from './invoices'
import { computeAccrualDays, type AccrualStaff, type AttendanceDay, type AttendanceDayType } from './payroll'
import { resolveStaffSite, type SiteAssignmentException } from './siteAssignment'

export interface ExpenseRow {
  project_id: string | null
  amount: number
}

export function projectExpenseTotal(projectId: string, expenses: ExpenseRow[]): number {
  return expenses
    .filter((e) => e.project_id === projectId)
    .reduce((s, e) => s + Number(e.amount || 0), 0)
}

export function projectVendorBillTotal(projectId: string, bills: (VendorBillRow & { project_id: string | null })[]): number {
  return bills
    .filter((b) => b.project_id === projectId)
    .reduce((s, b) => s + billTotal(b), 0)
}

export function projectInvoicedRevenue(
  projectId: string,
  invoices: (InvoiceRow & { id: string; project_id: string | null })[],
): number {
  return invoices
    .filter((i) => i.project_id === projectId)
    .reduce((s, i) => s + netPayable(i), 0)
}

export function projectReceivedRevenue(
  projectId: string,
  invoices: (InvoiceRow & { id: string; project_id: string | null })[],
  payments: (InvoicePaymentRow & { invoice_id: string })[],
): number {
  return invoices
    .filter((i) => i.project_id === projectId)
    .reduce((s, i) => {
      const invPayments = payments.filter((p) => p.invoice_id === i.id)
      return s + totalPaid(invPayments)
    }, 0)
}

export interface WageStaff extends AccrualStaff {
  id: string
  name: string
  default_project_id?: string | null
}

export interface WageAttendanceRow {
  staff_id: string
  date: string
  day_type: string
}

export interface WageAssignmentRow {
  staff_id: string
  date: string
  project_id: string
}

export interface WorkerWageAmount {
  staffId: string
  name: string
  amount: number
}

// A day only counts toward a project's wage cost if the worker was actually
// deployed there that day (resolveStaffSite — the same rule the Team
// Calendar uses) — off/paid-leave/unworked-Holiday days aren't attributed
// to any project, since no site work happened. The pay for a day that does
// count comes from computeAccrualDays, the exact model payroll itself uses,
// so this always agrees with what's actually paid.
export function projectWageByStaff(
  projectId: string,
  today: string,
  staffList: WageStaff[],
  attendance: WageAttendanceRow[],
  assignments: WageAssignmentRow[],
  holidayDates: Set<string>,
  rangeStart: string,
  rangeEnd: string,
): WorkerWageAmount[] {
  const exceptionByStaffDate = new Map<string, SiteAssignmentException>()
  for (const a of attendance) exceptionByStaffDate.set(`${a.staff_id}:${a.date}`, a)
  const assignmentByStaffDate = new Map<string, string>()
  for (const a of assignments) assignmentByStaffDate.set(`${a.staff_id}:${a.date}`, a.project_id)

  const result: WorkerWageAmount[] = []
  for (const staff of staffList) {
    const staffAttendanceDays: AttendanceDay[] = attendance
      .filter((a) => a.staff_id === staff.id)
      .map((a) => ({ date: a.date, day_type: a.day_type as AttendanceDayType }))
    const workedHolidayDates = assignments
      .filter((a) => a.staff_id === staff.id && holidayDates.has(a.date))
      .map((a) => a.date)
    const days = computeAccrualDays(staff, staffAttendanceDays, holidayDates, rangeStart, rangeEnd, workedHolidayDates)

    let staffTotal = 0
    for (const day of days) {
      const site = resolveStaffSite(staff, day.date, today, exceptionByStaffDate, assignmentByStaffDate, holidayDates)
      if (site === projectId) staffTotal += day.amount
    }
    if (staffTotal > 0) result.push({ staffId: staff.id, name: staff.name, amount: staffTotal })
  }
  return result.sort((a, b) => b.amount - a.amount)
}

export function projectWageTotal(...args: Parameters<typeof projectWageByStaff>): number {
  return projectWageByStaff(...args).reduce((s, r) => s + r.amount, 0)
}
