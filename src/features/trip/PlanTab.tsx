import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setTravelMode } from './tripSlice'
import { toggleShowTravelInfo } from '../shell/travelInfoSlice'
import { SuggestDays } from './SuggestDays'
import { DayRail } from './DayRail'
import type { TravelMode } from '../../shared/types/trip'

const MODES: { value: TravelMode; label: string }[] = [
  { value: 'walking', label: '🚶 Walk' },
  { value: 'driving', label: '🚗 Drive' },
]

// The Plan tab — opt-in day organizing: auto-grouped suggestions + the day
// list. Empty until the trip has dates (set those in Trip). "Getting around"
// lives here as a quiet secondary control, not a prominent group.
export function PlanTab() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector((s) => s.trip.active)
  const hasDays = useAppSelector((s) => (s.trip.active?.days.length ?? 0) > 0)
  const showTravelInfo = useAppSelector((s) => s.travelInfo.showTravelInfo)

  if (!trip) return null
  if (!hasDays) {
    return (
      <div className="places-empty">
        Set your trip dates in the <b>Trip</b> tab to plan days — or just keep collecting places in{' '}
        <b>Places</b>.
      </div>
    )
  }

  return (
    <div className="plan-tab">
      <SuggestDays />
      <DayRail />
      <div className="plan-mode">
        <span className="plan-mode-label">Getting around</span>
        <div className="plan-mode-controls">
          <div className="plan-mode-toggle">
            {MODES.map((m) => (
              <button
                key={m.value}
                className={`plan-mode-btn${trip.prefs.travelMode === m.value ? ' active' : ''}`}
                onClick={() => dispatch(setTravelMode(m.value))}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            className={`travel-info-toggle${showTravelInfo ? ' active' : ''}`}
            aria-pressed={showTravelInfo}
            title={showTravelInfo ? 'Hide per-leg travel times' : 'Show per-leg travel times'}
            onClick={() => dispatch(toggleShowTravelInfo())}
          >
            ⏱ Travel info
          </button>
        </div>
      </div>
    </div>
  )
}
