import { describe, it, expect } from 'vitest'
import { mergeEntries } from './TripPicker'
import type { TripSummary } from '../../shared/types/trip'
import type { RemoteTripSummary } from './remoteStorage'

const local = (id: string, updatedAt: string): TripSummary => ({
  id,
  name: `${id} local`,
  destinationName: `${id} dest`,
  updatedAt,
})

const remote = (id: string, updatedAt: string, revision = 1): RemoteTripSummary => ({
  id,
  name: `${id} remote`,
  destinationName: `${id} dest`,
  updatedAt,
  revision,
})

describe('mergeEntries', () => {
  it('marks a trip that only exists locally as local-only', () => {
    const result = mergeEntries([local('a', '2026-08-15')], [])
    expect(result).toEqual([
      {
        id: 'a',
        name: 'a local',
        destinationName: 'a dest',
        updatedAt: '2026-08-15',
        isLocal: true,
        isSynced: false,
      },
    ])
  })

  it('marks a trip that only exists remotely as not local', () => {
    const result = mergeEntries([], [remote('b', '2026-08-14')])
    expect(result).toEqual([
      {
        id: 'b',
        name: 'b remote',
        destinationName: 'b dest',
        updatedAt: '2026-08-14',
        isLocal: false,
        isSynced: true,
      },
    ])
  })

  it('a trip present in both is local AND synced, preferring the local copy for display fields', () => {
    const result = mergeEntries(
      [local('c', '2026-08-15')],
      [{ ...remote('c', '2026-08-14'), name: 'stale remote name' }],
    )
    expect(result).toEqual([
      {
        id: 'c',
        name: 'c local',
        destinationName: 'c dest',
        updatedAt: '2026-08-15',
        isLocal: true,
        isSynced: true,
      },
    ])
  })

  it('sorts newest-updated first across the merged set', () => {
    const result = mergeEntries(
      [local('old', '2026-08-01'), local('newest', '2026-08-20')],
      [remote('middle', '2026-08-10')],
    )
    expect(result.map((e) => e.id)).toEqual(['newest', 'middle', 'old'])
  })
})
