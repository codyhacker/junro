import { createSelector } from '@reduxjs/toolkit'
import type { LayerSpecification, SourceSpecification } from 'mapbox-gl'
import type { RootState } from '../../../app/store'

export interface AugmentationSpec {
  version: 8
  sources: Record<string, SourceSpecification>
  layers: LayerSpecification[]
  terrain?: { source: string; exaggeration: number }
}

// The single selector that derives every Junro source/layer from Redux state.
// The listener middleware diffs previous vs. next spec references and issues
// STYLE_RECONCILE; StyleController diffs at the Mapbox style-spec level.
// Never add data layers directly to MapEngine — add them here.
//
// NOTE (Mapbox Standard): custom layers must declare a `slot` ('bottom' |
// 'middle' | 'top') instead of relying on before-id ordering. Trip pins go in
// 'top', route lines in 'middle' (under labels), hulls/isochrones in 'bottom'.
//
// Phase 0: no data layers yet — just the DEM source + optional terrain.
export const selectAugmentationSpec = createSelector(
  [(s: RootState) => s.terrain.terrainExaggeration],
  (terrainExaggeration): AugmentationSpec => {
    const sources: Record<string, SourceSpecification> = {
      'mapbox-dem': {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      } as SourceSpecification,
    }

    const layers: LayerSpecification[] = []

    return {
      version: 8,
      sources,
      layers,
      ...(terrainExaggeration > 0
        ? { terrain: { source: 'mapbox-dem', exaggeration: terrainExaggeration } }
        : {}),
    }
  },
)
