import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { syncConflictResolveRequested } from './syncSlice'

// Small transient banner (mirrors UndoBar's shape, not a modal) — appears only
// while the active trip's sync entry is mid-conflict. No diff/preview of what
// changed: PLATFORM_PLAN's local-first + safe-conflict-detection scope always
// asks a human to pick a side rather than auto-rebasing.
export function SyncConflictBanner() {
  const dispatch = useAppDispatch()
  const activeTripId = useAppSelector((s) => s.trip.active?.id)
  const entry = useAppSelector((s) => (activeTripId ? s.sync.byTripId[activeTripId] : undefined))

  if (!activeTripId || !entry || entry.status !== 'conflict') return null

  return (
    <div className="sync-conflict-banner">
      <span>This trip changed elsewhere.</span>
      <button
        className="sync-conflict-btn"
        onClick={() =>
          dispatch(syncConflictResolveRequested({ tripId: activeTripId, choice: 'theirs' }))
        }
      >
        Use theirs
      </button>
      <button
        className="sync-conflict-btn"
        onClick={() =>
          dispatch(syncConflictResolveRequested({ tripId: activeTripId, choice: 'mine' }))
        }
      >
        Keep mine
      </button>
    </div>
  )
}
