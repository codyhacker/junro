import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setHoveredPlace, setSelectedPlace } from './tripInteractionSlice'
import { DiscoveryDrawer } from '../discovery/DiscoveryDrawer'
import { removePlace } from './tripSlice'
import { flyTo } from '../map/cameraSlice'
import { selectDays } from './selectors'
import { CategoryIcon } from '../../shared/components/CategoryIcon'
import { dayHexAt } from '../../shared/constants/dayColors'
import { useConfirmAction } from './useConfirmAction'
import type { UiMode } from '../../shared/constants/uiThemes'
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
  const trip = useAppSelector((s) => s.trip.active)
  const selectedId = useAppSelector((s) => s.tripInteraction.selectedPlaceId)
  const uiMode = useAppSelector((s) => s.mapStyle.uiMode)
  const days = useAppSelector(selectDays)

  if (!trip) return null
  const places = trip.places

  if (places.length === 0) {
    return (
      <div className="places-tab">
        <DiscoveryDrawer />
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
  for (const cat of CATEGORY_ORDER) byCat[cat].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="places-tab">
      <DiscoveryDrawer />
      {CATEGORY_ORDER.filter((c) => byCat[c].length > 0).map((cat) => (
        <section key={cat} className="places-cat">
          <div className="places-cat-head">
            <span>
              <CategoryIcon category={cat} /> {plural[cat]}
            </span>
            <span className="places-cat-count">{byCat[cat].length}</span>
          </div>
          <ul className="places-list">
            {byCat[cat].map((p) => (
              <PlaceRow
                key={p.id}
                place={p}
                selected={p.id === selectedId}
                dayIndex={dayOf.get(p.id)}
                uiMode={uiMode}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function PlaceRow({
  place,
  selected,
  dayIndex,
  uiMode,
}: {
  place: SavedPlace
  selected: boolean
  dayIndex: number | undefined
  uiMode: UiMode
}) {
  const dispatch = useAppDispatch()
  const { confirming, trigger } = useConfirmAction(() => dispatch(removePlace(place.id)))

  return (
    <li
      className={`places-row${selected ? ' selected' : ''}`}
      onMouseEnter={() => dispatch(setHoveredPlace(place.id))}
      onMouseLeave={() => dispatch(setHoveredPlace(null))}
    >
      <button
        className="places-row-main"
        onClick={() => {
          dispatch(setSelectedPlace(place.id))
          dispatch(flyTo({ center: place.coord, zoom: 15, duration: 1000 }))
        }}
      >
        <span className="places-name">{place.name}</span>
        {place.notes && <span className="places-note">{place.notes}</span>}
      </button>
      {dayIndex !== undefined && (
        <span className="places-daybadge" style={{ background: dayHexAt(dayIndex, uiMode) }}>
          D{dayIndex + 1}
        </span>
      )}
      <button
        className={`places-remove${confirming ? ' confirming' : ''}`}
        aria-label={confirming ? `Confirm remove ${place.name}` : `Remove ${place.name}`}
        onClick={trigger}
      >
        {confirming ? '✓' : '×'}
      </button>
    </li>
  )
}
