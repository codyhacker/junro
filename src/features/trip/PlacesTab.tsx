import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setHoveredPlace, setSelectedPlace } from './tripInteractionSlice'
import { removePlace } from './tripSlice'
import { flyTo } from '../map/cameraSlice'
import { selectDays } from './selectors'
import { CATEGORY_META } from './categoryMeta'
import { dayHexAt } from '../../shared/constants/dayColors'
import type { PlaceCategory, SavedPlace } from '../../shared/types/trip'

// The Places tab — the collector home. Every saved place, grouped by category
// with its "why I saved this" note; a small day badge if it's already been
// planned onto a day. This list persists no matter what happens in Plan, so
// you never lose your places (UX_PLAN round 2). Click → select + fly to it.
const CATEGORY_ORDER: PlaceCategory[] = ['sight', 'cafe', 'restaurant', 'shop', 'other']
const plural: Record<PlaceCategory, string> = {
  sight: 'Sights', cafe: 'Cafes', restaurant: 'Restaurants', shop: 'Shops', other: 'Other',
}

export function PlacesTab() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector(s => s.trip.active)
  const selectedId = useAppSelector(s => s.tripInteraction.selectedPlaceId)
  const uiMode = useAppSelector(s => s.mapStyle.uiMode)
  const days = useAppSelector(selectDays)

  if (!trip) return null
  const places = trip.places

  if (places.length === 0) {
    return <div className="places-empty">Search above to start collecting places — cafes, sights, anywhere you want to go.</div>
  }

  const dayOf = new Map<string, number>()
  days.forEach((d, i) => d.stopIds.forEach(id => dayOf.set(id, i)))

  const byCat: Record<PlaceCategory, SavedPlace[]> = { sight: [], cafe: [], restaurant: [], shop: [], other: [] }
  for (const p of places) byCat[p.category].push(p)

  return (
    <div className="places-tab">
      {CATEGORY_ORDER.filter(c => byCat[c].length > 0).map(cat => (
        <section key={cat} className="places-cat">
          <div className="places-cat-head">
            <span>{CATEGORY_META[cat].emoji} {plural[cat]}</span>
            <span className="places-cat-count">{byCat[cat].length}</span>
          </div>
          <ul className="places-list">
            {byCat[cat].map(p => {
              const di = dayOf.get(p.id)
              return (
                <li
                  key={p.id}
                  className={`places-row${p.id === selectedId ? ' selected' : ''}`}
                  onMouseEnter={() => dispatch(setHoveredPlace(p.id))}
                  onMouseLeave={() => dispatch(setHoveredPlace(null))}
                >
                  <button
                    className="places-row-main"
                    onClick={() => {
                      dispatch(setSelectedPlace(p.id))
                      dispatch(flyTo({ center: p.coord, zoom: 15, duration: 1000 }))
                    }}
                  >
                    <span className="places-name">{p.name}</span>
                    {p.notes && <span className="places-note">{p.notes}</span>}
                  </button>
                  {di !== undefined && (
                    <span className="places-daybadge" style={{ background: dayHexAt(di, uiMode) }}>D{di + 1}</span>
                  )}
                  <button
                    className="places-remove"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => dispatch(removePlace(p.id))}
                  >×</button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
