import { useAppSelector } from '../../app/hooks'
import { CATEGORY_META } from '../trip/categoryMeta'
import { dayLabel } from '../trip/DayRail'
import { computeTripTimeline, formatClock } from './timeline'

// Read-only, print-friendly render of the whole trip (PROJECT_PLAN.md §5 Phase
// 5). No store writes, no map engine — so it works token-less and doubles as
// the future public share page. Reached via ?view=itinerary.
export function ItineraryView() {
  const trip = useAppSelector(s => s.trip.active)
  const hydrated = useAppSelector(s => s.trip.hydrated)

  if (!hydrated) return <div className="viewer-empty">Loading…</div>
  if (!trip) return <div className="viewer-empty">No trip to show.</div>

  const timelines = computeTripTimeline(trip)

  return (
    <div className="viewer itinerary">
      <header className="viewer-head no-print-border">
        <div>
          <h1>{trip.name || trip.destination.name}</h1>
          <p className="viewer-sub">{trip.destination.name}
            {trip.startDate && trip.endDate ? ` · ${dayLabel(trip.startDate)} – ${dayLabel(trip.endDate)}` : ''}
          </p>
        </div>
        <div className="viewer-actions no-print">
          <button onClick={() => window.print()}>Print</button>
          <a href={import.meta.env.BASE_URL}>← Planner</a>
        </div>
      </header>

      {timelines.length === 0 && <p className="viewer-empty">Set dates to build the itinerary.</p>}

      {timelines.map((day, i) => (
        <section key={day.dayId} className="itin-day">
          <h2>
            <span className="itin-day-n">Day {i + 1}</span>
            {dayLabel(day.date)}
            {day.lodgingName && <span className="itin-day-hotel"> · {day.lodgingName}</span>}
          </h2>

          {day.stops.length === 0 && <p className="itin-empty">Nothing planned.</p>}

          <ol className="itin-stops">
            {day.stops.map(stop => (
              <li key={stop.placeId} className="itin-stop">
                <span className="itin-time">
                  {formatClock(stop.arrivalMin)}{stop.fixed && <span className="itin-fixed" title="Reservation"> ●</span>}
                </span>
                <span className="itin-body">
                  <span className="itin-name">
                    {CATEGORY_META[stop.category].emoji} {stop.name}
                  </span>
                  {stop.address && <span className="itin-addr">{stop.address}</span>}
                  {stop.notes && <span className="itin-note">{stop.notes}</span>}
                </span>
              </li>
            ))}
          </ol>

          {day.lodgingName && day.stops.length > 0 && (
            <p className="itin-return">↩ back to {day.lodgingName} · {formatClock(day.endMin)}</p>
          )}
        </section>
      ))}
    </div>
  )
}
