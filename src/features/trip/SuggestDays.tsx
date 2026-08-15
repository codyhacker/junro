import { useEffect, useState, type CSSProperties } from 'react'
import { useStore } from 'react-redux'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import type { AppStore } from '../../app/store'
import { selectClusters } from '../planner/selectors'
import { selectUnassignedPlaces, selectDays, representativeName, dayCoords } from './selectors'
import { suggestDays, type Suggestion, type DaySuggestion } from '../planner/suggest'
import { applySuggestion } from '../planner/applySuggestion'
import { setPreviewHighlight } from './tripInteractionSlice'
import { fitBounds } from '../map/cameraSlice'
import { dayHexAt, dayRgbAt } from '../../shared/constants/dayColors'
import { dayLabel, formatDuration } from './DayRail'
import { CATEGORY_META } from './categoryMeta'
import type { PlaceCategory } from '../../shared/types/trip'

// Compact per-category counts for a day's candidate places, e.g. "⛩️×2 🍴×1
// ☕×1" — counts by the app's actual PlaceCategory, finer-grained than
// suggest.ts's sight/food/shop/other cap groups (those live only inside the
// rebalance pass), so this shows exactly what's on the day.
function categoryMix(placeIds: string[], catById: Map<string, PlaceCategory>): string {
  const counts = new Map<PlaceCategory, number>()
  for (const id of placeIds) {
    const cat = catById.get(id)
    if (cat) counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }
  return [...counts.entries()].map(([cat, n]) => `${CATEGORY_META[cat].emoji}×${n}`).join(' ')
}

// "Suggest days" — runs Stage 1 (clusters, already reactive) + Stage 2 (greedy
// assignment) and shows the result as a diff the user applies or ignores.
// Never a silent rewrite (PROJECT_PLAN.md §7). Apply runs Stage 3 ordering.
export function SuggestDays() {
  const dispatch = useAppDispatch()
  const store = useStore() as AppStore
  const trip = useAppSelector((s) => s.trip.active)
  const clusters = useAppSelector(selectClusters)
  const unassigned = useAppSelector(selectUnassignedPlaces)
  const days = useAppSelector(selectDays)
  const uiMode = useAppSelector((s) => s.mapStyle.uiMode)

  const [preview, setPreview] = useState<Suggestion | null>(null)
  const [applying, setApplying] = useState(false)
  const [activeRowId, setActiveRowId] = useState<string | null>(null)

  // Leaving the Plan tab unmounts this component — don't leave a previewed
  // zone glowing on the map behind it.
  useEffect(() => {
    return () => {
      dispatch(setPreviewHighlight(null))
    }
  }, [dispatch])

  // The component below renders null (not unmount) once every place is
  // assigned, so the unmount cleanup above never fires for that transition.
  // It used to be unreachable — nothing in Plan could assign the very last
  // unassigned place — but DayRail's Unscheduled section now makes it
  // reachable, so clear a glowing preview explicitly when it happens. Also
  // drop the preview itself: assigning a place from that section can move
  // places the open preview already accounted for, so a stale preview left
  // open could apply and shuffle them right back.
  useEffect(() => {
    if (unassigned.length === 0) {
      dispatch(setPreviewHighlight(null))
      setActiveRowId(null)
      setPreview(null)
    }
  }, [unassigned.length, dispatch])

  if (!trip || days.length === 0 || unassigned.length === 0) return null

  const nameById = new Map(trip.places.map((p) => [p.id, p.name]))
  const catById = new Map(trip.places.map((p) => [p.id, p.category]))
  const dayIndex = new Map(days.map((d, i) => [d.id, i]))

  function clearHighlight() {
    dispatch(setPreviewHighlight(null))
    setActiveRowId(null)
  }

  // Click a preview row: glow its candidate places in that day's prospective
  // color and fit the camera to them — a plain pan wouldn't show which
  // visible pins actually belong to this day.
  function previewDay(a: DaySuggestion, idx: number) {
    const day = days[idx]
    dispatch(setPreviewHighlight({ placeIds: a.placeIds, color: dayHexAt(idx, uiMode) }))
    setActiveRowId(a.dayId)
    const coords = dayCoords({ ...day, stopIds: a.placeIds }, trip!.places, trip!.lodgings)
    if (coords.length === 0) return
    const lngs = coords.map((c) => c[0])
    const lats = coords.map((c) => c[1])
    dispatch(
      fitBounds({
        bounds: [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        padding:
          window.innerWidth > 640
            ? { top: 70, right: 70, bottom: 70, left: 400 }
            : { top: 70, right: 40, bottom: 420, left: 40 },
        maxZoom: 15.5,
        duration: 900,
      }),
    )
  }

  function runSuggest() {
    clearHighlight()
    setPreview(
      suggestDays({
        clusterResult: clusters,
        days,
        places: trip!.places,
        lodgings: trip!.lodgings,
        prefs: trip!.prefs,
      }),
    )
  }

  function dismiss() {
    setPreview(null)
    clearHighlight()
  }

  async function apply() {
    if (!preview) return
    setApplying(true)
    try {
      await applySuggestion(store, preview)
    } finally {
      setApplying(false)
      setPreview(null)
      clearHighlight()
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
        {rows.map((a) => {
          const idx = dayIndex.get(a.dayId) ?? 0
          const day = days[idx]
          return (
            <li
              key={a.dayId}
              className={`suggest-row${activeRowId === a.dayId ? ' active' : ''}`}
              style={{ '--day-rgb': dayRgbAt(idx, uiMode) } as CSSProperties}
            >
              <button className="suggest-row-main" onClick={() => previewDay(a, idx)}>
                <span className="suggest-row-head">
                  <strong>Day {idx + 1}</strong> · {dayLabel(day.date)}
                  {representativeName(a.placeIds, trip.places) && (
                    <span className="suggest-row-hood">
                      📍 {representativeName(a.placeIds, trip.places)}
                    </span>
                  )}
                  <span className="suggest-row-meta">
                    {a.placeIds.length} place{a.placeIds.length === 1 ? '' : 's'} · ~
                    {formatDuration(a.estimatedMinutes * 60)}
                    {a.travelModeOverride === 'driving' && ' · 🚗 drive'}
                  </span>
                  <span className="suggest-row-mix">{categoryMix(a.placeIds, catById)}</span>
                </span>
                <span className="suggest-row-names">
                  {a.placeIds
                    .map((id) => nameById.get(id))
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {preview.unplacedPlaceIds.length > 0 && (
        <div className="suggest-unplaced">
          {preview.unplacedPlaceIds.length} place{preview.unplacedPlaceIds.length === 1 ? '' : 's'}{' '}
          didn’t fit — they stay in the scrapbook.
          <div className="suggest-row-names">
            {preview.unplacedPlaceIds
              .map((id) => nameById.get(id))
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      )}

      <div className="suggest-actions">
        <button className="junro-secondary" onClick={dismiss} disabled={applying}>
          Dismiss
        </button>
        <button className="junro-primary" onClick={apply} disabled={applying || rows.length === 0}>
          {applying ? 'Planning…' : 'Apply plan'}
        </button>
      </div>
    </div>
  )
}
