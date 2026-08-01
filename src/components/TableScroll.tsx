import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Wraps a wide, vertically-scrolling `.table-scroll` table with a synced
 * horizontal scrollbar strip above it, so the sideways scrollbar doesn't
 * hide below a tall table where it's hard to reach. */
export function TableScroll({ children }: { children: ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [contentWidth, setContentWidth] = useState(0)
  // Tracks which side initiated a scroll, so the resulting programmatic
  // scroll on the other side doesn't bounce back and forth.
  const syncingFrom = useRef<'top' | 'bottom' | null>(null)

  useEffect(() => {
    const bottom = bottomRef.current
    if (!bottom) return
    const update = () => setContentWidth(bottom.scrollWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(bottom)
    return () => ro.disconnect()
  }, [children])

  function handleTopScroll() {
    if (syncingFrom.current === 'bottom') {
      syncingFrom.current = null
      return
    }
    syncingFrom.current = 'top'
    if (bottomRef.current && topRef.current) bottomRef.current.scrollLeft = topRef.current.scrollLeft
  }

  function handleBottomScroll() {
    if (syncingFrom.current === 'top') {
      syncingFrom.current = null
      return
    }
    syncingFrom.current = 'bottom'
    if (topRef.current && bottomRef.current) topRef.current.scrollLeft = bottomRef.current.scrollLeft
  }

  return (
    <>
      <div ref={topRef} className="table-scroll-top" onScroll={handleTopScroll}>
        <div style={{ width: contentWidth, height: 1 }} />
      </div>
      <div ref={bottomRef} className="table-scroll" onScroll={handleBottomScroll}>
        {children}
      </div>
    </>
  )
}
