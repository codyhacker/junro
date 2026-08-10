import { createSelector } from '@reduxjs/toolkit'
import type { LayerSpecification, SourceSpecification } from 'mapbox-gl'
import type { RootState } from '../../../app/store'
import { getPalette } from '../../../shared/constants/uiThemes'
import { dayColorAt } from '../../../shared/constants/dayColors'
import { selectDays, selectPlaceDayHex, selectPlaces } from '../../trip/selectors'
import { selectDayRouteRequests, selectClusterHullsGeoJSON } from '../../planner/selectors'
import { ISOCHRONE_MINUTES } from '../../planner/isochroneService'
import { PLACES_SOURCE, DAY_ROUTES_SOURCE, CLUSTERS_SOURCE, ISOCHRONE_SOURCE } from './TripLayerController'

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] }

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
// 'top', route lines in 'middle' (under labels), hulls/isochrones in 'bottom'.

// `dayColor` is present only on assigned places — the ring layer filters on
// it, so unassigned pins simply have no ring.
const selectPlacesGeoJSON = createSelector(
  [selectPlaces, selectPlaceDayHex],
  (places, dayHex) => ({
    type: 'FeatureCollection' as const,
    features: places.map(p => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: p.coord },
      properties: {
        id: p.id,
        name: p.name,
        category: p.category,
        ...(dayHex[p.id] ? { dayColor: dayHex[p.id] } : {}),
      },
    })),
  }),
)

// One feature per routed day, carrying the day's colors. A day appears only
// when the stored route matches what the day currently asks for — a stale or
// missing route draws nothing rather than a lie (PROJECT_PLAN.md §8 Phase 3).
const selectDayRoutesGeoJSON = createSelector(
  [
    selectDayRouteRequests,
    (s: RootState) => s.planner.dayRoutes,
    selectDays,
    (s: RootState) => s.mapStyle.uiMode,
  ],
  (requests, dayRoutes, days, uiMode) => {
    const indexByDayId = new Map(days.map((d, i) => [d.id, i]))
    return {
      type: 'FeatureCollection' as const,
      features: requests.flatMap(req => {
        const route = dayRoutes[req.dayId]
        if (!route || route.hash !== req.hash) return []
        const color = dayColorAt(indexByDayId.get(req.dayId) ?? 0)
        return [{
          type: 'Feature' as const,
          geometry: route.geometry,
          properties: {
            dayId: req.dayId,
            dayColor: uiMode === 'dark' ? color.dark : color.light,
            casingColor: color.casing,
          },
        }]
      }),
    }
  },
)

export const selectAugmentationSpec = createSelector(
  [
    selectPlacesGeoJSON,
    selectDayRoutesGeoJSON,
    selectClusterHullsGeoJSON,
    (s: RootState) => s.isochrone.data,
    (s: RootState) => s.terrain.terrainExaggeration,
    (s: RootState) => s.mapStyle.uiMode,
  ],
  (placesGeoJSON, dayRoutesGeoJSON, clusterHullsGeoJSON, isochroneData, terrainExaggeration, uiMode): AugmentationSpec => {
    const palette = getPalette(uiMode)
    const sources: Record<string, SourceSpecification> = {
      'mapbox-dem': {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      } as SourceSpecification,
      [ISOCHRONE_SOURCE]: {
        type: 'geojson',
        data: isochroneData ?? EMPTY_FC,
      } as SourceSpecification,
      [CLUSTERS_SOURCE]: {
        type: 'geojson',
        data: clusterHullsGeoJSON,
      } as SourceSpecification,
      [PLACES_SOURCE]: {
        type: 'geojson',
        data: placesGeoJSON,
        promoteId: 'id',       // UUID property → feature id, for feature-state
      } as SourceSpecification,
      [DAY_ROUTES_SOURCE]: {
        type: 'geojson',
        data: dayRoutesGeoJSON,
      } as SourceSpecification,
    }

    const layers: LayerSpecification[] = [
      // Reachability shading — concentric walking-time bands from the hotel,
      // slot 'bottom' and first in the array so they sit beneath the hulls.
      // One fill per contour (largest first): the nested polygons overlap, so
      // separate low-opacity layers composite into a "closer = deeper" wash.
      // Pine, freed up now that hulls wear the day colors.
      ...[...ISOCHRONE_MINUTES].sort((a, b) => b - a).map(minutes => ({
        id: `isochrone-${minutes}`,
        type: 'fill',
        source: ISOCHRONE_SOURCE,
        slot: 'bottom',
        filter: ['==', ['get', 'contour'], minutes],
        paint: {
          'fill-color': palette.accentWarmHex,
          'fill-opacity': 0.09,
        },
      } as LayerSpecification)),
      // Neighborhood hulls — slot 'bottom', beneath everything, as a soft
      // ambient "your unassigned pins form these neighborhoods" cue. Each hull
      // is tinted from the day-color ramp (per-cluster `color`) so the
      // neighborhoods read as the days they'll likely become.
      {
        id: 'cluster-hull-fill',
        type: 'fill',
        source: CLUSTERS_SOURCE,
        slot: 'bottom',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.16,
        },
      } as LayerSpecification,
      {
        id: 'cluster-hull-outline',
        type: 'line',
        source: CLUSTERS_SOURCE,
        slot: 'bottom',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1.75,
          'line-opacity': 0.65,
        },
      } as LayerSpecification,
      // Day routes — slot 'middle' keeps them under the basemap's labels but
      // over its fills. The casing is the line's own `line-border` (Mapbox GL
      // v3), so there's no second layer whose z-order the reconcile diff could
      // invert — a real bug in the earlier two-layer version where the dark
      // casing ended up painting over the colored line.
      {
        id: 'day-routes-line',
        type: 'line',
        source: DAY_ROUTES_SOURCE,
        slot: 'middle',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'dayColor'],
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            10, 3.5, 14, 6, 17, 8.5,
          ],
          'line-border-color': ['get', 'casingColor'],
          'line-border-width': 1.2,
          // Dark basemaps mute the fill (QA: gold read as olive), so the
          // colored line runs near-opaque there and lighter over the day map.
          'line-opacity': uiMode === 'dark' ? 0.95 : 0.8,
        },
      } as LayerSpecification,
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
      // Day-color ring — a colored disc at the pin's anchor point, so an
      // assigned pin wears its day at a glance (PROJECT_PLAN.md §8 Phase 2).
      {
        id: 'places-day-ring',
        type: 'circle',
        source: PLACES_SOURCE,
        slot: 'top',
        filter: ['has', 'dayColor'],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            8, 4.5, 13, 6, 16, 7.5,
          ],
          'circle-color': ['get', 'dayColor'],
          'circle-opacity': 0.95,
          'circle-stroke-color': `rgba(${palette.bgRichRgb}, 0.95)`,
          'circle-stroke-width': 1.6,
        },
        minzoom: 8,
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
