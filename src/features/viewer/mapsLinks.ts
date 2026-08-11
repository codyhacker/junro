import type { TravelMode } from '../../shared/types/trip'

// Deep links into the native maps app. Junro doesn't do turn-by-turn
// (principle 6) — once you're on the ground, navigation is the OS maps app's
// job, and these hand off to it. Google's universal URLs open the installed
// app on both iOS and Android.

const q = (coord: [number, number]) => `${coord[1]},${coord[0]}`   // lat,lng

export function mapsSearchUrl(coord: [number, number]): string {
  return `https://www.google.com/maps/search/?api=1&query=${q(coord)}`
}

// One tap to route the whole day: origin → waypoints → destination.
export function mapsDirectionsUrl(coords: [number, number][], mode: TravelMode): string {
  if (coords.length < 2) return coords.length === 1 ? mapsSearchUrl(coords[0]) : ''
  const origin = q(coords[0])
  const destination = q(coords[coords.length - 1])
  const waypoints = coords.slice(1, -1).map(q).join('|')
  const params = new URLSearchParams({ api: '1', origin, destination, travelmode: mode })
  if (waypoints) params.set('waypoints', waypoints)
  return `https://www.google.com/maps/dir/?${params}`
}
