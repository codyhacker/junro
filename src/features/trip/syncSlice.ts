import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Trip } from '../../shared/types/trip'
import { loadPersistedSync } from './syncPersist'

// This trip's relationship to its Supabase `trips` row — trip-domain state
// (not an auth concern), so it lives alongside the local TripStorage adapter
// rather than under features/auth. Keyed by trip id (even though only one
// trip is ever active) purely for correct cache invalidation: switching the
// active trip (JSON import, "Start over" + new trip) must never let stale
// sync metadata from the old trip CAS-update the new trip's row. "Adopted"
// is defined as remoteRevision != null, not "entry exists" — that resolves
// the chicken-and-egg case where an 'adopting'/'error' status needs to
// render before a real revision exists.
export interface SyncEntry {
  remoteRevision: number | null // null until first successful adopt/push
  status: 'idle' | 'adopting' | 'pushing' | 'conflict' | 'error'
  lastError?: string
  serverTrip?: Trip // set only while status === 'conflict'
  serverRevision?: number
}

interface SyncState {
  byTripId: Record<string, SyncEntry>
}

// The persisted shape is just {tripId: revision} (syncPersist.ts), not full
// SyncEntry objects, so seeding needs a small transform rather than
// terrainSlice.ts's direct {...defaults, ...loadPersisted()} spread.
function seedFromPersisted(): Record<string, SyncEntry> {
  const byTripId: Record<string, SyncEntry> = {}
  for (const [tripId, revision] of Object.entries(loadPersistedSync())) {
    byTripId[tripId] = { remoteRevision: revision, status: 'idle' }
  }
  return byTripId
}

const initialState: SyncState = {
  byTripId: seedFromPersisted(),
}

function entryFor(state: SyncState, tripId: string): SyncEntry {
  state.byTripId[tripId] ??= { remoteRevision: null, status: 'idle' }
  return state.byTripId[tripId]
}

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    tripAdoptRequested(state, action: PayloadAction<{ tripId: string }>) {
      const entry = entryFor(state, action.payload.tripId)
      entry.status = 'adopting'
      delete entry.serverTrip
      delete entry.serverRevision
    },

    tripAdopted(state, action: PayloadAction<{ tripId: string; revision: number }>) {
      const entry = entryFor(state, action.payload.tripId)
      entry.status = 'idle'
      entry.remoteRevision = action.payload.revision
      delete entry.lastError
      delete entry.serverTrip
      delete entry.serverRevision
    },

    tripAdoptFailed(state, action: PayloadAction<{ tripId: string; error: string }>) {
      const entry = entryFor(state, action.payload.tripId)
      entry.status = 'error'
      entry.lastError = action.payload.error
      delete entry.serverTrip
      delete entry.serverRevision
    },

    syncPushRequested(state, action: PayloadAction<{ tripId: string }>) {
      const entry = entryFor(state, action.payload.tripId)
      entry.status = 'pushing'
      delete entry.serverTrip
      delete entry.serverRevision
    },

    syncPushSucceeded(state, action: PayloadAction<{ tripId: string; revision: number }>) {
      const entry = entryFor(state, action.payload.tripId)
      entry.status = 'idle'
      entry.remoteRevision = action.payload.revision
      delete entry.lastError
      delete entry.serverTrip
      delete entry.serverRevision
    },

    // serverTrip/serverRevision are cleared here too, not just on
    // syncConflictResolved — without this, a "Keep mine" retry that fails
    // (e.g. a network error after the conflict's server state was already
    // captured) left the entry carrying a stale server doc/revision no
    // longer describing anything, guaranteeing the *next* CAS attempt would
    // miss again using data nobody asked it to keep.
    syncPushFailed(state, action: PayloadAction<{ tripId: string; error: string }>) {
      const entry = entryFor(state, action.payload.tripId)
      entry.status = 'error'
      entry.lastError = action.payload.error
      delete entry.serverTrip
      delete entry.serverRevision
    },

    syncConflictDetected(
      state,
      action: PayloadAction<{ tripId: string; serverTrip: Trip; serverRevision: number }>,
    ) {
      const entry = entryFor(state, action.payload.tripId)
      entry.status = 'conflict'
      entry.serverTrip = action.payload.serverTrip
      entry.serverRevision = action.payload.serverRevision
    },

    // Exists only as an action type for registerSyncConflictResolution
    // (registerTripSync.ts) to key off — no state change here. In
    // particular, `status` deliberately does NOT leave 'conflict' on this
    // action, only on syncConflictResolved once resolution actually
    // finishes, so the conflict banner doesn't disappear before that.
    syncConflictResolveRequested(
      _state,
      _action: PayloadAction<{ tripId: string; choice: 'mine' | 'theirs' }>,
    ) {},

    syncConflictResolved(state, action: PayloadAction<{ tripId: string; revision: number }>) {
      const entry = entryFor(state, action.payload.tripId)
      entry.status = 'idle'
      entry.remoteRevision = action.payload.revision
      delete entry.serverTrip
      delete entry.serverRevision
      delete entry.lastError
    },

    // Dispatched by TripPicker right after tripLoaded(), once a remote trip's
    // doc has been fetched and adopted locally as the active trip — same
    // resulting shape as tripAdopted (this trip's sync state is now
    // known-good at `revision`), kept as its own action rather than reusing
    // tripAdopted so the two directions (upload vs. download) read distinctly
    // at call sites.
    tripDownloaded(state, action: PayloadAction<{ tripId: string; revision: number }>) {
      const entry = entryFor(state, action.payload.tripId)
      entry.status = 'idle'
      entry.remoteRevision = action.payload.revision
      delete entry.lastError
      delete entry.serverTrip
      delete entry.serverRevision
    },
  },
})

export const {
  tripAdoptRequested,
  tripAdopted,
  tripAdoptFailed,
  syncPushRequested,
  syncPushSucceeded,
  syncPushFailed,
  syncConflictDetected,
  syncConflictResolveRequested,
  syncConflictResolved,
  tripDownloaded,
} = syncSlice.actions
export default syncSlice.reducer
