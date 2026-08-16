import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { configureStore, combineReducers } from '@reduxjs/toolkit'
import tripReducer, { tripHydrated } from './tripSlice'
import syncReducer, { tripAdopted, syncPushRequested } from './syncSlice'
import authReducer, { authStateChanged } from '../auth/authSlice'
import { bootTripSyncFocusPull } from './bootTripSyncFocusPull'
import { fetchRemoteRevision, loadRemoteTrip, saveWithConflictCheck } from './remoteStorage'
import type { AppStore } from '../../app/store'
import { TRIP_SCHEMA_VERSION } from './storage'
import { DEFAULT_PREFS, type Trip } from '../../shared/types/trip'

vi.mock('./remoteStorage', () => ({
  fetchRemoteRevision: vi.fn(),
  loadRemoteTrip: vi.fn(),
  saveWithConflictCheck: vi.fn(),
}))

// bootTripSyncFocusPull wires a real `window.addEventListener('focus', ...)`
// — there's no jsdom in this project's test setup, so stub just enough of
// `window` to register and fire that one listener directly, without pulling
// in a whole DOM environment for one function.
function stubWindowFocus() {
  const listeners: Array<() => void> = []
  vi.stubGlobal('window', {
    addEventListener: (_event: string, cb: () => void) => {
      listeners.push(cb)
    },
    removeEventListener: (_event: string, cb: () => void) => {
      const i = listeners.indexOf(cb)
      if (i >= 0) listeners.splice(i, 1)
    },
  })
  return { fireFocus: () => listeners.forEach((cb) => cb()) }
}

function buildStore() {
  const reducer = combineReducers({ trip: tripReducer, sync: syncReducer, auth: authReducer })
  return configureStore({ reducer })
}

const trip = (id: string): Trip => ({
  id,
  schemaVersion: TRIP_SCHEMA_VERSION,
  name: 'Original',
  destination: { name: 'Paris', center: [2.35, 48.85] },
  lodgings: [],
  places: [],
  days: [],
  prefs: DEFAULT_PREFS,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
})

function primedStore() {
  const store = buildStore()
  store.dispatch(tripHydrated({ summaries: [], active: trip('t1') }))
  store.dispatch(authStateChanged({ user: { id: 'u1', email: 'a@b.com' } }))
  store.dispatch(tripAdopted({ tripId: 't1', revision: 1 }))
  return store
}

// A real macrotask tick — guaranteed to run after every pending microtask
// (including however many .then() hops an `await` inside checkOnFocus
// desugars to), unlike guessing a fixed number of `await Promise.resolve()`.
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('bootTripSyncFocusPull', () => {
  beforeEach(() => {
    vi.mocked(fetchRemoteRevision).mockReset()
    vi.mocked(loadRemoteTrip).mockReset()
    vi.mocked(saveWithConflictCheck).mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not fabricate a conflict when a push starts while the revision check is in flight', async () => {
    const store = primedStore()
    const { fireFocus } = stubWindowFocus()
    const cleanup = bootTripSyncFocusPull(store as unknown as AppStore)
    try {
      let resolveFetch!: (value: number | null) => void
      vi.mocked(fetchRemoteRevision).mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
      )

      // Synchronously reaches and suspends at `await fetchRemoteRevision(...)`
      // — checkOnFocus's status/remoteRevision snapshot was taken before this
      // point, while status was still 'idle'.
      fireFocus()

      // While that fetch is still pending, an edit's push starts for real
      // (registerTripSyncPush, in production) and claims 'pushing'.
      store.dispatch(syncPushRequested({ tripId: 't1' }))

      // Now let the stale check's fetch resolve, claiming the server moved
      // ahead. A version that trusted its pre-await snapshot would treat this
      // as "idle and behind" and fabricate a conflict against the push that's
      // now actually running; the fix re-reads state after the await and
      // must see 'pushing', not 'idle', and bail instead.
      resolveFetch(5)
      await flush()

      expect(loadRemoteTrip).not.toHaveBeenCalled()
      expect(store.getState().sync.byTripId.t1.status).toBe('pushing')
    } finally {
      cleanup()
    }
  })

  it('does not fabricate a conflict when a push completes between the two follow-up reads', async () => {
    const store = primedStore()
    const { fireFocus } = stubWindowFocus()
    const cleanup = bootTripSyncFocusPull(store as unknown as AppStore)
    try {
      vi.mocked(fetchRemoteRevision).mockResolvedValue(5) // server looks ahead of local revision 1
      let resolveLoad!: (value: { trip: Trip; revision: number } | null) => void
      vi.mocked(loadRemoteTrip).mockReturnValue(
        new Promise((resolve) => {
          resolveLoad = resolve
        }),
      )

      fireFocus()
      // Let the cheap revision check resolve and the full-doc fetch start —
      // both real awaits, so a macrotask flush lets both happen in order.
      await flush()
      expect(loadRemoteTrip).toHaveBeenCalledTimes(1)

      // While the full-doc fetch is in flight, this tab's own push (started
      // and finished elsewhere, e.g. a retried 'error' push) lands and moves
      // the entry to a newer revision than what triggered this check.
      store.dispatch(tripAdopted({ tripId: 't1', revision: 5 }))

      resolveLoad({ trip: trip('t1'), revision: 5 })
      await flush()

      expect(store.getState().sync.byTripId.t1.status).toBe('idle')
    } finally {
      cleanup()
    }
  })

  it('still detects a genuine conflict when nothing races', async () => {
    const store = primedStore()
    const { fireFocus } = stubWindowFocus()
    const cleanup = bootTripSyncFocusPull(store as unknown as AppStore)
    try {
      const serverTrip = trip('t1')
      vi.mocked(fetchRemoteRevision).mockResolvedValue(5)
      vi.mocked(loadRemoteTrip).mockResolvedValue({ trip: serverTrip, revision: 5 })

      fireFocus()
      await flush()

      expect(store.getState().sync.byTripId.t1).toMatchObject({
        status: 'conflict',
        serverRevision: 5,
      })
    } finally {
      cleanup()
    }
  })
})
