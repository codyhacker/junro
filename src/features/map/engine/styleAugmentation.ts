import { createSelector } from '@reduxjs/toolkit'
import type { LayerSpecification, SourceSpecification } from 'mapbox-gl'
import type { RootState } from '../../../app/store'
import type { SavedPlace } from '../../../shared/types/trip'
import { PLACES_SOURCE } from './TripLayerController'

export interface AugmentationSpec {
  version: 8
  sources: Record<string, SourceSpecification>
  layers: LayerSpecification[]
  terrain?: { source: string; exaggeration: number }
}

// The single selector that derives every Junro source/layer from Redux state.
// The listener middleware diffs previous vs. next spec references and issues
// STYLE_RECONCILE; StyleController diffs at the Mapbox style-spec level
// (place edits arrive as setGeoJSONSourceData ops — no layer churn).
// Never add data layers directly to engine code — add them here.
//
// NOTE (Mapbox Standard): custom layers must declare a `slot` ('bottom' |
// 'middle' | 'top') instead of relying on before-id ordering. Pins live in
// 'top', future route lines in 'middle', hulls/isochrones in 'bottom'.

const selectPlaces = (s: RootState): SavedPlace[] => s.trip.active?.places ?? []

const selectPlacesGeoJSON = createSelector([selectPlaces], (places) => ({
  type: 'FeatureCollection' as const,
  features: places.map(p => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: p.coord },
    properties: { id: p.id, name: p.name, category: p.category },
  })),
}))

export const selectAugmentationSpec = createSelector(
  [selectPlacesGeoJSON, (s: RootState) => s.terrain.terrainExaggeration],
  (placesGeoJSON, terrainExaggeration): AugmentationSpec => {
    const sources: Record<string, SourceSpecification> = {
      'mapbox-dem': {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      } as SourceSpecification,
      [PLACES_SOURCE]: {
        type: 'geojson',
        data: placesGeoJSON,
        promoteId: 'id',       // UUID property → feature id, for feature-state
      } as SourceSpecification,
    }

    const layers: LayerSpecification[] = [
      // Hover/selection halo — a soft disc under the pin, feature-state driven.
      {
        id: 'places-halo',
        type: 'circle',
        source: PLACES_SOURCE,
        slot: 'top',
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], 22,
            ['boolean', ['feature-state', 'hover'], false], 18,
            0,
          ],
          'circle-color': '#d6583e',
          'circle-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], 0.28,
            ['boolean', ['feature-state', 'hover'], false], 0.18,
            0,
          ],
          'circle-blur': 0.4,
        },
      } as LayerSpecification,
      {
        id: 'places-pins',
        type: 'symbol',
        source: PLACES_SOURCE,
        slot: 'top',
        layout: {
          'icon-image': ['concat', 'junro-pin-', ['get', 'category']],
          'icon-anchor': 'bottom',
          'icon-size': [
            'interpolate', ['linear'], ['zoom'],
            8, 0.62, 13, 0.8, 16, 1,
          ],
          'icon-allow-overlap': true,
          'text-field': ['get', 'name'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 11.5,
          'text-anchor': 'top',
          'text-offset': [0, 0.35],
          'text-optional': true,
        },
        paint: {
          'text-color': '#3c332b',
          'text-halo-color': 'rgba(255, 253, 248, 0.95)',
          'text-halo-width': 1.3,
        },
        minzoom: 8,
      } as LayerSpecification,
    ]

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
