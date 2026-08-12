import { describe, it, expect } from 'vitest'
import { computeStopDrop } from './dndStops'
import type { Day } from '../../shared/types/trip'

const day = (id: string, stopIds: string[], extra: Partial<Day> = {}): Day => ({
  id, date: '2026-10-05', stopIds, ...extra,
} as Day)

describe('computeStopDrop', () => {
  const days = () => [day('d1', ['a', 'b', 'c']), day('d2', ['x', 'y'])]

  it('reorders within a day: drop c before a', () => {
    expect(computeStopDrop(days(), 'c', { kind: 'stop', placeId: 'a' }))
      .toEqual({ dayId: 'd1', placeIds: ['c', 'a', 'b'] })
  })

  it('reorders within a day: drop a before c', () => {
    expect(computeStopDrop(days(), 'a', { kind: 'stop', placeId: 'c' }))
      .toEqual({ dayId: 'd1', placeIds: ['b', 'a', 'c'] })
  })

  it('moves between days: drop a before y in d2', () => {
    expect(computeStopDrop(days(), 'a', { kind: 'stop', placeId: 'y' }))
      .toEqual({ dayId: 'd2', placeIds: ['x', 'a', 'y'] })
  })

  it('moves between days: drop onto the day appends', () => {
    expect(computeStopDrop(days(), 'a', { kind: 'day', dayId: 'd2' }))
      .toEqual({ dayId: 'd2', placeIds: ['x', 'y', 'a'] })
  })

  it('is a no-op dropping a stop onto itself', () => {
    expect(computeStopDrop(days(), 'a', { kind: 'stop', placeId: 'a' })).toBeNull()
  })

  it('is a no-op dropping before the stop already after it (b before c in a,b,c)', () => {
    expect(computeStopDrop(days(), 'b', { kind: 'stop', placeId: 'c' })).toBeNull()
  })

  it('refuses a locked destination day', () => {
    const d = [day('d1', ['a', 'b']), day('d2', ['x'], { locked: true })]
    expect(computeStopDrop(d, 'a', { kind: 'day', dayId: 'd2' })).toBeNull()
  })

  it('returns null for an unknown dragged id', () => {
    expect(computeStopDrop(days(), 'zzz', { kind: 'day', dayId: 'd2' })).toBeNull()
  })
})
