import type { AppStore } from '../../app/store'
import { loadRemoteTrip, fetchRemoteRevision, saveWithConflictCheck } from './remoteStorage'
import {
  syncPushRequested,
  syncPushSucceeded,
  syncPushFailed,
  syncConflictDetected,
} from './syncSlice'

// Window-focus sync check. Not a listener registration: there's no
// before/after Redux state to diff for "the window regained focus", so the
// listener middleware's core value-add (a predicate over a state transition)
// doesn't apply — a direct window.addEventListener mirrors bootAuthSession's
// shape instead (a boot function returning a cleanup), called once from
// main.tsx.
//
// Two jobs on focus: retry a stalled 'error' push (nothing else ever retries
// one — the push listener in registerTripSync.ts only fires on a *new*
// edit), and detect whether the server moved ahead while this tab was
// backgrounded.
//
// Known simplification: this can't cheaply tell "server moved ahead and I
// have nothing at risk locally" from "and I do" (would need tracking a
// last-synced-doc hash, which nothing does) — it always routes through the
// conflict banner. Safe (never silently overwrites), occasionally
// over-cautious.
export function bootTripSyncFocusPull(store: AppStore): () => void {
  const onFocus = () => {
    void checkOnFocus(store)
  }
  window.addEventListener('focus', onFocus)
  return () => window.removeEventListener('focus', onFocus)
}

async function checkOnFocus(store: AppStore): Promise<void> {
  const state = store.getState()
  if (state.auth.status !== 'signed-in') return
  const active = state.trip.active
  if (!active) return
  const tripId = active.id
  const entry = state.sync.byTripId[tripId]
  if (!entry || entry.remoteRevision == null) return
  const remoteRevision = entry.remoteRevision

  if (entry.status === 'error') {
    store.dispatch(syncPushRequested({ tripId }))
    const result = await saveWithConflictCheck(active, remoteRevision)
    if ('conflict' in result) {
      store.dispatch(
        syncConflictDetected({
          tripId,
          serverTrip: result.serverTrip,
          serverRevision: result.serverRevision,
        }),
      )
    } else if (result.ok) {
      store.dispatch(syncPushSucceeded({ tripId, revision: result.revision }))
    } else {
      store.dispatch(syncPushFailed({ tripId, error: result.error }))
    }
    return
  }

  // Don't run a fresh check on top of an in-flight push, an unresolved
  // conflict, or a first-time adopt. Without this guard: tab away right
  // after an edit, back within the push's round-trip, and this could see
  // the row's revision after the in-flight push's UPDATE landed but before
  // that push's own syncPushSucceeded dispatched — fabricating a "conflict"
  // against the tab's own still-in-flight write. A positive check for
  // 'idle' (not just excluding the two known-bad statuses by name) so
  // nothing new added to the status union silently becomes unsafe here.
  if (entry.status !== 'idle') return

  const latestRevision = await fetchRemoteRevision(tripId)
  // Re-read state: the line above is an await, and anything (this tab's own
  // edit-triggered push, a second focus event) could have run and changed
  // status or remoteRevision while it was in flight. Trusting the snapshot
  // captured before the await is exactly the staleness bug the 'idle' guard
  // above exists to prevent — it just needs re-checking after every await,
  // not only once up front.
  const freshEntry = store.getState().sync.byTripId[tripId]
  if (!freshEntry || freshEntry.status !== 'idle' || freshEntry.remoteRevision == null) return
  if (latestRevision == null || latestRevision <= freshEntry.remoteRevision) return

  const remote = await loadRemoteTrip(tripId)
  if (!remote) return
  // Re-read again after the second await, for the same reason — and gate on
  // remote.revision (paired atomically with remote.trip by loadRemoteTrip's
  // single query), not latestRevision from the cheap check above, since
  // those two requests aren't atomic with each other.
  const freshEntry2 = store.getState().sync.byTripId[tripId]
  if (!freshEntry2 || freshEntry2.status !== 'idle' || freshEntry2.remoteRevision == null) return
  if (remote.revision <= freshEntry2.remoteRevision) return
  store.dispatch(
    syncConflictDetected({ tripId, serverTrip: remote.trip, serverRevision: remote.revision }),
  )
}
