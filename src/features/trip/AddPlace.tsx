import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { useSuggest } from '../search/useSuggest'
import { retrieve, guessCategory, type RetrievedPlace } from '../search/searchBoxApi'
import { addPlace } from './tripSlice'
import { setPendingPlace, setAddCandidate } from './tripInteractionSlice'
import { fitBounds } from '../map/cameraSlice'
import type { PlaceCategory } from '../../shared/types/trip'
import { CATEGORY_META } from './categoryMeta'

// Search dock (top-left): find a place → confirm card with category +
// the "why did I save this?" note → save to the scrapbook. A tap on a discovery
// dot (from the map) feeds the same confirm card via `addCandidate`.
export function AddPlace() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector(s => s.trip.active)
  const addCandidate = useAppSelector(s => s.tripInteraction.addCandidate)

  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<RetrievedPlace | null>(null)
  const [category, setCategory] = useState<PlaceCategory>('other')
  const [note, setNote] = useState('')
  // Discovery adds keep the map where it is (you already framed the spot you
  // tapped) — search picks re-center. This flag distinguishes the two.
  const [fromDiscovery, setFromDiscovery] = useState(false)
  const { results, sessionToken, resetSession, clear } = useSuggest(
    pending ? '' : query,
    { proximity: trip?.destination.center, types: 'poi,address' },
  )

  // Adopt a discovery-dot tap: open the confirm card prefilled, same as a
  // search pick — but do NOT move the camera. (`preview` is hoisted.)
  useEffect(() => {
    if (!addCandidate) return
    setPending({ name: addCandidate.name, coord: addCandidate.coord, address: addCandidate.address, categories: [] })
    setCategory(addCandidate.category)
    setNote('')
    setFromDiscovery(true)
    preview(addCandidate.coord, addCandidate.category)
    dispatch(setAddCandidate(null))
  }, [addCandidate]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!trip) return null

  // Frame the collection while adding, instead of yanking to each result. With
  // a `center` (the place being picked/saved) the box is centered on it and
  // grown until every saved place fits — so the new spot sits in the middle but
  // nothing drops out of view. Without one (cancel) it's a plain fit of all
  // places. Generous padding gives breathing room and clears the planning panel.
  function frame(center?: [number, number]) {
    if (!trip) return
    const others = trip.places.map(p => p.coord)
    let bounds: [[number, number], [number, number]]
    if (center) {
      const dLng = Math.max(0, ...others.map(c => Math.abs(c[0] - center[0])))
      const dLat = Math.max(0, ...others.map(c => Math.abs(c[1] - center[1])))
      bounds = [[center[0] - dLng, center[1] - dLat], [center[0] + dLng, center[1] + dLat]]
    } else {
      if (others.length === 0) return
      const lngs = others.map(c => c[0])
      const lats = others.map(c => c[1])
      bounds = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]
    }
    const wide = window.innerWidth > 640
    dispatch(fitBounds({
      bounds,
      padding: wide ? { top: 140, right: 140, bottom: 140, left: 460 } : { top: 150, right: 90, bottom: 400, left: 90 },
      maxZoom: 14,
      duration: 900,
    }))
  }

  // Preview the picked place on the map — the pending marker shows where it'll
  // land before it's saved. Kept in Redux so the augmentation selector draws it.
  function preview(coord: [number, number], cat: PlaceCategory) {
    dispatch(setPendingPlace({ coord, category: cat }))
  }

  function chooseCategory(cat: PlaceCategory) {
    setCategory(cat)
    if (pending) preview(pending.coord, cat)
  }

  async function pick(mapboxId: string) {
    const place = await retrieve(mapboxId, sessionToken())
    resetSession()
    clear()
    if (!place) return
    const cat = guessCategory(place.categories)
    setPending(place)
    setCategory(cat)
    setFromDiscovery(false)
    preview(place.coord, cat)
    frame(place.coord)
  }

  function done() {
    dispatch(setPendingPlace(null))
    setPending(null)
    setNote('')
    setQuery('')
    setFromDiscovery(false)
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
    if (!fromDiscovery) frame(pending.coord)   // search re-centers; discovery stays put
    done()
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
              onChange={e => chooseCategory(e.target.value as PlaceCategory)}
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
            <button className="junro-secondary" onClick={() => { if (!fromDiscovery) frame(); done() }}>Cancel</button>
            <button className="junro-primary" onClick={save}>Save place</button>
          </div>
        </div>
      )}
    </div>
  )
}
