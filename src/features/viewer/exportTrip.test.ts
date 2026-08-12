import { describe, it, expect } from 'vitest'
import { parseTripJson } from './exportTrip'
import { TRIP_SCHEMA_VERSION } from '../trip/storage'
import { DEFAULT_PREFS, type Trip } from '../../shared/types/trip'

const trip: Trip = {
  id: 'abc',
  schemaVersion: TRIP_SCHEMA_VERSION,
  name: 'Test',
  destination: { name: 'Paris', center: [2.35, 48.85] },
  lodgings: [],
  places: [],
  days: [],
  prefs: DEFAULT_PREFS,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

describe('parseTripJson', () => {
  it('round-trips a valid trip', () => {
    const parsed = parseTripJson(JSON.stringify(trip))
    expect(parsed?.id).toBe('abc')
    expect(parsed?.destination.name).toBe('Paris')
  })

  it('rejects a non-trip object (missing structure)', () => {
    expect(parseTripJson('{"not":"a trip"}')).toBeNull()
  })

  it('rejects malformed JSON', () => {
    expect(parseTripJson('{{{')).toBeNull()
  })
})
