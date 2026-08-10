import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setSelectedDay, setHoveredPlace, setSelectedPlace } from './tripInteractionSlice'
import { assignStop, moveStop, setDayTravelMode } from './tripSlice'
import { selectDays } from './selectors'
import { selectRequestByDayId, type DayRouteRequest } from '../planner/selectors'
import type { DayRoute } from '../planner/plannerSlice'
import { CATEGORY_META } from './categoryMeta'
import { dayHexAt } from '../../shared/constants/dayColors'
import { haversineKm, roughTransitMinutes } from '../../shared/lib/geo'
import type { TravelMode } from '../../shared/types/trip'

// Day rows in the planning rail: date, the lodging that anchors the day, the
// ordered stop list with per-leg travel times, and the day's total. Clicking
// the header frames the day on the map (DAY_FOCUS); the arrows reorder stops.
// A day with no route (offline, or a failed request) simply shows its stops
// without times — never an invented one.

const LABEL_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
})

export function dayLabel(date: string): string {
  const ms = Date.parse(`${date}T00:00:00Z`)
  return Number.isFinite(ms) ? LABEL_FMT.format(ms) : date
}

export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h} h` : `${h} h ${m}`
}

// The travel line drawn above a stop (and once more for the trip back to the
// hotel). The rough transit hint rides beside the walking time on long legs —
// display-only, never part of routing (PROJECT_PLAN.md §7 Stage 3).
function TravelLeg({ request, route, legIndex }: {
  request: DayRouteRequest
  route: DayRoute
  legIndex: number
}) {
  const seconds = route.legSeconds[legIndex]
  if (seconds === undefined) return null
  const from = request.coords[legIndex]
  const to = request.coords[legIndex + 1]
  const transitMin = request.mode === 'walking' && from && to
    ? roughTransitMinutes(haversineKm(from, to))
    : null

  return (
    <div className="day-leg">
      <span className="day-leg-time">
        {request.mode === 'walking' ? '↳ walk' : '↳ drive'} {formatDuration(seconds)}
      </span>
      {transitMin !== null && (
        <span className="day-leg-transit">~{transitMin} min transit (rough)</span>
      )}
    </div>
  )
}

export function DayRail() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector(s => s.trip.active)
  const days = useAppSelector(selectDays)
  const uiMode = useAppSelector(s => s.mapStyle.uiMode)
  const selectedDayId = useAppSelector(s => s.tripInteraction.selectedDayId)
  const requestByDayId = useAppSelector(selectRequestByDayId)
  const dayRoutes = useAppSelector(s => s.planner.dayRoutes)

  if (!trip || days.length === 0) return null

  const placeById = new Map(trip.places.map(p => [p.id, p]))
  const lodgingById = new Map(trip.lodgings.map(l => [l.id, l]))

  return (
    <ul className="day-rail">
      {days.map((day, i) => {
        const lodging = day.lodgingId ? lodgingById.get(day.lodgingId) : undefined
        const stops = day.stopIds
          .map(id => placeById.get(id))
          .filter((p): p is NonNullable<typeof p> => p !== undefined)
        const request = requestByDayId.get(day.id)
        const stored = dayRoutes[day.id]
        // Only a route matching the day's current content may be shown.
        const route = request && stored?.hash === request.hash ? stored : null
        // With a lodging the coords are [hotel, …stops, hotel], so the leg
        // arriving at stop n is leg n; without one, stop 0 has no leg before it.
        const legOffset = lodging ? 0 : -1

        return (
          <li key={day.id} className={`day-row${day.id === selectedDayId ? ' selected' : ''}`}>
            <button className="day-head" onClick={() => dispatch(setSelectedDay(day.id))}>
              <span className="day-swatch" style={{ background: dayHexAt(i, uiMode) }} />
              <span className="day-texts">
                <span className="day-date">{dayLabel(day.date)}</span>
                <span className="day-lodging">{lodging ? lodging.name : 'No hotel'}</span>
              </span>
              <span className="day-count">{day.stopIds.length}</span>
            </button>

            {day.stopIds.length > 0 && (
              <div className="day-meta">
                <span className="day-total">
                  {route ? `${formatDuration(route.totalSeconds)} travel` : 'No route'}
                </span>
                <select
                  className="day-mode"
                  aria-label={`Travel mode for ${dayLabel(day.date)}`}
                  value={day.travelMode ?? ''}
                  onChange={e => dispatch(setDayTravelMode({
                    dayId: day.id,
                    mode: (e.target.value || null) as TravelMode | null,
                  }))}
                >
                  <option value="">{trip.prefs.travelMode === 'walking' ? 'Walk (trip)' : 'Drive (trip)'}</option>
                  <option value="walking">Walk</option>
                  <option value="driving">Drive</option>
                </select>
              </div>
            )}

            <ul className="day-stops">
              {stops.map((place, idx) => (
                <li key={place.id} className="day-stop-group">
                  {route && request && (
                    <TravelLeg request={request} route={route} legIndex={idx + legOffset} />
                  )}
                  <div
                    className="day-stop"
                    onMouseEnter={() => dispatch(setHoveredPlace(place.id))}
                    onMouseLeave={() => dispatch(setHoveredPlace(null))}
                  >
                    <button className="day-stop-main" onClick={() => dispatch(setSelectedPlace(place.id))}>
                      <span className="day-stop-index">{idx + 1}</span>
                      <span className="day-stop-emoji">{CATEGORY_META[place.category].emoji}</span>
                      <span className="day-stop-name">{place.name}</span>
                    </button>
                    <span className="day-stop-actions">
                      <button
                        aria-label={`Move ${place.name} earlier`}
                        disabled={idx === 0}
                        onClick={() => dispatch(moveStop({ dayId: day.id, placeId: place.id, delta: -1 }))}
                      >↑</button>
                      <button
                        aria-label={`Move ${place.name} later`}
                        disabled={idx === stops.length - 1}
                        onClick={() => dispatch(moveStop({ dayId: day.id, placeId: place.id, delta: 1 }))}
                      >↓</button>
                      <button
                        aria-label={`Remove ${place.name} from this day`}
                        onClick={() => dispatch(assignStop({ placeId: place.id, dayId: null }))}
                      >×</button>
                    </span>
                  </div>
                </li>
              ))}

              {route && request && lodging && (
                <li className="day-stop-group">
                  <TravelLeg request={request} route={route} legIndex={stops.length} />
                  <div className="day-return">↩ back to {lodging.name}</div>
                </li>
              )}

              {day.stopIds.length === 0 && <li className="day-empty">Nothing planned yet</li>}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
