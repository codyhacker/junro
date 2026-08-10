import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setSelectedDay, setHoveredPlace, setSelectedPlace } from './tripInteractionSlice'
import { assignStop, moveStop } from './tripSlice'
import { selectDays } from './selectors'
import { CATEGORY_META } from './categoryMeta'
import { dayHexAt } from '../../shared/constants/dayColors'

// Day rows in the planning rail: date, the lodging that anchors the day, and
// the ordered stop list. Clicking the header frames the day on the map
// (DAY_FOCUS); the arrows reorder stops in place.

const LABEL_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
})

export function dayLabel(date: string): string {
  const ms = Date.parse(`${date}T00:00:00Z`)
  return Number.isFinite(ms) ? LABEL_FMT.format(ms) : date
}

export function DayRail() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector(s => s.trip.active)
  const days = useAppSelector(selectDays)
  const uiMode = useAppSelector(s => s.mapStyle.uiMode)
  const selectedDayId = useAppSelector(s => s.tripInteraction.selectedDayId)

  if (!trip || days.length === 0) return null

  const placeById = new Map(trip.places.map(p => [p.id, p]))
  const lodgingById = new Map(trip.lodgings.map(l => [l.id, l]))

  return (
    <ul className="day-rail">
      {days.map((day, i) => {
        const lodging = day.lodgingId ? lodgingById.get(day.lodgingId) : undefined
        return (
          <li
            key={day.id}
            className={`day-row${day.id === selectedDayId ? ' selected' : ''}`}
          >
            <button className="day-head" onClick={() => dispatch(setSelectedDay(day.id))}>
              <span className="day-swatch" style={{ background: dayHexAt(i, uiMode) }} />
              <span className="day-texts">
                <span className="day-date">{dayLabel(day.date)}</span>
                <span className="day-lodging">{lodging ? lodging.name : 'No hotel'}</span>
              </span>
              <span className="day-count">{day.stopIds.length}</span>
            </button>

            <ul className="day-stops">
              {day.stopIds.map((id, idx) => {
                const place = placeById.get(id)
                if (!place) return null
                return (
                  <li
                    key={id}
                    className="day-stop"
                    onMouseEnter={() => dispatch(setHoveredPlace(id))}
                    onMouseLeave={() => dispatch(setHoveredPlace(null))}
                  >
                    <button className="day-stop-main" onClick={() => dispatch(setSelectedPlace(id))}>
                      <span className="day-stop-index">{idx + 1}</span>
                      <span className="day-stop-emoji">{CATEGORY_META[place.category].emoji}</span>
                      <span className="day-stop-name">{place.name}</span>
                    </button>
                    <span className="day-stop-actions">
                      <button
                        aria-label={`Move ${place.name} earlier`}
                        disabled={idx === 0}
                        onClick={() => dispatch(moveStop({ dayId: day.id, placeId: id, delta: -1 }))}
                      >↑</button>
                      <button
                        aria-label={`Move ${place.name} later`}
                        disabled={idx === day.stopIds.length - 1}
                        onClick={() => dispatch(moveStop({ dayId: day.id, placeId: id, delta: 1 }))}
                      >↓</button>
                      <button
                        aria-label={`Remove ${place.name} from this day`}
                        onClick={() => dispatch(assignStop({ placeId: id, dayId: null }))}
                      >×</button>
                    </span>
                  </li>
                )
              })}
              {day.stopIds.length === 0 && <li className="day-empty">Nothing planned yet</li>}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
