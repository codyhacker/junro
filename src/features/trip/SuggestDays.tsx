import { useState } from 'react'
import { useStore } from 'react-redux'
import { useAppSelector } from '../../app/hooks'
import type { AppStore } from '../../app/store'
import { selectClusters } from '../planner/selectors'
import { selectUnassignedPlaces, selectDays, representativeName } from './selectors'
import { suggestDays, type Suggestion } from '../planner/suggest'
import { applySuggestion } from '../planner/applySuggestion'
import { dayLabel, formatDuration } from './DayRail'

// "Suggest days" — runs Stage 1 (clusters, already reactive) + Stage 2 (greedy
// assignment) and shows the result as a diff the user applies or ignores.
// Never a silent rewrite (PROJECT_PLAN.md §7). Apply runs Stage 3 ordering.
export function SuggestDays() {
  const store = useStore() as AppStore
  const trip = useAppSelector(s => s.trip.active)
  const clusters = useAppSelector(selectClusters)
  const unassigned = useAppSelector(selectUnassignedPlaces)
  const days = useAppSelector(selectDays)

  const [preview, setPreview] = useState<Suggestion | null>(null)
  const [applying, setApplying] = useState(false)

  if (!trip || days.length === 0 || unassigned.length === 0) return null

  const nameById = new Map(trip.places.map(p => [p.id, p.name]))
  const dayIndex = new Map(days.map((d, i) => [d.id, i]))

  function runSuggest() {
    setPreview(suggestDays({
      clusterResult: clusters,
      days,
      places: trip!.places,
      lodgings: trip!.lodgings,
      prefs: trip!.prefs,
    }))
  }

  async function apply() {
    if (!preview) return
    setApplying(true)
    try {
      await applySuggestion(store, preview)
    } finally {
      setApplying(false)
      setPreview(null)
    }
  }

  if (!preview) {
    return (
      <button className="suggest-btn" onClick={runSuggest}>
        ✨ Suggest days
      </button>
    )
  }

  const rows = [...preview.assignments].sort(
    (a, b) => (dayIndex.get(a.dayId) ?? 0) - (dayIndex.get(b.dayId) ?? 0),
  )

  return (
    <div className="suggest-preview">
      <div className="suggest-head">
        <span>Suggested plan</span>
        <span className="suggest-sub">one neighborhood per day, from your hotel outward</span>
      </div>

      {rows.length === 0 && (
        <div className="suggest-empty">No room in the current days — add days or unlock some.</div>
      )}

      <ul className="suggest-rows">
        {rows.map(a => {
          const day = days[dayIndex.get(a.dayId) ?? 0]
          return (
            <li key={a.dayId} className="suggest-row">
              <div className="suggest-row-head">
                <strong>Day {(dayIndex.get(a.dayId) ?? 0) + 1}</strong> · {dayLabel(day.date)}
                {representativeName(a.placeIds, trip.places) && (
                  <span className="suggest-row-hood">📍 {representativeName(a.placeIds, trip.places)}</span>
                )}
                <span className="suggest-row-meta">
                  {a.placeIds.length} place{a.placeIds.length === 1 ? '' : 's'} · ~{formatDuration(a.estimatedMinutes * 60)}
                  {a.travelModeOverride === 'driving' && ' · 🚗 drive'}
                </span>
              </div>
              <div className="suggest-row-names">
                {a.placeIds.map(id => nameById.get(id)).filter(Boolean).join(' · ')}
              </div>
            </li>
          )
        })}
      </ul>

      {preview.unplacedPlaceIds.length > 0 && (
        <div className="suggest-unplaced">
          {preview.unplacedPlaceIds.length} place{preview.unplacedPlaceIds.length === 1 ? '' : 's'} didn’t fit — they stay in the scrapbook.
        </div>
      )}

      <div className="suggest-actions">
        <button className="junro-secondary" onClick={() => setPreview(null)} disabled={applying}>Dismiss</button>
        <button className="junro-primary" onClick={apply} disabled={applying || rows.length === 0}>
          {applying ? 'Planning…' : 'Apply plan'}
        </button>
      </div>
    </div>
  )
}
