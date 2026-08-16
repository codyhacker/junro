import { startAppListening } from '../../app/listenerMiddleware'
import { adoptRemoteTrip, saveWithConflictCheck } from './remoteStorage'
import { savePersistedSync } from './syncPersist'
import { tripLoaded } from './tripSlice'
import {
  tripAdoptRequested,
  tripAdopted,
  tripAdoptFailed,
  syncPushRequested,
  syncPushSucceeded,
  syncPushFailed,
  syncConflictDetected,
  syncConflictResolveRequested,
  syncConflictResolved,
} from './syncSlice'

// The sync layer's four listeners, one file — mirrors how persistence.ts
// already bundles hydrateTrips + registerTripPersistence. Deliberately NOT
// an extension of persistence.ts: that file has no test coverage today, and
// createListenerMiddleware gives each listener real isolation
// (cancelActiveListeners() only cancels *that* listener's own prior
// instances). registerTripSyncPush piggybacks the existing 400ms local-save
// rhythm in spirit only — same predicate shape, its own delay — with zero
// shared code between the files.

// Push the active trip to Supabase shortly after any local edit, once it's
// been adopted (has a known remote revision) and isn't already mid-conflict.
// 500ms, not local save's 400ms, so this listener typically wakes up reading
// the already-locally-saved state.
export function registerTripSyncPush(): () => void {
  return startAppListening({
    predicate: (_action, currentState, previousState) => {
      const active = currentState.trip.active
      if (active === null) return false
      if (active === previousState.trip.active) return false
      if (!previousState.trip.hydrated) return false
      if (currentState.auth.status !== 'signed-in') return false
      const entry = currentState.sync.byTripId[active.id]
      return entry != null && entry.remoteRevision != null && entry.status !== 'conflict'
    },
    effect: async (_action, api) => {
      api.cancelActiveListeners()
      await api.delay(500)
      const active = api.getState().trip.active
      if (!active) return
      const tripId = active.id

      // cancelActiveListeners() only cancels an instance still in a
      // cancelable await (delay/condition/take) — a prior instance already
      // past this point, mid saveWithConflictCheck(), keeps running and
      // will still dispatch. Racing ahead here with a possibly-stale
      // remoteRevision let two overlapping pushes both CAS against the same
      // base revision, silently losing whichever edit lost the race. Wait
      // for any in-flight push on this trip to finish and clear 'pushing'
      // before reading remoteRevision, so this instance always sees the
      // fresh value. (Once a push has actually started — syncPushRequested
      // dispatched below — it must run to completion and dispatch its real
      // result regardless of being "cancelled" afterward, or 'pushing'
      // would never clear and every waiter here would hang forever.)
      //
      // api.condition(predicate) only resolves on a *subsequently
      // dispatched* action matching predicate — it never checks the current
      // snapshot (it's take(predicate).then(Boolean) under the hood). Calling
      // it unconditionally would block this effect forever whenever nothing
      // else happens to get dispatched after this edit — the ordinary "edit,
      // then go idle" case — even though nothing is actually in flight to
      // wait for. So check current state directly first with a plain read,
      // and only fall into condition() when a push is genuinely running
      // right now. The read and the condition() call below are both
      // synchronous with no await between them, so nothing can flip status
      // to 'pushing' in the gap between "observed idle" and "started
      // waiting."
      if (api.getState().sync.byTripId[tripId]?.status === 'pushing') {
        await api.condition((_action, state) => state.sync.byTripId[tripId]?.status !== 'pushing')
      }

      const entry = api.getState().sync.byTripId[tripId]
      if (!entry || entry.remoteRevision == null || entry.status === 'conflict') return
      const remoteRevision = entry.remoteRevision
      api.dispatch(syncPushRequested({ tripId }))
      const result = await saveWithConflictCheck(active, remoteRevision)
      if ('conflict' in result) {
        api.dispatch(
          syncConflictDetected({
            tripId,
            serverTrip: result.serverTrip,
            serverRevision: result.serverRevision,
          }),
        )
      } else if (result.ok) {
        api.dispatch(syncPushSucceeded({ tripId, revision: result.revision }))
      } else {
        api.dispatch(syncPushFailed({ tripId, error: result.error }))
      }
    },
  })
}

// Adopt (first upload of) the active trip — fired once, by the local-trip
// "upload it?" prompt.
export function registerTripAdoption(): () => void {
  return startAppListening({
    actionCreator: tripAdoptRequested,
    effect: async (action, api) => {
      const { tripId } = action.payload
      const state = api.getState()
      const trip = state.trip.active
      const ownerId = state.auth.user?.id
      if (!trip || !ownerId) {
        api.dispatch(tripAdoptFailed({ tripId, error: 'No active trip or signed-in user' }))
        return
      }
      const result = await adoptRemoteTrip(trip, ownerId)
      if ('conflict' in result) {
        // adoptRemoteTrip is an INSERT; the conflict branch of SyncResult is
        // shared with saveWithConflictCheck and never actually produced
        // here — handled only so this switch is type-complete.
        api.dispatch(tripAdoptFailed({ tripId, error: 'Unexpected conflict during adopt' }))
      } else if (result.ok) {
        api.dispatch(tripAdopted({ tripId, revision: result.revision }))
      } else {
        api.dispatch(tripAdoptFailed({ tripId, error: result.error }))
      }
    },
  })
}

// Resolve a detected conflict. 'theirs' loads the server doc as the active
// trip — the untouched registerTripPersistence listener then re-saves it
// locally for free. 'mine' re-pushes using the server's current revision as
// the new CAS baseline (same-user-two-tabs races resolve correctly by
// construction: whichever tab's CAS lands first wins, the other gets a
// fresh, correct conflict).
export function registerSyncConflictResolution(): () => void {
  return startAppListening({
    actionCreator: syncConflictResolveRequested,
    effect: async (action, api) => {
      const { tripId, choice } = action.payload
      const entry = api.getState().sync.byTripId[tripId]
      if (!entry) return

      if (choice === 'theirs') {
        const { serverTrip, serverRevision } = entry
        if (!serverTrip || serverRevision == null) return
        api.dispatch(tripLoaded(serverTrip))
        api.dispatch(syncConflictResolved({ tripId, revision: serverRevision }))
        return
      }

      const active = api.getState().trip.active
      const serverRevision = entry.serverRevision
      if (!active || serverRevision == null) return
      const result = await saveWithConflictCheck(active, serverRevision)
      if ('conflict' in result) {
        api.dispatch(
          syncConflictDetected({
            tripId,
            serverTrip: result.serverTrip,
            serverRevision: result.serverRevision,
          }),
        )
      } else if (result.ok) {
        api.dispatch(syncConflictResolved({ tripId, revision: result.revision }))
      } else {
        // No dedicated "resolve failed" action — syncPushFailed flips status
        // to 'error' with the same {tripId, error} shape a stalled push
        // uses, which is the state the UI actually needs to react to.
        api.dispatch(syncPushFailed({ tripId, error: result.error }))
      }
    },
  })
}

// Persist byTripId (just the revisions — syncPersist.ts) whenever it changes.
export function registerSyncPersistence(): () => void {
  return startAppListening({
    predicate: (_action, currentState, previousState) =>
      currentState.sync.byTripId !== previousState.sync.byTripId,
    effect: (_action, api) => {
      savePersistedSync(api.getState().sync.byTripId)
    },
  })
}
