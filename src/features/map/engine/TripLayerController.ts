import type { Map as MapboxMap } from 'mapbox-gl'
import type { AppStore } from '../../../app/store'
import { selectDayBounds } from '../../trip/selectors'

export const PLACES_SOURCE = 'trip-places'
export const DAY_ROUTES_SOURCE = 'day-routes'
export const CLUSTERS_SOURCE = 'trip-clusters'
export const DAY_HULLS_SOURCE = 'day-hulls'
export const ISOCHRONE_SOURCE = 'trip-isochrone'

// Feature-state driver for the trip places layer, plus the day camera. The
// layer/source specs live in styleAugmentation (never here); this controller
// only translates ids into setFeatureState / camera calls.
export class TripLayerController {
  private map: MapboxMap
  private store: AppStore
  private hoveredId: string | null = null
  private selectedId: string | null = null

  constructor(map: MapboxMap, store: AppStore) {
    this.map = map
    this.store = store
  }

  private setState(id: string | null, key: 'hover' | 'selected', value: boolean): void {
    if (id === null || !this.map.getSource(PLACES_SOURCE)) return
    this.map.setFeatureState({ source: PLACES_SOURCE, id }, { [key]: value })
  }

  setHover(placeId: string | null): void {
    if (placeId === this.hoveredId) return
    this.setState(this.hoveredId, 'hover', false)
    this.hoveredId = placeId
    this.setState(this.hoveredId, 'hover', true)
  }

  setSelected(placeId: string | null): void {
    if (placeId === this.selectedId) return
    this.setState(this.selectedId, 'selected', false)
    this.selectedId = placeId
    this.setState(this.selectedId, 'selected', true)
  }

  // Frames a day: its stops plus the lodging that anchors it. Bounds come
  // from a trip selector — the controller stays Mapbox-only. Padding leaves
  // room for the planning panel so the framed day isn't hidden behind it
  // (left column on desktop, bottom sheet on mobile).
  focusDay(dayId: string | null): void {
    if (!dayId) return
    const bounds = selectDayBounds(this.store.getState(), dayId)
    if (!bounds) return
    const wide = window.innerWidth > 640
    const padding = wide
      ? { top: 70, right: 70, bottom: 70, left: 400 }
      : { top: 70, right: 40, bottom: 420, left: 40 }
    this.map.fitBounds(bounds, { padding, maxZoom: 15.5, duration: 900 })
  }

  // Feature-state is wiped when a source is re-added (e.g. HMR/style reset).
  reapply(): void {
    this.setState(this.hoveredId, 'hover', true)
    this.setState(this.selectedId, 'selected', true)
  }
}
