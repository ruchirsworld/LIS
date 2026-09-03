import { supabase } from './supabase'

// A single GPS fix, stored so an admin can look up where a Supervisor
// checked in from — currently fired once per login (see App.tsx). Mirrors
// LIS_Fields' workStore.ts, minus the old Start Work toggle/interval, which
// had no caller left once that button was removed from the dashboard.
export function captureAndPing(profileId: string) {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      void supabase.from('staff_location_pings').insert({
        profile_id: profileId,
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        taken_at: new Date().toISOString(),
      })
    },
    (err) => {
      console.error('Location ping failed', err)
    },
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }
  )
}
