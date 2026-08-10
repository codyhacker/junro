import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { useSuggest } from '../search/useSuggest'
import { retrieve, guessCategory, type RetrievedPlace } from '../search/searchBoxApi'
import { addPlace } from './tripSlice'
import { flyTo } from '../map/cameraSlice'
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

  async function pick(mapboxId: string) {
    const place = await retrieve(mapboxId, sessionToken())
    resetSession()
    clear()
    if (!place) return
    setPending(place)
    setCategory(guessCategory(place.categories))
    dispatch(flyTo({ center: place.coord, zoom: 14.5, duration: 1400 }))
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
          <div className="add-place-confirm-name">{pending.name}</div>
          {pending.address && <div className="add-place-confirm-addr">{pending.address}</div>}

          <div className="add-place-cats">
            {(Object.keys(CATEGORY_META) as PlaceCategory[]).map(cat => (
              <button
                key={cat}
                className={`add-place-cat${cat === category ? ' active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
              </button>
            ))}
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
            <button className="junro-secondary" onClick={() => setPending(null)}>Cancel</button>
            <button className="junro-primary" onClick={save}>Save place</button>
          </div>
        </div>
      )}
    </div>
  )
}
