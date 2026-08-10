import { startAppListening } from '../../app/listenerMiddleware'
import type { AppStore } from '../../app/store'
import { getTripStorage } from './storage'
import { tripHydrated } from './tripSlice'
import { flyTo } from '../map/cameraSlice'

// Boot hydration: read the index, load the most recent trip, hand both to
// Redux. Called once from main.tsx.
export async function hydrateTrips(store: AppStore): Promise<void> {
  const storage = getTripStorage()
  const summaries = await storage.list()
  const active = summaries.length > 0 ? await storage.load(summaries[0].id) : null
  store.dispatch(tripHydrated({ summaries, active }))
  // Returning users land on their destination, not the world globe.
  if (active) {
    store.dispatch(flyTo({ center: active.destination.center, zoom: 11.5, duration: 0 }))
  }
}

// Persistence listener: any mutation of the active trip document schedules a
// debounced save through the storage adapter. `cancelActiveListeners` +
// `delay` coalesces rapid edits into one write per 400 ms — the same rhythm
// as the prefs writer in store.ts.
export function registerTripPersistence(): () => void {
  const unsub = startAppListening({
    predicate: (_action, currentState, previousState) =>
      currentState.trip.active !== null &&
      currentState.trip.active !== previousState.trip.active &&
      previousState.trip.hydrated,   // don't re-save what hydration just loaded
    effect: async (_action, api) => {
      api.cancelActiveListeners()
      await api.delay(400)
      const active = api.getState().trip.active
      if (active) await getTripStorage().save(active)
    },
  })
  return unsub
}
