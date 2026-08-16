import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { useConfirmAction } from './useConfirmAction'
import {
  listRemoteTrips,
  loadRemoteTrip,
  deleteRemoteTrip,
  type RemoteTripSummary,
} from './remoteStorage'
import { getTripStorage } from './storage'
import { tripLoaded } from './tripSlice'
import { tripDownloaded } from './syncSlice'
import { NewTripForm } from './NewTripForm'
import type { TripSummary } from '../../shared/types/trip'

const UPDATED_FMT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export interface PickerEntry {
  id: string
  name: string
  destinationName: string
  updatedAt: string
  isLocal: boolean
  isSynced: boolean
}

// Merges this device's local trips with this account's synced trips into one
// list, keyed by id. Splitting them would leave local-only trips invisible
// the moment you switch away from them: neither the local list nor the
// adoption prompt was ever reachable for anything but the currently-active
// trip. `updatedAt`/`name`/`destinationName` prefer the local copy when both
// exist — nothing edits a trip that isn't active, so local and remote should
// already agree for every row except possibly the active one, where local is
// the freshest by definition.
export function mergeEntries(local: TripSummary[], remote: RemoteTripSummary[]): PickerEntry[] {
  const byId = new Map<string, PickerEntry>()
  for (const t of local) {
    byId.set(t.id, { ...t, isLocal: true, isSynced: false })
  }
  for (const t of remote) {
    const existing = byId.get(t.id)
    if (existing) {
      existing.isSynced = true
    } else {
      byId.set(t.id, {
        id: t.id,
        name: t.name,
        destinationName: t.destinationName,
        updatedAt: t.updatedAt,
        isLocal: false,
        isSynced: true,
      })
    }
  }
  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

// "Your trips" — lists every trip you can reach (local, synced, or both) and
// loads one as the local active trip on pick. Triggered from AuthButton;
// renders inside .auth-button-wrap so it inherits that element's stacking
// context (needed to sit above TripGate when there's no local trip yet).
export function TripPicker({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch()
  const userId = useAppSelector((s) => s.auth.user?.id)
  const activeTripId = useAppSelector((s) => s.trip.active?.id)

  const [entries, setEntries] = useState<PickerEntry[] | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showNewTrip, setShowNewTrip] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void Promise.all([getTripStorage().list(), listRemoteTrips(userId)]).then(([local, remote]) => {
      if (!cancelled) setEntries(mergeEntries(local, remote))
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  async function handleOpen(entry: PickerEntry) {
    setPendingId(entry.id)
    setError(null)
    if (entry.isLocal) {
      const localTrip = await getTripStorage().load(entry.id)
      setPendingId(null)
      if (!localTrip) {
        setError('Could not load that trip.')
        return
      }
      dispatch(tripLoaded(localTrip))
      onClose()
      return
    }
    const remote = await loadRemoteTrip(entry.id)
    setPendingId(null)
    if (!remote) {
      setError('Could not load that trip.')
      return
    }
    dispatch(tripLoaded(remote.trip))
    dispatch(tripDownloaded({ tripId: entry.id, revision: remote.revision }))
    onClose()
  }

  async function handleDelete(entry: PickerEntry) {
    setPendingId(entry.id)
    setError(null)
    const ok = await deleteRemoteTrip(entry.id)
    setPendingId(null)
    if (!ok) {
      setError('Could not delete that trip.')
      return
    }
    setEntries((prev) =>
      prev
        ? entry.isLocal
          ? prev.map((e) => (e.id === entry.id ? { ...e, isSynced: false } : e))
          : prev.filter((e) => e.id !== entry.id)
        : prev,
    )
  }

  if (showNewTrip) {
    return (
      <div className="trip-picker-overlay" onClick={onClose}>
        <div className="trip-picker-card" onClick={(e) => e.stopPropagation()}>
          <h2 className="trip-picker-title">New trip</h2>
          <p className="trip-picker-status">
            Your current trip stays saved — find it here anytime.
          </p>
          <NewTripForm onCreated={onClose} />
          <button className="junro-secondary" onClick={() => setShowNewTrip(false)}>
            ← Back to your trips
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="trip-picker-overlay" onClick={onClose}>
      <div className="trip-picker-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="trip-picker-title">Your trips</h2>

        <button className="junro-primary" onClick={() => setShowNewTrip(true)}>
          + New trip
        </button>

        {entries === null && <p className="trip-picker-status">Loading…</p>}
        {entries !== null && entries.length === 0 && (
          <p className="trip-picker-status">No trips yet.</p>
        )}
        {error && <p className="auth-pop-status auth-pop-status-error">{error}</p>}

        {entries !== null && entries.length > 0 && (
          <ul className="trip-picker-list">
            {entries.map((entry) => (
              <TripPickerRow
                key={entry.id}
                entry={entry}
                isActive={entry.id === activeTripId}
                pending={pendingId === entry.id}
                onOpen={() => handleOpen(entry)}
                onDelete={entry.isSynced ? () => handleDelete(entry) : undefined}
              />
            ))}
          </ul>
        )}

        <button className="junro-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

function TripPickerRow({
  entry,
  isActive,
  pending,
  onOpen,
  onDelete,
}: {
  entry: PickerEntry
  isActive: boolean
  pending: boolean
  onOpen: () => void
  onDelete?: () => void
}) {
  const open = useConfirmAction(onOpen)
  const del = useConfirmAction(onDelete ?? (() => {}))
  return (
    <li className="trip-picker-row">
      <div className="trip-picker-row-info">
        <span className="trip-picker-row-name">{entry.name}</span>
        <span className="trip-picker-row-dest">
          {[
            entry.destinationName,
            !entry.isSynced && 'Local only',
            UPDATED_FMT.format(new Date(entry.updatedAt)),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      {isActive ? (
        <span className="trip-picker-row-current">Current</span>
      ) : (
        <div className="trip-picker-row-actions">
          <button className="junro-secondary" disabled={pending} onClick={open.trigger}>
            {pending ? '…' : open.confirming ? 'Switch?' : 'Open'}
          </button>
          {onDelete && (
            <button
              className="junro-secondary trip-picker-row-delete"
              disabled={pending}
              onClick={del.trigger}
            >
              {del.confirming ? 'Confirm?' : 'Delete'}
            </button>
          )}
        </div>
      )}
    </li>
  )
}
