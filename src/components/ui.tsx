import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './ui.css'

export function Button({
  variant = 'primary',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'link' }) {
  const cls = variant === 'primary' ? 'btn' : variant === 'secondary' ? 'btn secondary' : 'btn link'
  return <button className={[cls, className].filter(Boolean).join(' ')} {...rest} />
}

export function ModuleHeader({ children }: { children: ReactNode }) {
  return <div className="module-header">{children}</div>
}

export function KpiCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="dash-card">
      <div className="dash-label">{label}</div>
      <div className="dash-value">{value}</div>
    </div>
  )
}
