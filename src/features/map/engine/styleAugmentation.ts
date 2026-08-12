import { createSelector } from '@reduxjs/toolkit'
import type { LayerSpecification, SourceSpecification, ExpressionSpecification } from 'mapbox-gl'
import type { RootState } from '../../../app/store'
import { getPalette } from '../../../shared/constants/uiThemes'
import { dayColorAt } from '../../../shared/constants/dayColors'
import { selectDays, selectPlaceDayHex, selectPlaces } from '../../trip/selectors'
import {
  selectDayRouteRequests,
  selectClusterHullsGeoJSON,
  selectDayHullsGeoJSON,
} from '../../planner/selectors'
import { ISOCHRONE_MINUTES } from '../../planner/isochroneService'
import {
  PLACES_SOURCE,
  DAY_ROUTES_SOURCE,
  CLUSTERS_SOURCE,
  DAY_HULLS_SOURCE,
  ISOCHRONE_SOURCE,
  PENDING_SOURCE,
  DISCOVERY_SOURCE,
} from './TripLayerController'
import { PIN_COLORS } from './icons'
import {
  PLACES_PMTILES_URL,
  DISCOVERY_SOURCE_LAYER,
  DISCOVERY_MIN_ZOOM,
} from '../../../shared/constants/discovery'
import { OVERTURE_PLACE_CATEGORIES } from '../../../shared/constants/overturePlaceCategories'
import type { PlaceCategory } from '../../../shared/types/trip'

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] }

// Colour a discovery dot by mapping its raw Overture `category` down to a
// SavedPlace bucket and reusing that bucket's pin colour — so a discovery dot
// and the saved pin it can become share one hue. Built once (static).
const DISCOVERY_COLOR: ExpressionSpecification = (() => {
  const byPlace: Record<PlaceCategory, string[]> = {
    restaurant: [],
    cafe: [],
    sight: [],
    shop: [],
    other: [],
  }
  for (const e of OVERTURE_PLACE_CATEGORIES) byPlace[e.toPlaceCategory].push(e.category)
  const branches: (string | string[])[] = []
  for (const pc of ['restaurant', 'cafe', 'sight', 'shop'] as const) {
    if (byPlace[pc].length > 0) branches.push(byPlace[pc], PIN_COLORS[pc])
  }
  return [
    'match',
    ['get', 'category'],
    ...branches,
    PIN_COLORS.other,
  ] as unknown as ExpressionSpecification
})()

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
const selectPlacesGeoJSON = createSelector([selectPlaces, selectPlaceDayHex], (places, dayHex) => ({
  type: 'FeatureCollection' as const,
  features: places.map((p) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: p.coord },
    properties: {
      id: p.id,
      name: p.name,
      category: p.category,
      ...(dayHex[p.id] ? { dayColor: dayHex[p.id] } : {}),
    },
  })),
}))

// One feature per routed day, carrying the day's colors. Routing is a per-day
// pull-up (UX_PLAN.md WS4): only the *selected* day's route draws — routing is
// available but never the central visual. A day appears only when its stored
// route matches what it currently asks for — a stale/missing route draws nothing.
const selectDayRoutesGeoJSON = createSelector(
  [
    selectDayRouteRequests,
    (s: RootState) => s.planner.dayRoutes,
    selectDays,
    (s: RootState) => s.mapStyle.uiMode,
    (s: RootState) => s.tripInteraction.selectedDayId,
  ],
  (requests, dayRoutes, days, uiMode, selectedDayId) => {
    const indexByDayId = new Map(days.map((d, i) => [d.id, i]))
    return {
      type: 'FeatureCollection' as const,
      features: requests.flatMap((req) => {
        if (req.dayId !== selectedDayId) return []
        const route = dayRoutes[req.dayId]
        if (!route || route.hash !== req.hash) return []
        const color = dayColorAt(indexByDayId.get(req.dayId) ?? 0)
        return [
          {
            type: 'Feature' as const,
            geometry: route.geometry,
            properties: {
              dayId: req.dayId,
              dayColor: uiMode === 'dark' ? color.dark : color.light,
              casingColor: color.casing,
            },
          },
        ]
      }),
    }
  },
)

