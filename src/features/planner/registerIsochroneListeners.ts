import { startAppListening } from '../../app/listenerMiddleware'
import type { RootState } from '../../app/store'
import { fetchIsochrone, isochroneKey } from './isochroneService'
import { isochroneLoaded } from './isochroneSlice'

// Fetches walking-reach polygons whenever the shading is on and the origin
// hotel (or the trip's first lodging) differs from what's loaded. Service +
// listener seam: the engine never fetches, and the polygons reach the map
// through the slice + selectAugmentationSpec.

function firstLodgingCoord(state: RootState): [number, number] | null {
  return state.trip.active?.lodgings[0]?.coord ?? null
}

export function registerIsochroneListeners(): () => void {
  return startAppListening({
    predicate: (_action, current) => {
      if (!current.isochrone.visible) return false
      const origin = firstLodgingCoord(current)
      return !!origin && isochroneKey(origin) !== current.isochrone.key
    },
    effect: async (_action, api) => {
      api.cancelActiveListeners()
      const origin = firstLodgingCoord(api.getState())
      if (!origin) return
      const key = isochroneKey(origin)
      try {
        const data = await fetchIsochrone(origin, 'walking')
        // Guard against a toggle-off that raced the fetch.
        if (data && api.getState().isochrone.visible) api.dispatch(isochroneLoaded({ key, data }))
      } catch {
        // Offline / API error — no shading, non-fatal.
      }
    },
  })
}
