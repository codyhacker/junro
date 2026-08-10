// The trip document — the single source of truth and the unit of
// persistence/export (PROJECT_PLAN.md §4). Derived data (clusters, routes,
// timelines) is never stored on these types.

export type PlaceCategory = 'restaurant' | 'cafe' | 'sight' | 'shop' | 'other'

export type TravelMode = 'walking' | 'driving'

export interface SavedPlace {
  id: string                   // UUIDv7
  name: string
  coord: [number, number]      // [lng, lat]
  category: PlaceCategory
  address?: string
  notes?: string               // the "why did I save this?" line — scrapbook subtitle
  dwellMin: number             // default by category (cafe 45, restaurant 90, sight 120)
  priority: 'must' | 'nice'
  fixedTime?: string           // HH:mm — timed reservation; optimizer anchor (user-entered in v1)
  openDays?: number[]          // 0–6; closed-on-Monday museums (user-entered in v1)
  source: 'user' | 'places-layer'
  gersId?: string              // Overture GERS id when source is places-layer
}

export interface Lodging {
  id: string
  name: string
  coord: [number, number]
  checkIn: string              // ISO date
  checkOut: string
}

export interface Day {
  id: string
  date: string                 // ISO date
  lodgingId: string | null     // resolved from date ∩ lodging ranges
  stopIds: string[]            // ordered SavedPlace ids
  locked: boolean              // user hand-ordered; optimizer must not touch
  usableHours?: { start: string; end: string }
  travelMode?: TravelMode                        // excursion-day override
}

export interface TripPrefs {
  travelMode: TravelMode
  dayStart: string             // HH:mm
  dayEnd: string
  maxStopsPerDay: number
}

export interface Trip {
  id: string
  schemaVersion: number
  name: string
  destination: { name: string; center: [number, number]; bbox?: [number, number, number, number] }
  startDate?: string           // optional at creation — days materialize once both dates exist
  endDate?: string
  lodgings: Lodging[]
  places: SavedPlace[]
  days: Day[]
  prefs: TripPrefs
  createdAt: string
  updatedAt: string
}

export interface TripSummary {
  id: string
  name: string
  destinationName: string
  updatedAt: string
}

export const DEFAULT_PREFS: TripPrefs = {
  travelMode: 'walking',
  dayStart: '09:30',
  dayEnd: '21:30',
  maxStopsPerDay: 6,
}

export const DEFAULT_DWELL_MIN: Record<PlaceCategory, number> = {
  restaurant: 90,
  cafe: 45,
  sight: 120,
  shop: 40,
  other: 60,
}
