import type { TravelMode } from '../../shared/types/trip'

// Content hash over (ordered coords + mode) — the cache key for a day's
// route (PROJECT_PLAN.md §4: "route caches key on content hashes so
// reordering stops invalidates exactly the affected day and nothing
// refetches on unrelated edits").
//
// Coordinates round to 6 decimals (~11 cm) so float noise from an unrelated
// edit can't invalidate a route, while any real move does.

const COORD_PRECISION = 6

export function canonicalRouteKey(coords: [number, number][], mode: TravelMode): string {
  const path = coords
    .map(([lng, lat]) => `${lng.toFixed(COORD_PRECISION)},${lat.toFixed(COORD_PRECISION)}`)
    .join(';')
  return `${mode}|${path}`
}

// FNV-1a, 32-bit — small, dependency-free, and stable across reloads.
export function routeHash(coords: [number, number][], mode: TravelMode): string {
  const key = canonicalRouteKey(coords, mode)
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
