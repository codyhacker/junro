import type { AppStore } from '../../app/store'
import type { SavedPlace, TravelMode } from '../../shared/types/trip'
import { applyDaySuggestions } from '../trip/tripSlice'
import { getTravelMatrix } from './matrixService'
import { orderStops } from './ordering'
import type { Suggestion } from './suggest'

// Applies a Stage-2 suggestion: for each proposed day, merge its new places
// with anything already there, run Stage-3 ordering over [lodging, …stops]
// (which the Matrix service resolves, or haversine offline), then commit ALL
// days in one atomic action so a single undo reverses the whole plan. Async
// because the matrix is a network call; the routing listeners then redraw.
export async function applySuggestion(store: AppStore, suggestion: Suggestion): Promise<void> {
  const trip = store.getState().trip.active
  if (!trip) return
  const byId = new Map<string, SavedPlace>(trip.places.map(p => [p.id, p]))

  const entries: { dayId: string; placeIds: string[]; travelMode?: TravelMode }[] = []

  for (const assignment of suggestion.assignments) {
    const day = trip.days.find(d => d.id === assignment.dayId)
    if (!day || day.locked) continue

    const fullIds = [...day.stopIds, ...assignment.placeIds.filter(id => !day.stopIds.includes(id))]
    const lodging = trip.lodgings.find(l => l.id === day.lodgingId)
    const mode = assignment.travelModeOverride ?? day.travelMode ?? trip.prefs.travelMode

    let ordered = fullIds
    if (lodging && fullIds.length >= 2) {
      const coords: [number, number][] = [lodging.coord, ...fullIds.map(id => byId.get(id)!.coord)]
      // fixedTime reservations become ordering anchors (matrix index = stop
      // position + 1, since index 0 is the lodging).
      const anchorMinutes: Record<number, number> = {}
      fullIds.forEach((id, i) => {
        const t = byId.get(id)?.fixedTime
        if (t) {
          const [h, m] = t.split(':').map(Number)
          anchorMinutes[i + 1] = h * 60 + m
        }
      })
      try {
        const matrix = await getTravelMatrix(coords, mode)
        ordered = orderStops({ matrix: matrix.seconds, anchorMinutes }).map(i => fullIds[i - 1])
      } catch {
        // Aborted or failed — fall back to the cluster order; routing still runs.
        ordered = fullIds
      }
    }

    entries.push({
      dayId: assignment.dayId,
      placeIds: ordered,
      ...(assignment.travelModeOverride ? { travelMode: assignment.travelModeOverride } : {}),
    })
  }

  if (entries.length > 0) store.dispatch(applyDaySuggestions(entries))
}
