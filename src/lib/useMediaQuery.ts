import { useEffect, useState } from 'react'

/** Live `matchMedia` result — re-renders when the window crosses the query. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const update = () => setMatches(window.matchMedia(query).matches)
    update()
    mql.addEventListener('change', update)
    // Some embedded webviews resize without firing the query's change event.
    window.addEventListener('resize', update)
    return () => {
      mql.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [query])

  return matches
}
