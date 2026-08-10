import { describe, it, expect } from 'vitest'
import { LocalStorageTripStorage, migrateTrip, TRIP_SCHEMA_VERSION } from './storage'
import type { Trip } from '../../shared/types/trip'
import { DEFAULT_PREFS } from '../../shared/types/trip'

function memoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
}

function makeTrip(id: string, name: string, updatedAt: string): Trip {
  return {
    id,
    schemaVersion: TRIP_SCHEMA_VERSION,
    name,
    destination: { name: 'Paris', center: [2.35, 48.86] },
    lodgings: [],
    places: [],
    days: [],
    prefs: { ...DEFAULT_PREFS },
    createdAt: updatedAt,
    updatedAt,
  }
}

describe('LocalStorageTripStorage', () => {
  it('round-trips a trip through save/load', async () => {
    const s = new LocalStorageTripStorage(memoryStorage())
    const trip = makeTrip('a', 'Paris trip', '2026-08-09T00:00:00Z')
    await s.save(trip)
    expect(await s.load('a')).toEqual(trip)
  })

  it('list() returns summaries, most recently saved first', async () => {
    const s = new LocalStorageTripStorage(memoryStorage())
    await s.save(makeTrip('a', 'First', '2026-08-01T00:00:00Z'))
    await s.save(makeTrip('b', 'Second', '2026-08-02T00:00:00Z'))
    const list = await s.list()
    expect(list.map(t => t.id)).toEqual(['b', 'a'])
    expect(list[0]).toEqual({
      id: 'b', name: 'Second', destinationName: 'Paris', updatedAt: '2026-08-02T00:00:00Z',
    })
  })

  it('re-saving a trip moves it to the front without duplicating', async () => {
    const s = new LocalStorageTripStorage(memoryStorage())
    await s.save(makeTrip('a', 'A', '2026-08-01T00:00:00Z'))
    await s.save(makeTrip('b', 'B', '2026-08-02T00:00:00Z'))
    await s.save(makeTrip('a', 'A', '2026-08-03T00:00:00Z'))
    expect((await s.list()).map(t => t.id)).toEqual(['a', 'b'])
  })

  it('remove() deletes the doc and its index entry', async () => {
    const s = new LocalStorageTripStorage(memoryStorage())
    await s.save(makeTrip('a', 'A', '2026-08-01T00:00:00Z'))
    await s.remove('a')
    expect(await s.load('a')).toBeNull()
    expect(await s.list()).toEqual([])
  })

  it('survives corrupted stored JSON', async () => {
    const mem = memoryStorage()
    mem.setItem('junro:trips:index', '{not json')
    mem.setItem('junro:trip:a', '{also not json')
    const s = new LocalStorageTripStorage(mem)
    expect(await s.list()).toEqual([])
    expect(await s.load('a')).toBeNull()
  })
})

describe('migrateTrip', () => {
  it('passes a current-version doc through unchanged', () => {
    const trip = makeTrip('a', 'A', '2026-08-01T00:00:00Z')
    expect(migrateTrip(trip)).toEqual(trip)
  })

  it('refuses docs written by a newer schema', () => {
    const trip = { ...makeTrip('a', 'A', '2026-08-01T00:00:00Z'), schemaVersion: TRIP_SCHEMA_VERSION + 1 }
    expect(migrateTrip(trip)).toBeNull()
  })

  it('refuses non-object input', () => {
    expect(migrateTrip(null)).toBeNull()
    expect(migrateTrip('x')).toBeNull()
  })
})
