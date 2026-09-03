import { useQuery } from '@tanstack/react-query'

// Free reverse-geocoding via OpenStreetMap's Nominatim — no API key, but its
// fair-use policy caps usage at ~1 request/second, so this is only ever
// fetched on demand (a user click), never auto-fired for a whole table of
// rows at once. staleTime: Infinity since a given lat/lon's place name is
// effectively permanent, so repeat views never re-fetch it.
export function useReverseGeocode(lat: number | null, lon: number | null) {
  return useQuery({
    queryKey: ['reverse-geocode', lat, lon],
    queryFn: async () => {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16`)
      if (!res.ok) throw new Error('Reverse geocode failed')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      return (data.display_name as string | undefined) ?? null
    },
    enabled: lat != null && lon != null,
    staleTime: Infinity,
    retry: 1,
  })
}

// Nominatim's display_name is a full address hierarchy (house number, road,
// suburb, city, state, postcode, country) — much more than fits a table
// cell. Keep the first few meaningful segments; the full string is still
// available via a title/tooltip wherever this is used.
export function shortenPlaceName(fullName: string, segments = 3): string {
  return fullName
    .split(',')
    .map((p) => p.trim())
    .slice(0, segments)
    .join(', ')
}
