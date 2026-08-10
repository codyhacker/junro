import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { useSuggest } from '../search/useSuggest'
import { retrieve } from '../search/searchBoxApi'
import { createTrip } from './tripSlice'
import { flyTo } from '../map/cameraSlice'

// First-run card: a trip needs a name and a destination — nothing else
// (PROJECT_PLAN.md §2 principle 5). Dates, hotels, days all come later.
export function TripGate() {
  const dispatch = useAppDispatch()
  const hydrated = useAppSelector(s => s.trip.hydrated)
  const active = useAppSelector(s => s.trip.active)

  const [name, setName] = useState('')
  const [destQuery, setDestQuery] = useState('')
  const [picked, setPicked] = useState<{ mapboxId: string; label: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const { results, sessionToken, resetSession, clear } = useSuggest(
    picked ? '' : destQuery,
    { types: 'place' },
  )

  if (!hydrated || active) return null

  async function create() {
    if (!picked || creating) return
    setCreating(true)
    try {
      const dest = await retrieve(picked.mapboxId, sessionToken())
      resetSession()
      if (!dest) return
      dispatch(createTrip({
        name: name.trim() || `${dest.name} trip`,
        destination: { name: dest.name, center: dest.coord, bbox: dest.bbox },
      }))
      dispatch(flyTo({ center: dest.coord, zoom: 11.5, duration: 2500, essential: true }))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="trip-gate">
      <div className="trip-gate-card">
        <div className="trip-gate-mark">↱</div>
        <h1 className="trip-gate-title">Junro</h1>
        <p className="trip-gate-sub">Where are you headed?</p>

        <input
          className="junro-input"
          placeholder="Trip name (optional)"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <div className="trip-gate-dest">
          <input
            className="junro-input"
            placeholder="Destination city…"
            value={picked ? picked.label : destQuery}
            onChange={e => { setPicked(null); setDestQuery(e.target.value) }}
            autoFocus
          />
          {!picked && results.length > 0 && (
            <ul className="junro-suggestions">
              {results.map(r => (
                <li key={r.mapboxId}>
                  <button onClick={() => {
                    setPicked({ mapboxId: r.mapboxId, label: r.name })
                    clear()
                  }}>
                    <span className="junro-suggestion-name">{r.name}</span>
                    <span className="junro-suggestion-sub">{r.placeFormatted}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button className="junro-primary" disabled={!picked || creating} onClick={create}>
          {creating ? 'Setting off…' : 'Start planning →'}
        </button>
      </div>
    </div>
  )
}
