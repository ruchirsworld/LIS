import { ChartColumn, Handshake, Landmark, Receipt, Settings, ShoppingCart, Users, type LucideIcon } from 'lucide-react'
import type { ModuleId } from '../lib/nav'

/** One Lucide icon per menu module. The menu always shows the icon together with its text label. */
export const MODULE_ICON: Record<ModuleId, LucideIcon> = {
  expenses: Receipt,
  procurement: ShoppingCart,
  clients: Handshake,
  team: Users,
  finance: Landmark,
  reports: ChartColumn,
  settings: Settings,
}
