import type { Day, Lodging, SavedPlace, Trip, TripPrefs } from '../../shared/types/trip'
import { haversineKm } from '../../shared/lib/geo'

// A standalone per-day timeline for the viewer + exports. Deliberately does
// NOT depend on planner.dayRoutes (those are in-memory only and absent after a
// JSON import or offline) — travel is a straight-line estimate at a mode speed,
// same posture as the matrix fallback. Good enough to lay out a day's clock;
// the live map still shows the real routed times.

const SPEED_KMH: Record<'walking' | 'driving', number> = { walking: 4.8, driving: 28 }

export interface TimedStop {
  placeId: string
  name: string
  category: SavedPlace['category']
  arrivalMin: number            // minutes since midnight
  departureMin: number
  travelFromPrevMin: number     // travel to reach this stop
  fixed: boolean                // arrival pinned to a reservation
  coord: [number, number]
  address?: string
  notes?: string
}

export interface DayTimeline {
  dayId: string
  date: string
  lodgingName: string | null
  stops: TimedStop[]
  returnTravelMin: number       // trip back to the lodging (0 if none)
  endMin: number                // clock time back at the lodging / last stop
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function formatClock(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = Math.round(min % 60)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export function computeDayTimeline(
  day: Day,
  placesById: Map<string, SavedPlace>,
  lodgingsById: Map<string, Lodging>,
  prefs: TripPrefs,
): DayTimeline {
  const lodging = day.lodgingId ? lodgingsById.get(day.lodgingId) : undefined
  const speed = SPEED_KMH[day.travelMode ?? prefs.travelMode]
  const travelMin = (a: [number, number], b: [number, number]) => (haversineKm(a, b) / speed) * 60

  const startMin = toMin(day.usableHours?.start ?? prefs.dayStart)
  const stops: TimedStop[] = []
  let clock = startMin
  let prevCoord = lodging?.coord ?? null

  for (const id of day.stopIds) {
    const place = placesById.get(id)
    if (!place) continue
    const travel = prevCoord ? travelMin(prevCoord, place.coord) : 0
    let arrival = clock + travel
    // A reservation pins arrival forward (you wait rather than arrive early).
    const fixed = Boolean(place.fixedTime)
    if (place.fixedTime) arrival = Math.max(arrival, toMin(place.fixedTime))
    const departure = arrival + place.dwellMin
    stops.push({
      placeId: place.id,
      name: place.name,
      category: place.category,
      arrivalMin: arrival,
      departureMin: departure,
      travelFromPrevMin: travel,
      fixed,
      coord: place.coord,
      address: place.address,
      notes: place.notes,
    })
    clock = departure
    prevCoord = place.coord
  }

  const returnTravelMin = lodging && prevCoord && prevCoord !== lodging.coord
    ? travelMin(prevCoord, lodging.coord)
    : 0

  return {
    dayId: day.id,
    date: day.date,
    lodgingName: lodging?.name ?? null,
    stops,
    returnTravelMin,
    endMin: clock + returnTravelMin,
  }
}

export function computeTripTimeline(trip: Trip): DayTimeline[] {
  const placesById = new Map(trip.places.map(p => [p.id, p]))
  const lodgingsById = new Map(trip.lodgings.map(l => [l.id, l]))
  return trip.days.map(d => computeDayTimeline(d, placesById, lodgingsById, trip.prefs))
}
