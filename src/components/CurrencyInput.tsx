import { useRef, type InputHTMLAttributes } from 'react'
import { formatINR } from '../lib/calc/format'

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Raw numeric value (not comma-formatted). */
  value: string
  onValueChange: (raw: string) => void
}

/** Live Indian comma-grouped currency input (e.g. 12,50,000), ported from the v1.0 prototype. */
export function CurrencyInput({ value, onValueChange, ...rest }: CurrencyInputProps) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      value={formatINR(value)}
      onChange={(e) => {
        const el = e.target
        const fromEnd = el.value.length - (el.selectionStart ?? el.value.length)
        const formatted = formatINR(el.value)
        onValueChange(formatted.replace(/,/g, ''))
        requestAnimationFrame(() => {
          const pos = Math.max(0, formatted.length - fromEnd)
          el.setSelectionRange(pos, pos)
        })
      }}
      {...rest}
    />
  )
}
