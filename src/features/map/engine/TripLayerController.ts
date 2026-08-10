import type { Map as MapboxMap } from 'mapbox-gl'

export const PLACES_SOURCE = 'trip-places'

// Feature-state driver for the trip places layer. The layer/source specs
// live in styleAugmentation (never here); this controller only translates
// hover/select ids into setFeatureState calls.
export class TripLayerController {
  private map: MapboxMap
  private hoveredId: string | null = null
  private selectedId: string | null = null

  constructor(map: MapboxMap) {
    this.map = map
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

  // Feature-state is wiped when a source is re-added (e.g. HMR/style reset).
  reapply(): void {
    this.setState(this.hoveredId, 'hover', true)
    this.setState(this.selectedId, 'selected', true)
  }
}
