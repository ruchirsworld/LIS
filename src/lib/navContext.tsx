import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ExpenseCostCenter, TabId } from './nav'
import type { ReportPeriodType } from './calc/reportPeriod'

export type InvoiceView = 'all' | 'due' | 'overdue' | 'draft' | 'retention' | 'gst'

/** What the destination page should show on arrival. Every field is optional;
 * a page only reads the ones it understands. */
export interface NavFilter {
  /** Invoices: narrow the ledger to one client. */
  clientId?: string
  /** Invoices: which invoices the ledger lists. */
  invoiceView?: InvoiceView
  /** Procurements: only bills with something still unpaid. */
  vendorView?: 'unpaid'
  /** Reports: open this report (by id) straight away. */
  report?: string
  /** Reports: the period to open it with. */
  period?: { type: ReportPeriodType; from: string | null; to: string | null }
  /** Lists with a date filter (receipts, bills, expenses): preset it. */
  range?: { from: string; to: string }
  /** HR: which section to open. */
  hrSection?: 'Imprest'
  /** Approvals: whose pending claims to show. */
  supervisorId?: string
  /** DOM id of the section to scroll into view once the page has arrived. */
  focus?: string
}

export type GoTo = (tab: TabId, opts?: { costCenter?: ExpenseCostCenter; filter?: NavFilter }) => void

export interface NavIntent {
  tab: TabId
  filter: NavFilter
  nonce: number
}

/** Lets a page send the user to another tab (the dashboard's drill-through
 * cards). Null outside the app shell, in which case callers just render
 * their cards as plain, non-clickable ones. */
export const NavContext = createContext<GoTo | null>(null)
export const NavIntentContext = createContext<NavIntent | null>(null)

export function useGoTo(): GoTo | null {
  return useContext(NavContext)
}

/** The drill-through filter waiting for this tab (null otherwise). Every
 * component on the page that calls this gets it, once per drill-through —
 * `nonce` changes with each new one, so a page that is already open can
 * re-apply. The app clears the intent when the user navigates by hand, so a
 * later manual visit to the tab never replays an old drill-through. Also
 * scrolls to `focus` if given. */
export function useNavFilter(tab: TabId): { filter: NavFilter; nonce: number } | null {
  const intent = useContext(NavIntentContext)
  const [applied, setApplied] = useState<{ filter: NavFilter; nonce: number } | null>(null)
  const lastNonce = useRef(0)

  useEffect(() => {
    if (!intent || intent.tab !== tab || intent.nonce <= lastNonce.current) return
    lastNonce.current = intent.nonce
    setApplied({ filter: intent.filter, nonce: intent.nonce })
    const focus = intent.filter.focus
    if (focus) {
      // Give the page a moment to render the section it should land on.
      setTimeout(() => document.getElementById(focus)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
    }
  }, [intent, tab])

  return applied
}
