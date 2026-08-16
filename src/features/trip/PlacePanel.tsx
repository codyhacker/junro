import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setSelectedPlace } from './tripInteractionSlice'
import { updatePlace, removePlace } from './tripSlice'
import { CATEGORY_META } from './categoryMeta'
import { CategoryIcon } from '../../shared/components/CategoryIcon'
import { selectDays } from './selectors'
import { DayAssignChips } from './DayAssignChips'
import { useConfirmAction } from './useConfirmAction'
import type { PlaceCategory } from '../../shared/types/trip'

// Detail card for the selected place — edit the note ("why did I save
// this?"), recategorize, or remove.
export function PlacePanel() {
  const dispatch = useAppDispatch()
  const selectedId = useAppSelector((s) => s.tripInteraction.selectedPlaceId)
  const place = useAppSelector(
    (s) => s.trip.active?.places.find((p) => p.id === s.tripInteraction.selectedPlaceId) ?? null,
  )
  const days = useAppSelector(selectDays)

  if (!selectedId || !place) return null

  const assignedDayId = days.find((d) => d.stopIds.includes(place.id))?.id ?? null

  return (
    <div className="place-panel">
      <div className="place-panel-head">
        <span className="place-panel-emoji">
          <CategoryIcon category={place.category} />
        </span>
        <div className="place-panel-titles">
          <div className="place-panel-name">{place.name}</div>
          {place.address && <div className="place-panel-addr">{place.address}</div>}
        </div>
        <button className="place-panel-close" onClick={() => dispatch(setSelectedPlace(null))}>
          ×
        </button>
      </div>

      <select
        className="junro-input place-panel-cat"
        value={place.category}
        onChange={(e) =>
          dispatch(
            updatePlace({
              id: place.id,
              patch: { category: e.target.value as PlaceCategory },
            }),
          )
        }
      >
        {(Object.keys(CATEGORY_META) as PlaceCategory[]).map((cat) => (
          <option key={cat} value={cat}>
            {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
          </option>
        ))}
      </select>

      {days.length > 0 && <DayAssignChips placeId={place.id} assignedDayId={assignedDayId} />}

      <textarea
        className="junro-input place-panel-note"
        placeholder="Why did you save this?"
        value={place.notes ?? ''}
        onChange={(e) =>
          dispatch(
            updatePlace({
              id: place.id,
              patch: { notes: e.target.value || undefined },
            }),
          )
        }
        rows={2}
      />

      <RemoveButton key={place.id} placeId={place.id} />
    </div>
  )
}

// Keyed by placeId at the call site above so switching the selected place
// remounts this fresh — otherwise an armed confirm on one place could carry
// its "confirming" state over and delete a different one on the next click.
function RemoveButton({ placeId }: { placeId: string }) {
  const dispatch = useAppDispatch()
  const { confirming, trigger } = useConfirmAction(() => {
    dispatch(removePlace(placeId))
    dispatch(setSelectedPlace(null))
  })

  return (
    <button
      className={`junro-secondary place-panel-remove${confirming ? ' confirming' : ''}`}
      onClick={trigger}
    >
      {confirming ? 'Confirm remove?' : 'Remove place'}
    </button>
  )
}
