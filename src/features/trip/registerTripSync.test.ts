import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { configureStore, combineReducers } from '@reduxjs/toolkit'
import { listenerMiddleware } from '../../app/listenerMiddleware'
import tripReducer, { tripHydrated, tripLoaded } from './tripSlice'
import syncReducer, { tripAdopted } from './syncSlice'
import authReducer, { authStateChanged } from '../auth/authSlice'
import { registerTripSyncPush } from './registerTripSync'
import { saveWithConflictCheck, type SyncResult } from './remoteStorage'
import { TRIP_SCHEMA_VERSION } from './storage'
import { DEFAULT_PREFS, type Trip } from '../../shared/types/trip'

vi.mock('./remoteStorage', () => ({
  saveWithConflictCheck: vi.fn(),
}))

function buildStore() {
  const reducer = combineReducers({
    trip: tripReducer,
    sync: syncReducer,
    auth: authReducer,
  })
  return configureStore({
    reducer,
    middleware: (getDefault) => getDefault().prepend(listenerMiddleware.middleware),
  })
}

const trip = (id: string, name: string): Trip => ({
  id,
  schemaVersion: TRIP_SCHEMA_VERSION,
  name,
  destination: { name: 'Paris', center: [2.35, 48.85] },
  lodgings: [],
  places: [],
  days: [],
  prefs: DEFAULT_PREFS,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
})

// Brings a fresh store to "signed in, trip t1 hydrated and already adopted at
// revision 1" — the common starting point every test below edits from.
function primedStore() {
  const store = buildStore()
  store.dispatch(tripHydrated({ summaries: [], active: trip('t1', 'Original') }))
  store.dispatch(authStateChanged({ user: { id: 'u1', email: 'a@b.com' } }))
  store.dispatch(tripAdopted({ tripId: 't1', revision: 1 }))
  return store
}

describe('registerTripSyncPush', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(saveWithConflictCheck).mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('pushes an edit even when nothing else is ever dispatched afterward', async () => {
    const store = primedStore()
    const unregister = registerTripSyncPush()
    try {
      vi.mocked(saveWithConflictCheck).mockResolvedValue({ ok: true, revision: 2 })

      store.dispatch(tripLoaded(trip('t1', 'Edited')))

      // The regression: a previous fix gated every push behind an
      // unconditional api.condition() wait, which only resolves on a
      // *subsequent* dispatch — with nothing else ever dispatched (the
      // ordinary "edit, then go idle" case), that left the push hanging
      // forever. Advancing well past the 500ms debounce with zero further
      // dispatches is exactly that case.
      await vi.advanceTimersByTimeAsync(600)

      expect(saveWithConflictCheck).toHaveBeenCalledTimes(1)
      expect(saveWithConflictCheck).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), 1)
      expect(store.getState().sync.byTripId.t1.status).toBe('idle')
      expect(store.getState().sync.byTripId.t1.remoteRevision).toBe(2)
    } finally {
      unregister()
    }
  })

  it('an edit that lands while a push is already in flight waits for it and reads the fresh revision', async () => {
    const store = primedStore()
    const unregister = registerTripSyncPush()
    try {
      let resolveFirstSave!: (result: SyncResult) => void
      const firstSave = new Promise<SyncResult>((resolve) => {
        resolveFirstSave = resolve
      })
      vi.mocked(saveWithConflictCheck).mockImplementationOnce(() => firstSave)

      // Edit 1: runs the debounce, then starts a push that hangs mid-flight
      // (the mock above doesn't resolve yet).
      store.dispatch(tripLoaded(trip('t1', 'Edit 1')))
      await vi.advanceTimersByTimeAsync(500)
      expect(saveWithConflictCheck).toHaveBeenCalledTimes(1)
      expect(store.getState().sync.byTripId.t1.status).toBe('pushing')

      // Edit 2 lands while edit 1's push is still in flight. cancelActiveListeners()
      // can't stop it (it's past the cancelable delay/condition stage, awaiting a
      // plain promise), so both must eventually resolve without either using a
      // stale revision.
      vi.mocked(saveWithConflictCheck).mockResolvedValueOnce({ ok: true, revision: 3 })
      store.dispatch(tripLoaded(trip('t1', 'Edit 2')))
      await vi.advanceTimersByTimeAsync(500)

      // Edit 2's instance must be waiting (via condition()), not racing ahead
      // with the stale remoteRevision=1 it would've read had it not waited for
      // edit 1's in-flight push to finish first.
      expect(saveWithConflictCheck).toHaveBeenCalledTimes(1)

      // Let edit 1's push resolve. That dispatch (syncPushSucceeded, revision 2)
      // is what edit 2's condition() wait is watching for.
      resolveFirstSave({ ok: true, revision: 2 })
      await vi.advanceTimersByTimeAsync(0)

      expect(saveWithConflictCheck).toHaveBeenCalledTimes(2)
      expect(saveWithConflictCheck).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 't1' }),
        2, // edit 1's resulting revision, not the stale 1 edit 2 started with
      )
      expect(store.getState().sync.byTripId.t1.status).toBe('idle')
      expect(store.getState().sync.byTripId.t1.remoteRevision).toBe(3)
    } finally {
      unregister()
    }
  })
})
