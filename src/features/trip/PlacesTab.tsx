import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setHoveredPlace, setSelectedPlace } from './tripInteractionSlice'
import { setDiscoveryVisible } from '../discovery/discoverySlice'
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
  sight: 'Sights',
  cafe: 'Cafes',
  restaurant: 'Restaurants',
  shop: 'Shops',
  other: 'Other',
}

export function PlacesTab() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector((s) => s.trip.active)
  const selectedId = useAppSelector((s) => s.tripInteraction.selectedPlaceId)
  const uiMode = useAppSelector((s) => s.mapStyle.uiMode)
  const days = useAppSelector(selectDays)
  const discoveryOn = useAppSelector((s) => s.discovery.visible)

  if (!trip) return null
  const places = trip.places

  // Discover-nearby toggle — collect from the map (Overture dots), a parallel
  // path to searching. Lives here in the collector home.
  const discoverBar = (
    <button
      className={`discover-toggle${discoveryOn ? ' active' : ''}`}
      aria-pressed={discoveryOn}
      title="Show nearby places on the map — tap a dot to add it"
      onClick={() => dispatch(setDiscoveryVisible(!discoveryOn))}
    >
      <span className="discover-dot" aria-hidden />
      {discoveryOn ? 'Discovering nearby — tap a dot to add' : 'Discover nearby places'}
    </button>
  )

  if (places.length === 0) {
    return (
      <div className="places-tab">
        {discoverBar}
        <div className="places-empty">
          Search above to start collecting — or turn on Discover and tap dots on the map.
        </div>
      </div>
    )
  }

  const dayOf = new Map<string, number>()
  days.forEach((d, i) => d.stopIds.forEach((id) => dayOf.set(id, i)))

  const byCat: Record<PlaceCategory, SavedPlace[]> = {
    sight: [],
    cafe: [],
    restaurant: [],
    shop: [],
    other: [],
  }
  for (const p of places) byCat[p.category].push(p)

  return (
    <div className="places-tab">
      {discoverBar}
      {CATEGORY_ORDER.filter((c) => byCat[c].length > 0).map((cat) => (
        <section key={cat} className="places-cat">
          <div className="places-cat-head">
            <span>
              {CATEGORY_META[cat].emoji} {plural[cat]}
            </span>
            <span className="places-cat-count">{byCat[cat].length}</span>
          </div>
          <ul className="places-list">
            {byCat[cat].map((p) => {
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
                    <span className="places-daybadge" style={{ background: dayHexAt(di, uiMode) }}>
                      D{di + 1}
                    </span>
                  )}
                  <button
                    className="places-remove"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => dispatch(removePlace(p.id))}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
