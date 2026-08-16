import { useAppSelector } from '../../app/hooks'
import { NewTripForm } from './NewTripForm'

// First-run card: a trip needs a name and a destination — nothing else
// (PROJECT_PLAN.md §2 principle 5). Dates, hotels, days all come later.
// The actual form is NewTripForm — shared with TripPicker's "+ New trip".
export function TripGate() {
  const hydrated = useAppSelector((s) => s.trip.hydrated)
  const active = useAppSelector((s) => s.trip.active)

  if (!hydrated || active) return null

  return (
    <div className="trip-gate">
      <div className="trip-gate-card">
        <div className="trip-gate-mark">↱</div>
        <h1 className="trip-gate-title">Junro</h1>
        <p className="trip-gate-sub">Where are you headed?</p>
        <NewTripForm />
      </div>
    </div>
  )
}
