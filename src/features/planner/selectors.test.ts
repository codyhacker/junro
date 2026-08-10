import { describe, it, expect } from 'vitest'
import tripReducer, {
  tripHydrated, setTripDates, addLodging, assignStop, moveStop, setTravelMode, setDayTravelMode,
} from '../trip/tripSlice'
import type { RootState } from '../../app/store'
import type { SavedPlace, Trip } from '../../shared/types/trip'
import { DEFAULT_PREFS } from '../../shared/types/trip'
import { TRIP_SCHEMA_VERSION } from '../trip/storage'
import { selectDayRouteRequests } from './selectors'

// The Phase 3 verify criterion in pure form: an edit must change the hash of
// exactly the day it touched, and nothing else.

function place(id: string, coord: [number, number]): SavedPlace {
  return { id, name: id, coord, category: 'cafe', dwellMin: 45, priority: 'nice', source: 'user' }
}

const PLACES = [
  place('p1', [2.3376, 48.8606]),
  place('p2', [2.3499, 48.8530]),
  place('p3', [2.3212, 48.8467]),
  place('p4', [2.2945, 48.8584]),
]

function baseTrip(): Trip {
  return {
    id: 'trip-1',
    schemaVersion: TRIP_SCHEMA_VERSION,
    name: 'Paris',
    destination: { name: 'Paris', center: [2.35, 48.86] },
    lodgings: [],
    places: PLACES,
    days: [],
    prefs: { ...DEFAULT_PREFS },
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  }
}

type TripState = ReturnType<typeof tripReducer>
const asRoot = (trip: TripState): RootState => ({ trip }) as unknown as RootState
const hashes = (trip: TripState) =>
  Object.fromEntries(selectDayRouteRequests(asRoot(trip)).map(r => [r.dayId, r.hash]))

// Two days, a hotel, and two stops each.
function twoDayTrip(): TripState {
  let state = tripReducer(undefined, tripHydrated({ summaries: [], active: baseTrip() }))
  state = tripReducer(state, addLodging({
    name: 'Hôtel', coord: [2.33, 48.87], checkIn: '2026-05-01', checkOut: '2026-05-03',
  }))
  state = tripReducer(state, setTripDates({ startDate: '2026-05-01', endDate: '2026-05-02' }))
  const [d1, d2] = state.active!.days
  state = tripReducer(state, assignStop({ placeId: 'p1', dayId: d1.id }))
  state = tripReducer(state, assignStop({ placeId: 'p2', dayId: d1.id }))
  state = tripReducer(state, assignStop({ placeId: 'p3', dayId: d2.id }))
  state = tripReducer(state, assignStop({ placeId: 'p4', dayId: d2.id }))
  return state
}

describe('selectDayRouteRequests', () => {
  it('routes [lodging, …stops, lodging] for a day with a hotel', () => {
    const state = twoDayTrip()
    const [first] = selectDayRouteRequests(asRoot(state))
    expect(first.coords).toEqual([[2.33, 48.87], PLACES[0].coord, PLACES[1].coord, [2.33, 48.87]])
    expect(first.mode).toBe('walking')
  })

  it('omits the loop for a day with no lodging', () => {
    let state = tripReducer(undefined, tripHydrated({ summaries: [], active: baseTrip() }))
    state = tripReducer(state, setTripDates({ startDate: '2026-05-01', endDate: '2026-05-01' }))
    const dayId = state.active!.days[0].id
    state = tripReducer(state, assignStop({ placeId: 'p1', dayId }))
    state = tripReducer(state, assignStop({ placeId: 'p2', dayId }))
    const [req] = selectDayRouteRequests(asRoot(state))
    expect(req.coords).toEqual([PLACES[0].coord, PLACES[1].coord])
  })

  it('skips days with fewer than two coordinates', () => {
    let state = tripReducer(undefined, tripHydrated({ summaries: [], active: baseTrip() }))
    state = tripReducer(state, setTripDates({ startDate: '2026-05-01', endDate: '2026-05-02' }))
    expect(selectDayRouteRequests(asRoot(state))).toEqual([])

    const dayId = state.active!.days[0].id
    state = tripReducer(state, assignStop({ placeId: 'p1', dayId }))
    // One stop, no hotel — still nothing to route.
    expect(selectDayRouteRequests(asRoot(state))).toEqual([])
  })

  it('reordering one day leaves every other day\'s hash untouched', () => {
    const before = twoDayTrip()
    const [d1, d2] = before.active!.days
    const after = tripReducer(before, moveStop({ dayId: d2.id, placeId: 'p4', delta: -1 }))

    const h0 = hashes(before)
    const h1 = hashes(after)
    expect(h1[d1.id]).toBe(h0[d1.id])
    expect(h1[d2.id]).not.toBe(h0[d2.id])
  })

  it('an unrelated edit (renaming a place) changes no hash at all', () => {
    const before = twoDayTrip()
    const renamed = {
      ...before,
      active: { ...before.active!, places: PLACES.map(p => ({ ...p, name: `${p.name}!` })) },
    }
    expect(hashes(renamed)).toEqual(hashes(before))
  })

  it('changing the trip mode changes every day\'s hash', () => {
    const before = twoDayTrip()
    const after = tripReducer(before, setTravelMode('driving'))
    const h0 = hashes(before)
    const h1 = hashes(after)
    expect(Object.keys(h1)).toEqual(Object.keys(h0))
    for (const dayId of Object.keys(h0)) expect(h1[dayId]).not.toBe(h0[dayId])
    expect(selectDayRouteRequests(asRoot(after)).every(r => r.mode === 'driving')).toBe(true)
  })

  it('a per-day mode override changes only that day', () => {
    const before = twoDayTrip()
    const [d1, d2] = before.active!.days
    const after = tripReducer(before, setDayTravelMode({ dayId: d2.id, mode: 'driving' }))
    const h0 = hashes(before)
    const h1 = hashes(after)
    expect(h1[d1.id]).toBe(h0[d1.id])
    expect(h1[d2.id]).not.toBe(h0[d2.id])
    const byId = new Map(selectDayRouteRequests(asRoot(after)).map(r => [r.dayId, r.mode]))
    expect(byId.get(d1.id)).toBe('walking')
    expect(byId.get(d2.id)).toBe('driving')
  })

  it('clearing a day override returns it to the trip default hash', () => {
    const before = twoDayTrip()
    const d2 = before.active!.days[1]
    const overridden = tripReducer(before, setDayTravelMode({ dayId: d2.id, mode: 'driving' }))
    const cleared = tripReducer(overridden, setDayTravelMode({ dayId: d2.id, mode: null }))
    expect(hashes(cleared)[d2.id]).toBe(hashes(before)[d2.id])
  })
})
