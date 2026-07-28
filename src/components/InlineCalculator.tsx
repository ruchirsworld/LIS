import { useState } from 'react'
import { Button } from './ui'
import { evaluateExpression } from '../lib/calc/expression'

const KEYS = ['(', ')', 'C', '⌫', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '+']

/** A real calculator (parentheses + operator precedence) backed by a safe parser — no eval/Function. */
export function InlineCalculator({ onResult }: { onResult: (value: number) => void }) {
  const [expr, setExpr] = useState('')
  const [error, setError] = useState(false)

  function press(key: string) {
    setError(false)
    if (key === 'C') {
      setExpr('')
      return
    }
    if (key === '⌫') {
      setExpr((prev) => prev.slice(0, -1))
      return
    }
    setExpr((prev) => prev + key)
  }

  function pressEquals() {
    if (!expr.trim()) return
    try {
      const normalized = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
      const result = evaluateExpression(normalized)
      onResult(Math.round(result * 100) / 100)
      setExpr('')
    } catch {
      setError(true)
    }
  }

  return (
    <div style={{ marginTop: 10, maxWidth: 280 }}>
      <input
        type="text"
        readOnly
        value={error ? 'Error' : expr}
        placeholder="0"
        style={{
          width: '100%',
          fontFamily: 'var(--font-mono)',
          fontSize: 18,
          padding: '10px 12px',
          border: '1px solid var(--line)',
          borderRadius: 6,
          background: 'var(--paper-2)',
          color: error ? 'var(--red)' : 'var(--ink)',
          boxSizing: 'border-box',
          marginBottom: 6,
        }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {KEYS.map((k) => (
          <Button
            key={k}
            type="button"
            variant="secondary"
            style={{ height: 44, fontSize: 16, gridColumn: k === '0' ? 'span 2' : undefined }}
            onClick={() => press(k)}
          >
            {k}
          </Button>
        ))}
        <Button type="button" style={{ height: 44, fontSize: 16, gridColumn: 'span 4' }} onClick={pressEquals}>
          =
        </Button>
      </div>
    </div>
  )
}
