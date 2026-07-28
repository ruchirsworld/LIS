import type { ReactElement } from 'react'
import type { TabId } from '../lib/nav'

const svgProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function DashboardIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}

function ExpensesIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="14.5" r="1.6" />
    </svg>
  )
}

function TeamIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="8" cy="8" r="3" />
      <path d="M2 19a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14.5 19a5 5 0 0 1 8 0" />
    </svg>
  )
}

function PurchasesIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h3l2.2 12.2a2 2 0 0 0 2 1.6H18a2 2 0 0 0 2-1.6L21.5 7H6" />
    </svg>
  )
}

function InvoicesIcon() {
  return (
    <svg {...svgProps}>
      <path d="M6 2h8l5 5v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      <path d="M14 2v5h5" />
      <path d="M8 12h8M8 16h8M8 8h4" />
    </svg>
  )
}

function LoansIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3 10 12 4l9 6" />
      <path d="M5 10v9M10 10v9M14 10v9M19 10v9" />
      <path d="M3 21h18" />
      <path d="M3 10h18" />
    </svg>
  )
}

function CapitalIcon() {
  return (
    <svg {...svgProps}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
      <path d="M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
    </svg>
  )
}

function TransfersIcon() {
  return (
    <svg {...svgProps}>
      <path d="M4 7h13" />
      <path d="M14 4l3 3-3 3" />
      <path d="M20 17H7" />
      <path d="M10 14l-3 3 3 3" />
    </svg>
  )
}

function ProjectsIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3" y="7" width="18" height="12" rx="1.5" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  )
}

function ReportsIcon() {
  return (
    <svg {...svgProps}>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M3 20h18" />
    </svg>
  )
}

function AdminIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v3M12 18v3M21 12h-3M6 12H3" />
      <path d="M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7 5.6 5.6" />
    </svg>
  )
}

const ICONS: Record<TabId, () => ReactElement> = {
  dashboard: DashboardIcon,
  expenses: ExpensesIcon,
  team: TeamIcon,
  purchases: PurchasesIcon,
  invoices: InvoicesIcon,
  loans: LoansIcon,
  capital: CapitalIcon,
  transfers: TransfersIcon,
  projects: ProjectsIcon,
  reports: ReportsIcon,
  admin: AdminIcon,
}

export function NavIcon({ id, size = 20 }: { id: TabId; size?: number }) {
  const Icon = ICONS[id]
  return (
    <span className="nav-icon" style={{ width: size, height: size }}>
      <Icon />
    </span>
  )
}
