import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { clearDayStops, resetTrip } from './tripSlice'
import { setSelectedPlace } from './tripInteractionSlice'
import { setActiveTab } from '../shell/uiSlice'
import { getTripStorage } from './storage'
import { TripActions } from '../viewer/TripActions'

// Minimal trip-level actions in the panel header, next to the title: share/
// export (a single icon opening the export+import menu), and the reset ladder —
// replan the days, or start the whole trip over. Each is an icon with a tooltip;
// the reset actions confirm inline before doing anything.
type Pop = 'share' | 'replan' | 'reset'

export function TripHeaderActions() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector((s) => s.trip.active)
  const hasPlan = useAppSelector(
    (s) => s.trip.active?.days.some((d) => d.stopIds.length > 0) ?? false,
  )
  const [open, setOpen] = useState<Pop | null>(null)

  if (!trip) return null
  const toggle = (p: Pop) => setOpen((o) => (o === p ? null : p))

  function replan() {
    dispatch(clearDayStops())
    dispatch(setActiveTab('plan'))
    setOpen(null)
  }
  async function startOver() {
    const id = trip!.id
    dispatch(setSelectedPlace(null))
    dispatch(resetTrip())
    await getTripStorage().remove(id)
    setOpen(null)
  }

  return (
    <div className="trip-head-actions">
      <button
        className={`trip-head-btn${open === 'share' ? ' active' : ''}`}
        title="Share & export"
        aria-label="Share and export"
        onClick={() => toggle('share')}
      >
        ↗
      </button>
      <button
        className={`trip-head-btn${open === 'replan' ? ' active' : ''}`}
        title="Replan days — clear the day plan"
        aria-label="Replan days"
        disabled={!hasPlan}
        onClick={() => toggle('replan')}
      >
        ↻
      </button>
      <button
        className={`trip-head-btn trip-head-btn-danger${open === 'reset' ? ' active' : ''}`}
        title="Start over — delete this trip"
        aria-label="Start over"
        onClick={() => toggle('reset')}
      >
        ⌫
      </button>

      {open && <div className="trip-head-scrim" onClick={() => setOpen(null)} />}

      {open === 'share' && (
        <div className="trip-head-pop">
          <TripActions />
        </div>
      )}
      {open === 'replan' && (
        <div className="trip-head-pop trip-head-confirm">
          <span>Clear all day assignments? Your places stay in Places.</span>
          <div className="trip-head-confirm-row">
            <button className="junro-secondary" onClick={() => setOpen(null)}>
              Cancel
            </button>
            <button className="junro-primary" onClick={replan}>
              Replan
            </button>
          </div>
        </div>
      )}
      {open === 'reset' && (
        <div className="trip-head-pop trip-head-confirm">
          <span>Delete “{trip.name}” and everything in it? This can’t be undone.</span>
          <div className="trip-head-confirm-row">
            <button className="junro-secondary" onClick={() => setOpen(null)}>
              Cancel
            </button>
            <button className="junro-primary trip-head-danger" onClick={() => void startOver()}>
              Delete trip
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
