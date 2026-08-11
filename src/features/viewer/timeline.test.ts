import { describe, it, expect } from 'vitest'
import { computeDayTimeline, formatClock } from './timeline'
import type { Day, Lodging, SavedPlace, TripPrefs } from '../../shared/types/trip'

const PREFS: TripPrefs = { travelMode: 'walking', dayStart: '09:00', dayEnd: '21:00', maxStopsPerDay: 6 }
const HOTEL: Lodging = { id: 'L', name: 'Hotel', coord: [2.33, 48.85], checkIn: '2026-10-05', checkOut: '2026-10-12' }

function place(id: string, coord: [number, number], extra: Partial<SavedPlace> = {}): SavedPlace {
  return { id, name: id, coord, category: 'sight', dwellMin: 60, priority: 'nice', source: 'user', ...extra }
}

describe('computeDayTimeline', () => {
  it('accumulates travel + dwell from the day start', () => {
    const places = new Map([
      ['a', place('a', [2.335, 48.852], { dwellMin: 30 })],
      ['b', place('b', [2.34, 48.855], { dwellMin: 45 })],
    ])
    const day: Day = { id: 'd', date: '2026-10-05', lodgingId: 'L', stopIds: ['a', 'b'], locked: false }
    const t = computeDayTimeline(day, places, new Map([['L', HOTEL]]), PREFS)

    expect(t.stops).toHaveLength(2)
    // First stop arrives after the hotel→a walk; departs 30 min later.
    expect(t.stops[0].arrivalMin).toBeGreaterThanOrEqual(9 * 60)
    expect(t.stops[0].departureMin).toBe(t.stops[0].arrivalMin + 30)
    // Second stop arrives after leaving the first.
    expect(t.stops[1].arrivalMin).toBeGreaterThanOrEqual(t.stops[0].departureMin)
    // Day ends back at the hotel.
    expect(t.returnTravelMin).toBeGreaterThan(0)
    expect(t.endMin).toBeGreaterThanOrEqual(t.stops[1].departureMin)
  })

  it('pins a fixedTime reservation forward and flags it', () => {
    const places = new Map([['m', place('m', [2.36, 48.86], { fixedTime: '14:00', dwellMin: 90 })]])
    const day: Day = { id: 'd', date: '2026-10-05', lodgingId: 'L', stopIds: ['m'], locked: false }
    const t = computeDayTimeline(day, places, new Map([['L', HOTEL]]), PREFS)

    expect(t.stops[0].fixed).toBe(true)
    expect(t.stops[0].arrivalMin).toBe(14 * 60)          // snapped to the booking
    expect(t.stops[0].departureMin).toBe(14 * 60 + 90)
  })

  it('formats a clock label', () => {
    expect(formatClock(9 * 60 + 30)).toBe('9:30 AM')
    expect(formatClock(14 * 60)).toBe('2:00 PM')
    expect(formatClock(0)).toBe('12:00 AM')
  })
})
