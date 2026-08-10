import { describe, it, expect } from 'vitest'
import { enumerateDates, resolveLodgingId, materializeDays } from './days'
import tripReducer, { tripHydrated, setTripDates, addLodging, removeLodging, assignStop, moveStop } from './tripSlice'
import type { Day, Lodging, Trip } from '../../shared/types/trip'
import { DEFAULT_PREFS } from '../../shared/types/trip'
import { TRIP_SCHEMA_VERSION } from './storage'

const HOTEL_A: Lodging = {
  id: 'lodge-a', name: 'Hôtel A', coord: [2.35, 48.86], checkIn: '2026-05-01', checkOut: '2026-05-03',
}
const HOTEL_B: Lodging = {
  id: 'lodge-b', name: 'Hôtel B', coord: [2.30, 48.85], checkIn: '2026-05-03', checkOut: '2026-05-06',
}

function day(date: string, stopIds: string[] = [], lodgingId: string | null = null): Day {
  return { id: `day-${date}`, date, lodgingId, stopIds, locked: false }
}

describe('enumerateDates', () => {
  it('is inclusive of both ends', () => {
    expect(enumerateDates('2026-05-01', '2026-05-03'))
      .toEqual(['2026-05-01', '2026-05-02', '2026-05-03'])
  })

  it('returns a single day when start === end', () => {
    expect(enumerateDates('2026-05-01', '2026-05-01')).toEqual(['2026-05-01'])
  })

  it('crosses a month boundary', () => {
    expect(enumerateDates('2026-04-29', '2026-05-02'))
      .toEqual(['2026-04-29', '2026-04-30', '2026-05-01', '2026-05-02'])
  })

  it('crosses a DST boundary without dropping or duplicating a day', () => {
    // Europe/Paris springs forward on 2026-03-29 — UTC arithmetic must not care.
    expect(enumerateDates('2026-03-28', '2026-03-31'))
      .toEqual(['2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31'])
  })

  it('returns nothing when the range is inverted or unparseable', () => {
    expect(enumerateDates('2026-05-03', '2026-05-01')).toEqual([])
    expect(enumerateDates('nope', '2026-05-01')).toEqual([])
  })
})

describe('resolveLodgingId', () => {
  const lodgings = [HOTEL_A, HOTEL_B]

  it('resolves the hotel whose range covers the date', () => {
    expect(resolveLodgingId('2026-05-01', lodgings)).toBe('lodge-a')
    expect(resolveLodgingId('2026-05-04', lodgings)).toBe('lodge-b')
  })

  it('treats the range as [checkIn, checkOut) — checkout night belongs to the next hotel', () => {
    expect(resolveLodgingId('2026-05-02', lodgings)).toBe('lodge-a')
    expect(resolveLodgingId('2026-05-03', lodgings)).toBe('lodge-b')
  })

  it('returns null outside every range', () => {
    expect(resolveLodgingId('2026-04-30', lodgings)).toBeNull()
    expect(resolveLodgingId('2026-05-06', lodgings)).toBeNull()
    expect(resolveLodgingId('2026-05-01', [])).toBeNull()
  })
})

describe('materializeDays', () => {
  it('produces one day per date with lodging resolved', () => {
    const { days } = materializeDays([], '2026-05-01', '2026-05-04', [HOTEL_A, HOTEL_B])
    expect(days.map(d => d.date)).toEqual(['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04'])
    expect(days.map(d => d.lodgingId)).toEqual(['lodge-a', 'lodge-a', 'lodge-b', 'lodge-b'])
  })

  it('materializes nothing until both dates exist', () => {
    expect(materializeDays([], undefined, '2026-05-04', []).days).toEqual([])
    expect(materializeDays([], '2026-05-01', undefined, []).days).toEqual([])
  })

  it('reuses existing day objects by date, keeping their stops and id', () => {
    const existing = [day('2026-05-01', ['p1', 'p2'], 'lodge-a')]
    const { days } = materializeDays(existing, '2026-05-01', '2026-05-02', [HOTEL_A])
    expect(days[0]).toBe(existing[0])
    expect(days[0].stopIds).toEqual(['p1', 'p2'])
    expect(days[1].stopIds).toEqual([])
  })

  it('extends by appending — earlier days keep their stops', () => {
    const existing = [day('2026-05-01', ['p1']), day('2026-05-02', ['p2'])]
    const { days, orphanedStopIds } = materializeDays(existing, '2026-05-01', '2026-05-04', [])
    expect(days).toHaveLength(4)
    expect(days[0].stopIds).toEqual(['p1'])
    expect(days[1].stopIds).toEqual(['p2'])
    expect(orphanedStopIds).toEqual([])
  })

  it('shrinking orphans the stops of dropped days', () => {
    const existing = [day('2026-05-01', ['p1']), day('2026-05-02', ['p2', 'p3'])]
    const { days, orphanedStopIds } = materializeDays(existing, '2026-05-01', '2026-05-01', [])
    expect(days.map(d => d.date)).toEqual(['2026-05-01'])
    expect(orphanedStopIds).toEqual(['p2', 'p3'])
  })

  it('clearing the dates orphans every assigned stop', () => {
    const existing = [day('2026-05-01', ['p1']), day('2026-05-02', ['p2'])]
    const { days, orphanedStopIds } = materializeDays(existing, undefined, undefined, [])
    expect(days).toEqual([])
    expect(orphanedStopIds).toEqual(['p1', 'p2'])
  })

  it('shifting the range forward orphans only the dates that fell off', () => {
    const existing = [day('2026-05-01', ['p1']), day('2026-05-02', ['p2']), day('2026-05-03', ['p3'])]
    const { days, orphanedStopIds } = materializeDays(existing, '2026-05-02', '2026-05-04', [])
    expect(days.map(d => d.date)).toEqual(['2026-05-02', '2026-05-03', '2026-05-04'])
    expect(days[0].stopIds).toEqual(['p2'])
    expect(orphanedStopIds).toEqual(['p1'])
  })

  it('re-resolves lodging on an existing day without disturbing its stops', () => {
    const existing = [day('2026-05-03', ['p1'], 'lodge-a')]
    const { days } = materializeDays(existing, '2026-05-03', '2026-05-03', [HOTEL_A, HOTEL_B])
    expect(days[0].lodgingId).toBe('lodge-b')
    expect(days[0].stopIds).toEqual(['p1'])
    expect(days[0].id).toBe(existing[0].id)
  })
})