// The place being previewed in the add flow (0 or 1 feature). Rendered with an
// emphasized halo so it reads as "not saved yet, here's where it'll go".
const selectPendingGeoJSON = createSelector(
  [(s: RootState) => s.tripInteraction.pendingPlace],
  (pending) => ({
    type: 'FeatureCollection' as const,
    features: pending
      ? [
          {
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: pending.coord },
            properties: { category: pending.category },
          },
        ]
      : [],
  }),
)

export const selectAugmentationSpec = createSelector(
  [
    selectPlacesGeoJSON,
    selectPendingGeoJSON,
    selectDayRoutesGeoJSON,
    selectClusterHullsGeoJSON,
    selectDayHullsGeoJSON,
    (s: RootState) => s.isochrone.data,
    (s: RootState) => s.terrain.terrainExaggeration,
    (s: RootState) => s.mapStyle.uiMode,
    (s: RootState) => s.discovery.visible,
  ],
  (
    placesGeoJSON,
    pendingGeoJSON,
    dayRoutesGeoJSON,
    clusterHullsGeoJSON,
    dayHullsGeoJSON,
    isochroneData,
    terrainExaggeration,
    uiMode,
    discoveryVisible,
  ): AugmentationSpec => {
    const palette = getPalette(uiMode)
    const showDiscovery = discoveryVisible && PLACES_PMTILES_URL.length > 0
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
      [DAY_HULLS_SOURCE]: {
        type: 'geojson',
        data: dayHullsGeoJSON,
      } as SourceSpecification,
      [PLACES_SOURCE]: {
        type: 'geojson',
        data: placesGeoJSON,
        promoteId: 'id', // UUID property → feature id, for feature-state
      } as SourceSpecification,
      [DAY_ROUTES_SOURCE]: {
        type: 'geojson',
        data: dayRoutesGeoJSON,
      } as SourceSpecification,
      [PENDING_SOURCE]: {
        type: 'geojson',
        data: pendingGeoJSON,
      } as SourceSpecification,
      // Overture discovery POIs — a single .pmtiles archive on R2 served over
      // range requests (Mapbox v3 native PMTiles; declared only when the layer
      // is on so it's not fetched otherwise).
      ...(showDiscovery
        ? {
            [DISCOVERY_SOURCE]: {
              type: 'vector',
              url: PLACES_PMTILES_URL,
              promoteId: 'id',
            } as SourceSpecification,
          }
        : {}),
    }

    // Discovery layers, split so saved-place pins + labels always win: the dots
    // sit under the saved halo/pins; the labels are placed after them.
    const discoveryDots: LayerSpecification[] = showDiscovery
      ? [
          {
            id: 'discovery-dots',
            type: 'circle',
            source: DISCOVERY_SOURCE,
            'source-layer': DISCOVERY_SOURCE_LAYER,
            slot: 'top',
            minzoom: DISCOVERY_MIN_ZOOM,
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3, 16, 5.5, 18, 7],
              'circle-color': DISCOVERY_COLOR,
              'circle-opacity': 0.9,
              'circle-stroke-color': `rgba(${palette.bgRichRgb}, 0.92)`,
              'circle-stroke-width': 1.4,
            },
          } as LayerSpecification,
        ]
      : []
    const discoveryLabels: LayerSpecification[] = showDiscovery
      ? [
          {
            id: 'discovery-labels',
            type: 'symbol',
            source: DISCOVERY_SOURCE,
            'source-layer': DISCOVERY_SOURCE_LAYER,
            slot: 'top',
            minzoom: 15,
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
              'text-size': 11,
              'text-anchor': 'top',
              'text-offset': [0, 0.5],
              'text-optional': true,
              'symbol-sort-key': ['-', 1, ['coalesce', ['get', 'confidence'], 0]],
            },
            paint: {
              'text-color': uiMode === 'dark' ? '#cfc8bd' : '#5a5148',
              'text-halo-color': `rgba(${palette.bgRichRgb}, 0.95)`,
              'text-halo-width': 1.2,
              'text-opacity': 0.9,
            },
          } as LayerSpecification,
        ]
      : []

    const layers: LayerSpecification[] = [
      // Reachability shading — concentric walking-time bands from the hotel,
      // slot 'bottom' and first in the array so they sit beneath the hulls.
      // One fill per contour (largest first): the nested polygons overlap, so
      // separate low-opacity layers composite into a "closer = deeper" wash.
      // Pine, freed up now that hulls wear the day colors.
      ...[...ISOCHRONE_MINUTES]
        .sort((a, b) => b - a)
        .map(
          (minutes) =>
            ({
              id: `isochrone-${minutes}`,
              type: 'fill',
              source: ISOCHRONE_SOURCE,
              slot: 'bottom',
              filter: ['==', ['get', 'contour'], minutes],
              paint: {
                'fill-color': palette.accentWarmHex,
                'fill-opacity': 0.09,
              },
            }) as LayerSpecification,
        ),
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
          'fill-opacity': 0.09, // lighter than a planned day — "to plan"
        },
      } as LayerSpecification,
      {
        id: 'cluster-hull-outline',
        type: 'line',
        source: CLUSTERS_SOURCE,
        slot: 'bottom',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1.5,
          'line-opacity': 0.55,
          'line-dasharray': [2, 2], // dashed = unplanned, vs the solid day circles
        },
      } as LayerSpecification,
      // Day-group hulls — the always-on grouping visual for the planned state:
      // a soft day-colored region around each day's stops, so a day reads as a
      // neighborhood (UX_PLAN.md WS4). The selected day lifts (deeper fill +
      // stronger outline) to tie the map to the sidebar. Above the cluster
      // hulls, still slot 'bottom' (beneath pins + routes).
      {
        id: 'day-hull-fill',
        type: 'fill',
        source: DAY_HULLS_SOURCE,
        slot: 'bottom',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['==', ['get', 'selected'], 1], 0.28, 0.14],
        },
      } as LayerSpecification,
      {
        id: 'day-hull-outline',
        type: 'line',
        source: DAY_HULLS_SOURCE,
        slot: 'bottom',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['==', ['get', 'selected'], 1], 2.5, 1.5],
          'line-opacity': ['case', ['==', ['get', 'selected'], 1], 0.9, 0.55],
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
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 6, 17, 8.5],
          'line-border-color': ['get', 'casingColor'],
          'line-border-width': 1.2,
          // Dark basemaps mute the fill (QA: gold read as olive), so the
          // colored line runs near-opaque there and lighter over the day map.
          'line-opacity': uiMode === 'dark' ? 0.95 : 0.8,
        },
      } as LayerSpecification,
      // Discovery dots — under the saved-place halo/pins so saved wins.
      ...discoveryDots,
      // Hover/selection halo — a soft disc under the pin, feature-state driven.
      {
        id: 'places-halo',
        type: 'circle',
        source: PLACES_SOURCE,
        slot: 'top',
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            22,
            ['boolean', ['feature-state', 'hover'], false],
            18,
            0,
          ],
          'circle-color': '#d6583e',
          'circle-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.28,
            ['boolean', ['feature-state', 'hover'], false],
            0.18,
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
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4.5, 13, 6, 16, 7.5],
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
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.62, 13, 0.8, 16, 1],
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
      // Discovery labels — after the saved pins so a saved place's name wins
      // any collision; only from z15 to keep the map quiet.
      ...discoveryLabels,
      // Pending-place preview (add flow) — an accent halo under the category
      // pin so the spot is visible before it's saved. Sits above the saved
      // pins so it's never hidden in a cluster.
      {
        id: 'pending-halo',
        type: 'circle',
        source: PENDING_SOURCE,
        slot: 'top',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 14, 13, 20, 16, 26],
          'circle-color': palette.accentHex,
          'circle-opacity': 0.2,
          'circle-stroke-color': palette.accentHex,
          'circle-stroke-width': 2,
          'circle-stroke-opacity': 0.85,
        },
      } as LayerSpecification,
      {
        id: 'pending-pin',
        type: 'symbol',
        source: PENDING_SOURCE,
        slot: 'top',
        layout: {
          'icon-image': ['concat', 'junro-pin-', ['get', 'category']],
          'icon-anchor': 'bottom',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.68, 13, 0.88, 16, 1.1],
          'icon-allow-overlap': true,
        },
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
