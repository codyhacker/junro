import { useState } from 'react'
import { useAppSelector } from '../../app/hooks'
import { CATEGORY_META } from '../trip/categoryMeta'
import { dayLabel } from '../trip/DayRail'
import { computeTripTimeline, formatClock } from './timeline'
import { mapsSearchUrl, mapsDirectionsUrl } from './mapsLinks'

// The phone-sized "today" view (PROJECT_PLAN.md §5) — v1's answer to "the plan
// dies the moment the trip starts." Read-only, one day at a time, with deep
// links that hand navigation to the native maps app. Reached via ?view=today.
const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function TodayView() {
  const trip = useAppSelector((s) => s.trip.active)
  const hydrated = useAppSelector((s) => s.trip.hydrated)
  const timelines = useAppSelector((s) => (s.trip.active ? computeTripTimeline(s.trip.active) : []))

  const initial = Math.max(
    0,
    timelines.findIndex((d) => d.date === todayIso()),
  )
  const [idx, setIdx] = useState(initial)

  if (!hydrated) return <div className="viewer-empty">Loading…</div>
  if (!trip || timelines.length === 0)
    return <div className="viewer-empty">No days to show yet.</div>

  const clamped = Math.min(idx, timelines.length - 1)
  const day = timelines[clamped]
  const tripDay = trip.days[clamped]
  const lodging = tripDay.lodgingId
    ? trip.lodgings.find((l) => l.id === tripDay.lodgingId)
    : undefined
  const mode = tripDay.travelMode ?? trip.prefs.travelMode

  const routeCoords: [number, number][] = [
    ...(lodging ? [lodging.coord] : []),
    ...day.stops.map((s) => s.coord),
    ...(lodging ? [lodging.coord] : []),
  ]

  return (
    <div className="viewer today">
      <header className="today-head">
        <a className="today-back" href={import.meta.env.BASE_URL}>
          ←
        </a>
        <div className="today-daynav">
          <button
            disabled={clamped === 0}
            onClick={() => setIdx(clamped - 1)}
            aria-label="Previous day"
          >
            ‹
          </button>
          <span>
            <strong>Day {clamped + 1}</strong>
            <span className="today-date">{dayLabel(day.date)}</span>
          </span>
          <button
            disabled={clamped === timelines.length - 1}
            onClick={() => setIdx(clamped + 1)}
            aria-label="Next day"
          >
            ›
          </button>
        </div>
      </header>

      {lodging && <div className="today-hotel">🏨 {lodging.name}</div>}

      {day.stops.length === 0 ? (
        <p className="viewer-empty">Nothing planned for this day.</p>
      ) : (
        <>
          <ol className="today-stops">
            {day.stops.map((stop, i) => (
              <li key={stop.placeId} className="today-stop">
                <span className="today-time">
                  {formatClock(stop.arrivalMin)}
                  {stop.fixed && ' ●'}
                </span>
                <span className="today-stop-body">
                  <span className="today-stop-name">
                    {CATEGORY_META[stop.category].emoji} {stop.name}
                  </span>
                  {stop.address && <span className="today-stop-addr">{stop.address}</span>}
                </span>
                <a
                  className="today-stop-map"
                  href={mapsSearchUrl(stop.coord)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${stop.name} in Maps`}
                >
                  ◎
                </a>
                {i < day.stops.length - 1 && <span className="today-connector" aria-hidden />}
              </li>
            ))}
          </ol>

          {routeCoords.length >= 2 && (
            <a
              className="today-directions"
              href={mapsDirectionsUrl(routeCoords, mode)}
              target="_blank"
              rel="noreferrer"
            >
              Directions for the day →
            </a>
          )}
        </>
      )}
    </div>
  )
}