// ─── Reducer-level behaviour ────────────────────────────────────────────────

function tripWith(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    schemaVersion: TRIP_SCHEMA_VERSION,
    name: 'Paris',
    destination: { name: 'Paris', center: [2.35, 48.86] },
    lodgings: [],
    places: [],
    days: [],
    prefs: { ...DEFAULT_PREFS },
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

function stateWith(trip: Trip) {
  return tripReducer(undefined, tripHydrated({ summaries: [], active: trip }))
}

describe('tripSlice — days, lodging, assignment', () => {
  it('setTripDates materializes days and resolves lodging', () => {
    const state = stateWith(tripWith({ lodgings: [HOTEL_A, HOTEL_B] }))
    const next = tripReducer(state, setTripDates({ startDate: '2026-05-01', endDate: '2026-05-04' }))
    expect(next.active!.days.map(d => d.date))
      .toEqual(['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04'])
    expect(next.active!.days.map(d => d.lodgingId))
      .toEqual(['lodge-a', 'lodge-a', 'lodge-b', 'lodge-b'])
  })

  it('shrinking the range drops the stop assignment (back to the scrapbook)', () => {
    let state = stateWith(tripWith({
      places: [
        { id: 'p1', name: 'A', coord: [2.3, 48.8], category: 'cafe', dwellMin: 45, priority: 'nice', source: 'user' },
        { id: 'p2', name: 'B', coord: [2.4, 48.9], category: 'sight', dwellMin: 120, priority: 'nice', source: 'user' },
      ],
    }))
    state = tripReducer(state, setTripDates({ startDate: '2026-05-01', endDate: '2026-05-02' }))
    const [d1, d2] = state.active!.days
    state = tripReducer(state, assignStop({ placeId: 'p1', dayId: d1.id }))
    state = tripReducer(state, assignStop({ placeId: 'p2', dayId: d2.id }))
    expect(state.active!.days[1].stopIds).toEqual(['p2'])

    state = tripReducer(state, setTripDates({ startDate: '2026-05-01', endDate: '2026-05-01' }))
    expect(state.active!.days).toHaveLength(1)
    expect(state.active!.days[0].stopIds).toEqual(['p1'])
    // p2 is still a saved place — it just isn't on any day any more.
    expect(state.active!.places.map(p => p.id)).toEqual(['p1', 'p2'])
    expect(state.active!.days.flatMap(d => d.stopIds)).not.toContain('p2')
  })

  it('adding and removing a lodging re-resolves every day', () => {
    let state = stateWith(tripWith())
    state = tripReducer(state, setTripDates({ startDate: '2026-05-01', endDate: '2026-05-02' }))
    expect(state.active!.days.map(d => d.lodgingId)).toEqual([null, null])

    state = tripReducer(state, addLodging({
      name: 'Hôtel A', coord: [2.35, 48.86], checkIn: '2026-05-01', checkOut: '2026-05-03',
    }))
    const lodgingId = state.active!.lodgings[0].id
    expect(state.active!.days.map(d => d.lodgingId)).toEqual([lodgingId, lodgingId])

    state = tripReducer(state, removeLodging(lodgingId))
    expect(state.active!.days.map(d => d.lodgingId)).toEqual([null, null])
  })

  it('assignStop moves a stop between days rather than duplicating it', () => {
    let state = stateWith(tripWith())
    state = tripReducer(state, setTripDates({ startDate: '2026-05-01', endDate: '2026-05-02' }))
    const [d1, d2] = state.active!.days
    state = tripReducer(state, assignStop({ placeId: 'p1', dayId: d1.id }))
    state = tripReducer(state, assignStop({ placeId: 'p1', dayId: d2.id }))
    expect(state.active!.days[0].stopIds).toEqual([])
    expect(state.active!.days[1].stopIds).toEqual(['p1'])

    state = tripReducer(state, assignStop({ placeId: 'p1', dayId: null }))
    expect(state.active!.days.flatMap(d => d.stopIds)).toEqual([])
  })

  it('moveStop reorders within a day and refuses to run off either end', () => {
    let state = stateWith(tripWith())
    state = tripReducer(state, setTripDates({ startDate: '2026-05-01', endDate: '2026-05-01' }))
    const dayId = state.active!.days[0].id
    for (const placeId of ['p1', 'p2', 'p3']) {
      state = tripReducer(state, assignStop({ placeId, dayId }))
    }
    state = tripReducer(state, moveStop({ dayId, placeId: 'p3', delta: -1 }))
    expect(state.active!.days[0].stopIds).toEqual(['p1', 'p3', 'p2'])

    state = tripReducer(state, moveStop({ dayId, placeId: 'p1', delta: -1 }))
    expect(state.active!.days[0].stopIds).toEqual(['p1', 'p3', 'p2'])

    state = tripReducer(state, moveStop({ dayId, placeId: 'p2', delta: 1 }))
    expect(state.active!.days[0].stopIds).toEqual(['p1', 'p3', 'p2'])
  })
})
