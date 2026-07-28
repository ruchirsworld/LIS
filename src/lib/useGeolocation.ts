import { useCallback, useEffect, useState } from 'react'

export interface Geo {
  lat: number
  lng: number
}

/** Silently captures the browser's current position, no button — ported from the v1.0 prototype, plus a retry hook for the GPS status icon. */
export function useGeolocation() {
  const [geo, setGeo] = useState<Geo | null>(null)
  const [status, setStatus] = useState('Locating…')

  const capture = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('Geolocation not supported on this device.')
      return
    }
    setStatus('Locating…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const g = { lat: Number(pos.coords.latitude.toFixed(5)), lng: Number(pos.coords.longitude.toFixed(5)) }
        setGeo(g)
        setStatus(`Captured: ${g.lat}, ${g.lng}`)
      },
      (err) => {
        setGeo(null)
        setStatus('Could not get location: ' + err.message)
      }
    )
  }, [])

  useEffect(() => {
    capture()
  }, [capture])

  return { geo, status, retry: capture }
}
