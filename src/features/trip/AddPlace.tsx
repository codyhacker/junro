import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { useSuggest } from '../search/useSuggest'
import { retrieve, guessCategory, type RetrievedPlace } from '../search/searchBoxApi'
import { addPlace } from './tripSlice'
import { fitBounds } from '../map/cameraSlice'
import type { PlaceCategory } from '../../shared/types/trip'
import { CATEGORY_META } from './categoryMeta'

// Search dock (top-left): find a place → confirm card with category +
// the "why did I save this?" note → save to the scrapbook.
export function AddPlace() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector(s => s.trip.active)

  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<RetrievedPlace | null>(null)
  const [category, setCategory] = useState<PlaceCategory>('other')
  const [note, setNote] = useState('')
  const { results, sessionToken, resetSession, clear } = useSuggest(
    pending ? '' : query,
    { proximity: trip?.destination.center, types: 'poi,address' },
  )

  if (!trip) return null

  // Keep the whole collection in view while adding, instead of yanking to each
  // result. Frames every saved place (plus `extra`, the candidate being picked,
  // so its spot is on screen before it's a pin). Padding leaves room for the
  // planning panel — mirrors the day-framing in TripLayerController.focusDay.
  function frame(extra?: [number, number]) {
    if (!trip) return
    const coords = trip.places.map(p => p.coord)
    if (extra) coords.push(extra)
    if (coords.length === 0) return
    const lngs = coords.map(c => c[0])
    const lats = coords.map(c => c[1])
    const wide = window.innerWidth > 640
    dispatch(fitBounds({
      bounds: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      padding: wide ? { top: 70, right: 70, bottom: 70, left: 400 } : { top: 90, right: 40, bottom: 360, left: 40 },
      maxZoom: 15,
      duration: 900,
    }))
  }

  async function pick(mapboxId: string) {
    const place = await retrieve(mapboxId, sessionToken())
    resetSession()
    clear()
    if (!place) return
    setPending(place)
    setCategory(guessCategory(place.categories))
    frame(place.coord)
  }

  function save() {
    if (!pending) return
    dispatch(addPlace({
      name: pending.name,
      coord: pending.coord,
      category,
      address: pending.address,
      notes: note.trim() || undefined,
    }))
    frame(pending.coord)   // trip.places is pre-add here, so include the new coord
    setPending(null)
    setNote('')
    setQuery('')
  }

  return (
    <div className="add-place">
      {!pending && (
        <>
          <input
            className="junro-input add-place-input"
            placeholder={`Search places in ${trip.destination.name}…`}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {results.length > 0 && (
            <ul className="junro-suggestions">
              {results.map(r => (
                <li key={r.mapboxId}>
                  <button onClick={() => void pick(r.mapboxId)}>
                    <span className="junro-suggestion-name">{r.name}</span>
                    <span className="junro-suggestion-sub">{r.placeFormatted}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {pending && (
        <div className="add-place-confirm">
          <div className="add-place-confirm-head">
            <div className="add-place-confirm-titles">
              <div className="add-place-confirm-name">{pending.name}</div>
              {pending.address && <div className="add-place-confirm-addr">{pending.address}</div>}
            </div>
            <select
              className="junro-input add-place-cat-select"
              aria-label="Category"
              value={category}
              onChange={e => setCategory(e.target.value as PlaceCategory)}
            >
              {(Object.keys(CATEGORY_META) as PlaceCategory[]).map(cat => (
                <option key={cat} value={cat}>{CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}</option>
              ))}
            </select>
          </div>

          <input
            className="junro-input"
            placeholder="Why did you save this?"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save() }}
            autoFocus
          />

          <div className="add-place-actions">
            <button className="junro-secondary" onClick={() => { setPending(null); frame() }}>Cancel</button>
            <button className="junro-primary" onClick={save}>Save place</button>
          </div>
        </div>
      )}
    </div>
  )
}
