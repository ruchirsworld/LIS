import { useEffect, type RefObject } from 'react'

/** On a phone every table turns into a stack of cards. The cards need each cell to know its column heading, so this copies the heading
 * text onto the cells (data-label) and marks date and amount cells, which the card puts first. It watches the page, so tables that load
 * later are labelled too. On wider screens it does nothing. */
export function useStackedTables(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const mq = window.matchMedia('(max-width: 640px)')
    let frame = 0

    function label(table: HTMLTableElement) {
      const headRow = table.tHead?.rows[table.tHead.rows.length - 1]
      if (!headRow) return
      const headings: string[] = []
      for (const th of Array.from(headRow.cells)) {
        const text = (th.textContent ?? '').trim()
        for (let i = 0; i < th.colSpan; i++) headings.push(text)
      }
      for (const body of Array.from(table.tBodies)) {
        for (const row of Array.from(body.rows)) {
          let col = 0
          for (const cell of Array.from(row.cells)) {
            if (cell.colSpan === 1) {
              const heading = headings[col] ?? ''
              if (cell.dataset.label !== heading) cell.dataset.label = heading
              const role = /^date$/i.test(heading) ? 'date' : /^(amount|total)$/i.test(heading) ? 'amount' : ''
              if (role) cell.dataset.role = role
            }
            col += cell.colSpan
          }
        }
      }
    }

    function run() {
      frame = 0
      if (!mq.matches) return
      root!.querySelectorAll<HTMLTableElement>('table.data').forEach(label)
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(run)
    }

    const observer = new MutationObserver(schedule)
    observer.observe(root, { childList: true, subtree: true })
    mq.addEventListener('change', schedule)
    schedule()
    return () => {
      observer.disconnect()
      mq.removeEventListener('change', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [rootRef])
}
