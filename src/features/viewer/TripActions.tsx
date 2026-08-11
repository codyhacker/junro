import { useRef, useState } from 'react'
import { useStore } from 'react-redux'
import { useAppSelector } from '../../app/hooks'
import type { AppStore } from '../../app/store'
import { downloadTripJson, downloadTripIcs, importTripJson } from './exportTrip'

// Rail footer: open the read-only views, export the trip (JSON to carry it
// between devices, .ics into a calendar), or import a JSON trip back.
export function TripActions() {
  const store = useStore() as AppStore
  const trip = useAppSelector(s => s.trip.active)
  const hasDays = useAppSelector(s => (s.trip.active?.days.length ?? 0) > 0)
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState(false)

  if (!trip) return null
  const base = import.meta.env.BASE_URL

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''   // allow re-importing the same file
    if (!file) return
    const ok = importTripJson(store, await file.text())
    setError(!ok)
  }

  return (
    <div className="trip-actions">
      <div className="trip-actions-title">Share &amp; export</div>
      <div className="trip-actions-row">
        {hasDays && <a className="trip-action" href={`${base}?view=itinerary`}>📋 Itinerary</a>}
        {hasDays && <a className="trip-action" href={`${base}?view=today`}>📱 Today</a>}
        {hasDays && <button className="trip-action" onClick={() => downloadTripIcs(trip)}>📅 .ics</button>}
        <button className="trip-action" onClick={() => downloadTripJson(trip)}>⬇ JSON</button>
        <button className="trip-action" onClick={() => fileRef.current?.click()}>⬆ Import</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      </div>
      {error && <div className="trip-actions-error">That file isn’t a Junro trip.</div>}
    </div>
  )
}
