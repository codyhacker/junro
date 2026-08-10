import type {
  Map as MapboxMap,
  AnySourceData,
  AnyLayer,
  FilterSpecification,
  TerrainSpecification,
} from 'mapbox-gl'
import { diff } from '@mapbox/mapbox-gl-style-spec'
import type { AppStore } from '../../../app/store'
import { getPalette, applyUiTheme, lightPresetFor, type UiMode } from '../../../shared/constants/uiThemes'
import { selectAugmentationSpec, type AugmentationSpec } from './styleAugmentation'
import { registerPinIcons } from './icons'

// Standard's config API isn't in the installed type defs yet.
type StandardMap = MapboxMap & {
  setConfigProperty(importId: string, name: string, value: unknown): void
}

export class StyleController {
  private map: StandardMap
  private store: AppStore
  private currentAugmentation: AugmentationSpec | null = null

  // True once the first 'load' has fired. Used in place of
  // `map.isStyleLoaded()` because the latter can return false long after the
  // style is actually usable.
  private styleReady = false

  constructor(map: MapboxMap, store: AppStore) {
    this.map = map as StandardMap
    this.store = store

    this.map.on('load', () => {
      this.styleReady = true
      // Reconcile config to whatever mode the store holds by the time the
      // style settles (a toggle during load would otherwise be lost — the
      // UI_THEME_CHANGE handler is gated on styleReady).
      this.applyStandardConfig(this.store.getState().mapStyle.uiMode)
      registerPinIcons(this.map)
      this.reconcile(selectAugmentationSpec(this.store.getState()))
    })
    // Safety net: if a symbol layer references a pin before its image has
    // decoded, re-kick registration (idempotent).
    this.map.on('styleimagemissing', () => registerPinIcons(this.map))
  }

  execute(cmd:
    | { type: 'STYLE_RECONCILE'; spec: AugmentationSpec }
    | { type: 'UI_THEME_CHANGE'; mode: UiMode }
  ): void {
    switch (cmd.type) {
      case 'STYLE_RECONCILE': return this.reconcile(cmd.spec)
      case 'UI_THEME_CHANGE': return this.handleModeChange(cmd.mode)
    }
  }

  private handleModeChange(mode: UiMode): void {
    applyUiTheme(getPalette(mode))
    // Basemap follows via setConfigProperty — no style reload, augmentation
    // layers survive untouched. If the style hasn't settled yet the 'load'
    // handler above re-reads the live mode.
    if (!this.styleReady) return
    this.applyStandardConfig(mode)
  }

  private applyStandardConfig(mode: UiMode): void {
    this.map.setConfigProperty('basemap', 'lightPreset', lightPresetFor(mode))
    // Standard's own POI icons must never compete with Junro pins
    // (PROJECT_PLAN.md §3 basemap decision).
    this.map.setConfigProperty('basemap', 'showPointOfInterestLabels', false)
  }

  private reconcile(next: AugmentationSpec): void {
    if (!this.styleReady) return
    if (!this.currentAugmentation) {
      for (const [id, source] of Object.entries(next.sources)) {
        if (!this.map.getSource(id)) this.map.addSource(id, source as AnySourceData)
      }
      if (next.terrain) this.map.setTerrain(next.terrain)
      for (const layer of next.layers) {
        if (!this.map.getLayer(layer.id)) this.map.addLayer(layer as AnyLayer)
      }
    } else {
      const ops = diff(
        { glyphs: '', ...this.currentAugmentation },
        { glyphs: '', ...next }
      )
      for (const op of ops) this.applyOperation(op)
    }
    this.currentAugmentation = next
  }

  private applyOperation(op: { command: string; args: unknown[] }): void {
    const m = this.map
    const [a0, a1, a2] = op.args

    switch (op.command) {
      case 'setPaintProperty':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        m.setPaintProperty(a0 as string, a1 as any, a2)
        break
      case 'setLayoutProperty':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        m.setLayoutProperty(a0 as string, a1 as any, a2)
        break
      case 'setFilter':
        m.setFilter(a0 as string, a1 as FilterSpecification | null)
        break
      case 'setTerrain':
        m.setTerrain((a0 as TerrainSpecification) ?? null)
        break
      case 'addLayer':
        if (!m.getLayer((a0 as AnyLayer).id)) {
          m.addLayer(a0 as AnyLayer, (a1 as string) ?? undefined)
        }
        break
      case 'removeLayer':
        if (m.getLayer(a0 as string)) m.removeLayer(a0 as string)
        break
      case 'addSource':
        if (!m.getSource(a0 as string)) m.addSource(a0 as string, a1 as AnySourceData)
        break
      case 'removeSource':
        if (m.getSource(a0 as string)) m.removeSource(a0 as string)
        break
      case 'setLayerZoomRange':
        m.setLayerZoomRange(a0 as string, a1 as number, a2 as number)
        break
      case 'setGeoJSONSourceData': {
        const src = m.getSource(a0 as string)
        if (src && 'setData' in src) {
          ;(src as { setData(d: unknown): void }).setData(a1)
        }
        break
      }
    }
  }
}
