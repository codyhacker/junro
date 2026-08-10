import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setSelectedPlace } from './tripInteractionSlice'
import { updatePlace, removePlace, assignStop } from './tripSlice'
import { CATEGORY_META } from './categoryMeta'
import { selectDays } from './selectors'
import { dayLabel } from './DayRail'
import type { PlaceCategory } from '../../shared/types/trip'

// Detail card for the selected place — edit the note ("why did I save
// this?"), recategorize, or remove.
export function PlacePanel() {
  const dispatch = useAppDispatch()
  const selectedId = useAppSelector(s => s.tripInteraction.selectedPlaceId)
  const place = useAppSelector(s =>
    s.trip.active?.places.find(p => p.id === s.tripInteraction.selectedPlaceId) ?? null)
  const days = useAppSelector(selectDays)

  if (!selectedId || !place) return null

  const assignedDayId = days.find(d => d.stopIds.includes(place.id))?.id ?? ''

  return (
    <div className="place-panel">
      <div className="place-panel-head">
        <span className="place-panel-emoji">{CATEGORY_META[place.category].emoji}</span>
        <div className="place-panel-titles">
          <div className="place-panel-name">{place.name}</div>
          {place.address && <div className="place-panel-addr">{place.address}</div>}
        </div>
        <button className="place-panel-close" onClick={() => dispatch(setSelectedPlace(null))}>×</button>
      </div>

      <select
        className="junro-input place-panel-cat"
        value={place.category}
        onChange={e => dispatch(updatePlace({
          id: place.id,
          patch: { category: e.target.value as PlaceCategory },
        }))}
      >
        {(Object.keys(CATEGORY_META) as PlaceCategory[]).map(cat => (
          <option key={cat} value={cat}>{CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}</option>
        ))}
      </select>

      {days.length > 0 && (
        <select
          className="junro-input place-panel-day"
          aria-label="Assign to a day"
          value={assignedDayId}
          onChange={e => dispatch(assignStop({ placeId: place.id, dayId: e.target.value || null }))}
        >
          <option value="">Unassigned</option>
          {days.map((d, i) => (
            <option key={d.id} value={d.id}>Day {i + 1} · {dayLabel(d.date)}</option>
          ))}
        </select>
      )}

      <textarea
        className="junro-input place-panel-note"
        placeholder="Why did you save this?"
        value={place.notes ?? ''}
        onChange={e => dispatch(updatePlace({
          id: place.id,
          patch: { notes: e.target.value || undefined },
        }))}
        rows={2}
      />

      <button
        className="junro-secondary place-panel-remove"
        onClick={() => {
          dispatch(removePlace(place.id))
          dispatch(setSelectedPlace(null))
        }}
      >Remove place</button>
    </div>
  )
}
