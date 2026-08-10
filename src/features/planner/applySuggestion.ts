import type { AppStore } from '../../app/store'
import type { SavedPlace } from '../../shared/types/trip'
import { setDayStops, setDayTravelMode } from '../trip/tripSlice'
import { getTravelMatrix } from './matrixService'
import { orderStops } from './ordering'
import type { Suggestion } from './suggest'

// Applies a Stage-2 suggestion: for each proposed day, merge its new places
// with anything already there, run Stage-3 ordering over [lodging, …stops]
// (which the Matrix service resolves, or haversine offline), and commit the
// optimized order. Async because the matrix is a network call; the existing
// routing listeners then redraw each day from the new order.
export async function applySuggestion(store: AppStore, suggestion: Suggestion): Promise<void> {
  const trip = store.getState().trip.active
  if (!trip) return
  const byId = new Map<string, SavedPlace>(trip.places.map(p => [p.id, p]))

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

    store.dispatch(setDayStops({ dayId: assignment.dayId, placeIds: ordered }))
    if (assignment.travelModeOverride) {
      store.dispatch(setDayTravelMode({ dayId: assignment.dayId, mode: assignment.travelModeOverride }))
    }
  }
}
