import type { PlaceCategory } from '../../shared/types/trip'

// Mapbox Search Box API — interactive suggest/retrieve with session-token
// billing. Results are NEVER persisted as-is (Mapbox ToS): what we store is
// the user's confirmed save, provenance `source: 'user'` (PROJECT_PLAN.md §6).
// This service touches only HTTP; results flow back through the callers.

const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''
const BASE = 'https://api.mapbox.com/search/searchbox/v1'

export interface Suggestion {
  mapboxId: string
  name: string
  placeFormatted: string // secondary line (address / region)
  categories: string[]
}

export interface RetrievedPlace {
  name: string
  coord: [number, number]
  address?: string
  categories: string[]
  bbox?: [number, number, number, number]
}

// One session token per autocomplete session (created on first keystroke,
// retired after the retrieve) — that's the billing unit.
export function newSessionToken(): string {
  return crypto.randomUUID()
}

export async function suggest(
  query: string,
  sessionToken: string,
  opts: { proximity?: [number, number]; types?: string } = {},
  signal?: AbortSignal,
): Promise<Suggestion[]> {
  const params = new URLSearchParams({
    q: query,
    access_token: TOKEN,
    session_token: sessionToken,
    limit: '6',
    types: opts.types ?? 'poi,address',
  })
  if (opts.proximity) params.set('proximity', opts.proximity.join(','))

  const res = await fetch(`${BASE}/suggest?${params}`, { signal })
  if (!res.ok) throw new Error(`suggest failed: ${res.status}`)
  const json = (await res.json()) as {
    suggestions?: {
      mapbox_id: string
      name: string
      place_formatted?: string
      full_address?: string
      poi_category?: string[]
    }[]
  }
  return (json.suggestions ?? []).map((s) => ({
    mapboxId: s.mapbox_id,
    name: s.name,
    placeFormatted: s.place_formatted ?? s.full_address ?? '',
    categories: s.poi_category ?? [],
  }))
}

export async function retrieve(
  mapboxId: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<RetrievedPlace | null> {
  const params = new URLSearchParams({ access_token: TOKEN, session_token: sessionToken })
  const res = await fetch(`${BASE}/retrieve/${encodeURIComponent(mapboxId)}?${params}`, { signal })
  if (!res.ok) throw new Error(`retrieve failed: ${res.status}`)
  const json = (await res.json()) as {
    features?: {
      geometry: { coordinates: [number, number] }
      properties: {
        name: string
        full_address?: string
        poi_category?: string[]
        bbox?: [number, number, number, number]
      }
    }[]
  }
  const f = json.features?.[0]
  if (!f) return null
  return {
    name: f.properties.name,
    coord: f.geometry.coordinates,
    address: f.properties.full_address,
    categories: f.properties.poi_category ?? [],
    bbox: f.properties.bbox,
  }
}

// Best-effort mapping from Search Box poi_category strings to Junro's five.
export function guessCategory(categories: string[]): PlaceCategory {
  const joined = categories.join(' ').toLowerCase()
  if (/(coffee|café|cafe|tea house|bakery)/.test(joined)) return 'cafe'
  if (/(restaurant|food|bistro|brunch|pizza|sushi|burger|noodle|bar\b)/.test(joined))
    return 'restaurant'
  if (
    /(museum|monument|attraction|historic|landmark|gallery|temple|shrine|church|castle|park|garden|viewpoint)/.test(
      joined,
    )
  )
    return 'sight'
  if (/(shop|store|boutique|market|mall|bookstore)/.test(joined)) return 'shop'
  return 'other'
}
