import mapboxgl from 'mapbox-gl'
// Have Vite bundle Mapbox's worker as a real module (with a stable URL it
// controls) instead of letting Mapbox stringify + Blob-URL its inlined worker
// source. The blob path picks up Vite's dev-mode HMR helpers (e.g.
// `__vite__injectQuery`) which then crash inside the worker context where
// those helpers don't exist. Same workaround documented in
// https://github.com/mapbox/mapbox-gl-js/issues/12656.
import MapboxWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker?worker'

;(mapboxgl as unknown as { workerClass: typeof Worker }).workerClass = MapboxWorker as unknown as typeof Worker
import type { AppStore } from '../../../app/store'
import { cameraObserved } from '../cameraSlice'
import { getPalette, applyUiTheme, lightPresetFor } from '../../../shared/constants/uiThemes'
import type { MapCommand } from './commands'
import { StyleController } from './StyleController'
import { TripLayerController } from './TripLayerController'
import { registerPointerRouter } from './pointer/registerPointerRouter'
import { placesLayer } from './pointer/layers/places'

export class MapEngine {
  private map: mapboxgl.Map
  private store: AppStore

  private style: StyleController
  private tripLayer: TripLayerController
  private unsubPointer: () => void

  constructor(container: HTMLDivElement, store: AppStore) {
    this.store = store
    const state = store.getState()

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''

    applyUiTheme(getPalette(state.mapStyle.uiMode))

    this.map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/standard',
      // Standard's config option — set the light preset before first paint so
      // dark-mode users never flash a daylight basemap. Not in the installed
      // type defs yet, hence the cast.
      ...({
        config: {
          basemap: {
            lightPreset: lightPresetFor(state.mapStyle.uiMode),
            showPointOfInterestLabels: false,
          },
        },
      } as object),
      center: [2.35, 48.86],
      zoom: 1.8,
      attributionControl: false,
    })

    this.style = new StyleController(this.map, store)
    this.tripLayer = new TripLayerController(this.map, store)

    this.unsubPointer = registerPointerRouter(this.map, store, [placesLayer])

    this.map.on('moveend', () => {
      const { lng, lat } = this.map.getCenter()
      this.store.dispatch(cameraObserved({
        center: [lng, lat],
        zoom: this.map.getZoom(),
        bearing: this.map.getBearing(),
        pitch: this.map.getPitch(),
      }))
    })

    if (import.meta.env.DEV) {
      ;(window as unknown as { __engine?: MapEngine; __store?: AppStore }).__engine = this
      ;(window as unknown as { __engine?: MapEngine; __store?: AppStore }).__store = store
    }
  }

  getMap(): mapboxgl.Map {
    return this.map
  }

  destroy(): void {
    this.unsubPointer()
    this.map.remove()
  }

  // ─── Command dispatcher ──────────────────────────────────────────────────

  execute(cmd: MapCommand): void {
    switch (cmd.type) {
      case 'STYLE_RECONCILE':
      case 'UI_THEME_CHANGE':
        return this.style.execute(cmd)
      case 'FLY_TO':               return void this.map.flyTo(cmd.options as mapboxgl.EasingOptions)
      case 'FIT_BOUNDS':           return void this.map.fitBounds(cmd.bounds, cmd.options)
      case 'EASE_TO':              return void this.map.easeTo(cmd.options as mapboxgl.EasingOptions & { duration?: number })
      case 'PLACE_HOVER':          return this.tripLayer.setHover(cmd.placeId)
      case 'PLACE_SELECT':         return this.tripLayer.setSelected(cmd.placeId)
      case 'DAY_FOCUS':            return this.tripLayer.focusDay(cmd.dayId)
      case 'UPDATE_GEOJSON':       break
      case 'ADD_LAYER':            break
      case 'REMOVE_LAYER':         break
      case 'SET_LAYER_VISIBILITY': break
      default: {
        const _exhaustive: never = cmd
        console.warn('Unhandled MapCommand', _exhaustive)
      }
    }
  }
}
