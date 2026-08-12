import type { FeatureCollection, Polygon } from 'geojson'

// Reachability shading (PROJECT_PLAN.md §6): Mapbox Isochrone API, "how far
// can I get on foot from the hotel." Service layer — HTTP only, never the map
// or Redux. Results cached in memory; the polygons are the API's own output
// (not user data), so caching is unrestricted.

const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''
const BASE = 'https://api.mapbox.com/isochrone/v1/mapbox'

export const ISOCHRONE_MINUTES = [15, 30, 45] as const

export function isochroneKey(coord: [number, number], profile = 'walking'): string {
  return `${profile}|${coord[0].toFixed(5)},${coord[1].toFixed(5)}|${ISOCHRONE_MINUTES.join(',')}`
}

const cache = new Map<string, FeatureCollection<Polygon>>()

export async function fetchIsochrone(
  coord: [number, number],
  profile = 'walking',
  signal?: AbortSignal,
): Promise<FeatureCollection<Polygon> | null> {
  if (!TOKEN) return null
  const key = isochroneKey(coord, profile)
  const hit = cache.get(key)
  if (hit) return hit

  const params = new URLSearchParams({
    contours_minutes: ISOCHRONE_MINUTES.join(','),
    polygons: 'true',
    denoise: '1',
    access_token: TOKEN,
  })
  const res = await fetch(`${BASE}/${profile}/${coord[0]},${coord[1]}?${params}`, { signal })
  if (!res.ok) throw new Error(`isochrone failed: ${res.status}`)
  const json = (await res.json()) as FeatureCollection<Polygon>
  cache.set(key, json)
  return json
}
