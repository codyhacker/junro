import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { clearDayStops, resetTrip } from './tripSlice'
import { setSelectedPlace } from './tripInteractionSlice'
import { setActiveTab } from '../shell/uiSlice'
import { getTripStorage } from './storage'

// Trip-tab data tools: the reset ladder, mildest first. "Replan days" clears
// the day plan (places stay) so you can suggest again; "Start over" deletes the
// whole trip and returns to the first-run gate. Both confirm inline before
// acting — no silent wipes.
export function DataTools() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector(s => s.trip.active)
  const hasPlan = useAppSelector(s => s.trip.active?.days.some(d => d.stopIds.length > 0) ?? false)
  const [confirm, setConfirm] = useState<null | 'replan' | 'reset'>(null)

  if (!trip) return null

  function replan() {
    dispatch(clearDayStops())
    dispatch(setActiveTab('plan'))
    setConfirm(null)
  }

  async function startOver() {
    const id = trip!.id
    dispatch(setSelectedPlace(null))
    dispatch(resetTrip())
    await getTripStorage().remove(id)
    setConfirm(null)
  }

  return (
    <div className="trip-settings-group">
      <span className="trip-settings-label">Data</span>

      <div className="data-tools">
        <button className="data-tool" disabled={!hasPlan} onClick={() => setConfirm('replan')}>
          <span className="data-tool-title">↻ Replan days</span>
          <span className="data-tool-sub">Clear the day plan and start planning again</span>
        </button>
        <button className="data-tool data-tool-danger" onClick={() => setConfirm('reset')}>
          <span className="data-tool-title">⌫ Start over</span>
          <span className="data-tool-sub">Delete this trip and pick a new destination</span>
        </button>
      </div>

      {confirm === 'replan' && (
        <div className="data-confirm">
          <span>Clear all day assignments? Your places stay in Places.</span>
          <div className="data-confirm-row">
            <button className="junro-secondary" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="junro-primary" onClick={replan}>Replan</button>
          </div>
        </div>
      )}

      {confirm === 'reset' && (
        <div className="data-confirm">
          <span>Delete “{trip.name}” and everything in it? This can’t be undone.</span>
          <div className="data-confirm-row">
            <button className="junro-secondary" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="junro-primary data-confirm-danger" onClick={() => void startOver()}>Delete trip</button>
          </div>
        </div>
      )}
    </div>
  )
}
