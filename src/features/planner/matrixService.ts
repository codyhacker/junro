import type { TravelMode } from '../../shared/types/trip'
import { haversineKm } from '../../shared/lib/geo'
import { canonicalRouteKey } from './routeHash'

// Travel-time matrix for a day's ordering (PROJECT_PLAN.md §6, §7 Stage 3).
// Service layer: touches only HTTP, never the map or Redux. Responses live in
// this in-memory cache only — never persisted (Mapbox ToS, same posture as
// Directions). Haversine stands in when offline or over the 25-coord limit.

const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''
const BASE = 'https://api.mapbox.com/directions-matrix/v1/mapbox'
const MATRIX_COORD_LIMIT = 25 // Mapbox cap for walking/driving

// City-speed assumptions for the offline fallback. Deliberately rough — the
// fallback only has to order stops sanely, not report real ETAs.
const FALLBACK_KMH: Record<TravelMode, number> = { walking: 4.8, driving: 28 }

export interface TravelMatrix {
  seconds: number[][] // seconds[i][j] = i → j travel time
  source: 'mapbox' | 'haversine'
}

// Straight-line duration matrix — exported so Stage 3 can fall back to it and
// so tests get a deterministic matrix with no network.
export function haversineMatrix(coords: [number, number][], mode: TravelMode): TravelMatrix {
  const kmh = FALLBACK_KMH[mode]
  const seconds = coords.map((a, i) =>
    coords.map((b, j) => (i === j ? 0 : (haversineKm(a, b) / kmh) * 3600)),
  )
  return { seconds, source: 'haversine' }
}

const cache = new Map<string, TravelMatrix>()

export async function getTravelMatrix(
  coords: [number, number][],
  mode: TravelMode,
  signal?: AbortSignal,
): Promise<TravelMatrix> {
  if (coords.length < 2) return { seconds: [[0]], source: 'haversine' }

  // Over the API's coordinate cap → haversine (a day should never be this big,
  // but whole-trip callers might be).
  if (coords.length > MATRIX_COORD_LIMIT || !TOKEN) return haversineMatrix(coords, mode)

  const key = canonicalRouteKey(coords, mode)
  const hit = cache.get(key)
  if (hit) return hit

  try {
    const path = coords.map(([lng, lat]) => `${lng},${lat}`).join(';')
    const params = new URLSearchParams({ annotations: 'duration', access_token: TOKEN })
    const res = await fetch(`${BASE}/${mode}/${path}?${params}`, { signal })
    if (!res.ok) throw new Error(`matrix failed: ${res.status}`)
    const json = (await res.json()) as { durations?: (number | null)[][]; code?: string }
    if (!json.durations) throw new Error('matrix: no durations')

    // Mapbox returns null for an unreachable pair — patch those with the
    // haversine estimate so the tour builder always has a finite cost.
    const fallback = haversineMatrix(coords, mode).seconds
    const seconds = json.durations.map((row, i) =>
      row.map((v, j) => (v == null ? fallback[i][j] : v)),
    )
    const matrix: TravelMatrix = { seconds, source: 'mapbox' }
    cache.set(key, matrix)
    return matrix
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err
    // Network down / API error — the offline stand-in keeps planning working.
    return haversineMatrix(coords, mode)
  }
}
