import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from './ui'
import { cleanCalcInput, evaluateDisplay } from '../lib/calc/expression'

const KEYS = ['(', ')', 'C', '⌫', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '+']

/** A real calculator (parentheses + operator precedence) backed by a safe parser — no eval/Function.
 * Works with the buttons or the keyboard: type digits and + - * / ( ), press Enter or = for the result,
 * Backspace to correct, Esc to close. */
export function InlineCalculator({ onResult, onClose }: { onResult: (value: number) => void; onClose?: () => void }) {
  const [expr, setExpr] = useState('')
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Ready to type as soon as it opens.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function press(key: string) {
    setError(false)
    if (key === 'C') setExpr('')
    else if (key === '⌫') setExpr((prev) => prev.slice(0, -1))
    else setExpr((prev) => prev + key)
    // Keep the keyboard working after a button is pressed.
    inputRef.current?.focus()
  }

  function pressEquals() {
    if (!expr.trim()) return
    try {
      onResult(evaluateDisplay(expr))
      setExpr('')
    } catch {
      setError(true)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === '=') {
      // Enter must not submit the expense form this calculator sits in.
      e.preventDefault()
      pressEquals()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose?.()
    }
  }

  return (
    <div style={{ marginTop: 10, maxWidth: 280 }}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label="Calculator. Type a sum, press Enter for the result."
        value={error ? 'Error' : expr}
        placeholder="0"
        onFocus={(e) => {
          if (error) {
            setError(false)
            e.currentTarget.select()
          }
        }}
        onChange={(e) => {
          setError(false)
          setExpr(cleanCalcInput(error ? e.target.value.replace('Error', '') : e.target.value))
        }}
        onKeyDown={onKeyDown}
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
            tabIndex={-1}
            style={{ height: 44, fontSize: 16, gridColumn: k === '0' ? 'span 2' : undefined }}
            onClick={() => press(k)}
          >
            {k}
          </Button>
        ))}
        <Button type="button" tabIndex={-1} style={{ height: 44, fontSize: 16, gridColumn: 'span 4' }} onClick={pressEquals}>
          =
        </Button>
      </div>
      <div className="note" style={{ marginTop: 6 }}>
        Type with the keyboard: + − × ÷ ( ). Enter gives the result, Esc closes.
      </div>
    </div>
  )
}
