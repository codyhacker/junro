import { useState } from 'react'
import { useAppDispatch } from '../../app/hooks'
import { useSuggest } from '../search/useSuggest'
import { retrieve } from '../search/searchBoxApi'
import { createTrip } from './tripSlice'
import { flyTo } from '../map/cameraSlice'

// A trip needs a name and a destination — nothing else (PROJECT_PLAN.md §2
// principle 5). Shared by TripGate (first run, no trip exists yet) and
// TripPicker ("+ New trip" while a different trip is already active) —
// createTrip's reducer unconditionally overwrites state.active with no guard
// on what was there before, so calling it from TripPicker is safe: the prior
// trip's row stays exactly where it was in local/remote storage, untouched.
export function NewTripForm({ onCreated }: { onCreated?: () => void }) {
  const dispatch = useAppDispatch()
  const [name, setName] = useState('')
  const [destQuery, setDestQuery] = useState('')
  const [picked, setPicked] = useState<{ mapboxId: string; label: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const { results, sessionToken, resetSession, clear } = useSuggest(picked ? '' : destQuery, {
    types: 'place',
  })

  async function create() {
    if (!picked || creating) return
    setCreating(true)
    try {
      const dest = await retrieve(picked.mapboxId, sessionToken())
      resetSession()
      if (!dest) return
      dispatch(
        createTrip({
          name: name.trim() || `${dest.name} trip`,
          destination: { name: dest.name, center: dest.coord, bbox: dest.bbox },
        }),
      )
      dispatch(flyTo({ center: dest.coord, zoom: 11.5, duration: 2500, essential: true }))
      onCreated?.()
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <input
        className="junro-input"
        placeholder="Trip name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="trip-gate-dest">
        <input
          className="junro-input"
          placeholder="Destination city…"
          value={picked ? picked.label : destQuery}
          onChange={(e) => {
            setPicked(null)
            setDestQuery(e.target.value)
          }}
          autoFocus
        />
        {!picked && results.length > 0 && (
          <ul className="junro-suggestions">
            {results.map((r) => (
              <li key={r.mapboxId}>
                <button
                  onClick={() => {
                    setPicked({ mapboxId: r.mapboxId, label: r.name })
                    clear()
                  }}
                >
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
    </>
  )
}
