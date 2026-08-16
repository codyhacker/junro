import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveWithConflictCheck, listRemoteTrips, deleteRemoteTrip } from './remoteStorage'
import { getSupabaseClient } from '../auth/supabaseClient'
import { TRIP_SCHEMA_VERSION } from './storage'
import { DEFAULT_PREFS, type Trip } from '../../shared/types/trip'

vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: vi.fn(),
}))

// A minimal chainable fake for the subset of the Supabase query builder
// remoteStorage.ts uses. Each terminal call (.maybeSingle()/.single()/
// .order() — whichever ends a given function's chain) resolves to the next
// entry in `responses`, in call order — good enough to prove *how many*
// round trips a function makes and in what order, without reimplementing
// PostgREST's actual filtering. The chain itself is also thenable (real
// supabase-js query builders are too), for deleteRemoteTrip's shape: awaited
// directly after .eq(), with no .single()/.maybeSingle()/.order() call.
function fakeClient(responses: Array<{ data: unknown; error: unknown }>) {
  let call = 0
  const terminal = () => {
    const response = responses[call] ?? { data: null, error: null }
    call += 1
    return Promise.resolve(response)
  }
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    select: vi.fn(() => chain),
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(terminal),
    maybeSingle: vi.fn(terminal),
    single: vi.fn(terminal),
    then: (resolve: (v: { data: unknown; error: unknown }) => void) => terminal().then(resolve),
  }
  return chain
}

const trip: Trip = {
  id: 't1',
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

describe('saveWithConflictCheck', () => {
  beforeEach(() => {
    vi.mocked(getSupabaseClient).mockReset()
  })

  it('on a CAS miss, builds the conflict payload from exactly one follow-up request', async () => {
    const serverDoc = { ...trip, name: 'Server version' }
    const client = fakeClient([
      { data: null, error: null }, // the CAS update itself: zero rows (lost the race)
      { data: { doc: serverDoc, schema_version: TRIP_SCHEMA_VERSION, revision: 7 }, error: null }, // the one follow-up read
    ])
    vi.mocked(getSupabaseClient).mockReturnValue(client as never)

    const result = await saveWithConflictCheck(trip, 5)

    expect(result).toEqual({
      conflict: true,
      serverTrip: expect.objectContaining({ id: 't1', name: 'Server version' }),
      serverRevision: 7,
    })
    // The old shape made a CAS-miss trigger two independent requests
    // (loadRemoteTrip + fetchRemoteRevision via Promise.all) whose results
    // could "tear" if a third write landed between them — a doc from one
    // writer paired with a revision from a later one. One request total
    // for the follow-up (two terminal calls overall: the update, then one
    // read) means there's nothing left to tear.
    expect(client.maybeSingle).toHaveBeenCalledTimes(2)
  })

  it('a successful CAS write never makes a follow-up request', async () => {
    const client = fakeClient([{ data: { revision: 6 }, error: null }])
    vi.mocked(getSupabaseClient).mockReturnValue(client as never)

    const result = await saveWithConflictCheck(trip, 5)

    expect(result).toEqual({ ok: true, revision: 6 })
    expect(client.maybeSingle).toHaveBeenCalledTimes(1)
  })

  it('excludes soft-deleted rows from the CAS update, so a stale push can never resurrect one', async () => {
    const client = fakeClient([{ data: { revision: 6 }, error: null }])
    vi.mocked(getSupabaseClient).mockReturnValue(client as never)

    await saveWithConflictCheck(trip, 5)

    expect(client.is).toHaveBeenCalledWith('deleted_at', null)
  })
})

describe('listRemoteTrips', () => {
  beforeEach(() => {
    vi.mocked(getSupabaseClient).mockReset()
  })

  it('maps rows to summaries without pulling migrateTrip/validation into a display list', async () => {
    const client = fakeClient([
      {
        data: [
          {
            id: 't1',
            doc: { name: 'Paris trip', destination: { name: 'Paris' } },
            updated_at: '2026-08-15T10:00:00Z',
            revision: 3,
          },
          { id: 't2', doc: {}, updated_at: '2026-08-14T10:00:00Z', revision: 1 }, // malformed/empty doc
        ],
        error: null,
      },
    ])
    vi.mocked(getSupabaseClient).mockReturnValue(client as never)

    const result = await listRemoteTrips('user-1')

    expect(result).toEqual([
      {
        id: 't1',
        name: 'Paris trip',
        destinationName: 'Paris',
        updatedAt: '2026-08-15T10:00:00Z',
        revision: 3,
      },
      {
        id: 't2',
        name: 'Untitled trip',
        destinationName: '',
        updatedAt: '2026-08-14T10:00:00Z',
        revision: 1,
      },
    ])
    expect(client.eq).toHaveBeenCalledWith('owner_id', 'user-1')
  })

  it('returns an empty list on error rather than throwing', async () => {
    const client = fakeClient([{ data: null, error: { message: 'boom' } }])
    vi.mocked(getSupabaseClient).mockReturnValue(client as never)

    expect(await listRemoteTrips('user-1')).toEqual([])
  })

  it('returns an empty list when Supabase is not configured', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(null)

    expect(await listRemoteTrips('user-1')).toEqual([])
  })
})

describe('deleteRemoteTrip', () => {
  beforeEach(() => {
    vi.mocked(getSupabaseClient).mockReset()
  })

  it('soft-deletes by setting deleted_at, not a hard delete', async () => {
    const client = fakeClient([{ data: null, error: null }])
    vi.mocked(getSupabaseClient).mockReturnValue(client as never)

    const result = await deleteRemoteTrip('t1')

    expect(result).toBe(true)
    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    )
    expect(client.eq).toHaveBeenCalledWith('id', 't1')
  })

  it('returns false on error', async () => {
    const client = fakeClient([{ data: null, error: { message: 'boom' } }])
    vi.mocked(getSupabaseClient).mockReturnValue(client as never)

    expect(await deleteRemoteTrip('t1')).toBe(false)
  })

  it('returns false when Supabase is not configured', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(null)

    expect(await deleteRemoteTrip('t1')).toBe(false)
  })
})
