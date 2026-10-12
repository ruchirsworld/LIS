import type { KeyboardEvent } from 'react'

/** Makes a clickable non-button element (a table row that opens something)
 * reachable from the keyboard: it takes focus with Tab and Enter or Space
 * does what a click does. Pass undefined for a row that is not interactive. */
export function activateProps(action: (() => void) | undefined) {
  if (!action) return {}
  return {
    onClick: action,
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent) => {
      // Ignore keys pressed inside a control in the row (a button, link or field).
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        action()
      }
    },
  }
}
