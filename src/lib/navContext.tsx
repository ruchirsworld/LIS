import { createContext, useContext } from 'react'
import type { ExpenseCostCenter, TabId } from './nav'

export type GoTo = (tab: TabId, opts?: { costCenter?: ExpenseCostCenter }) => void

/** Lets a page send the user to another tab (the dashboard's drill-through
 * cards). Null outside the app shell, in which case callers just render
 * their cards as plain, non-clickable ones. */
export const NavContext = createContext<GoTo | null>(null)

export function useGoTo(): GoTo | null {
  return useContext(NavContext)
}
