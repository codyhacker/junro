import type { TravelMode } from '../../shared/types/trip'
import type { RouteGeometry } from './plannerSlice'

// Mapbox Directions API — one request per day, [lodging, …stops, lodging]
// (PROJECT_PLAN.md §6). This service touches only HTTP: it never reads Redux
// and never speaks to the map. Responses are handed back to the caller and
// live in the planner slice in memory only — never persisted (Mapbox ToS).
//
// Abort discipline from silkymaps' satelliteTiles: one AbortController per
// day, so a new request for the same day supersedes the in-flight one.

const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''
const BASE = 'https://api.mapbox.com/directions/v5/mapbox'

export interface RouteResult {
  geometry: RouteGeometry
  legSeconds: number[]
  totalSeconds: number
}

const inFlight = new Map<string, AbortController>()

export function isAbort(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError'
}

export async function fetchDayRoute(
  dayId: string,
  coords: [number, number][],
  mode: TravelMode,
): Promise<RouteResult | null> {
  inFlight.get(dayId)?.abort()
  const ac = new AbortController()
  inFlight.set(dayId, ac)

  try {
    const path = coords.map(([lng, lat]) => `${lng},${lat}`).join(';')
    const params = new URLSearchParams({
      geometries: 'geojson',
      overview: 'full',
      access_token: TOKEN,
    })
    const res = await fetch(`${BASE}/${mode}/${path}?${params}`, { signal: ac.signal })
    if (!res.ok) throw new Error(`directions failed: ${res.status}`)
    const json = await res.json() as {
      routes?: {
        duration: number
        geometry: RouteGeometry
        legs?: { duration: number }[]
      }[]
    }
    const route = json.routes?.[0]
    // No route between these points (an island stop, a driving-only gap) is
    // not an error — it just means this day draws nothing.
    if (!route) return null
    return {
      geometry: route.geometry,
      legSeconds: (route.legs ?? []).map(l => l.duration),
      totalSeconds: route.duration,
    }
  } finally {
    if (inFlight.get(dayId) === ac) inFlight.delete(dayId)
  }
}
