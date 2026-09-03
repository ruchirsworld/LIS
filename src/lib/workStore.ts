import { supabase } from './supabase'

export type LocationPingResult = 'ok' | 'denied' | 'unavailable'

// A single GPS fix, stored so an admin can look up where a Supervisor
// checked in from — fired once per login (see App.tsx), and again on demand
// if the Supervisor retries after granting access. Mirrors LIS_Fields'
// workStore.ts, minus the old Start Work toggle/interval, which had no
// caller left once that button was removed from the dashboard.
//
// Resolves with which of three things happened, rather than failing
// silently — a denied/unavailable result drives a persistent in-app prompt
// (see Shell.tsx) since the browser itself won't ask again once denied.
export function requestLocationPing(profileId: string): Promise<LocationPingResult> {
  if (!navigator.geolocation) return Promise.resolve('unavailable')
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Awaited (not fire-and-forget) so a failed insert is actually
        // logged instead of silently vanishing, and so the request can't
        // get cut off by whatever happens right after the app unlocks.
        const { error } = await supabase.from('staff_location_pings').insert({
          profile_id: profileId,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          taken_at: new Date().toISOString(),
        })
        if (error) console.error('Location ping insert failed', error)
        resolve('ok')
      },
      (err) => {
        console.error('Location ping failed', err)
        resolve(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }
    )
  })
}
