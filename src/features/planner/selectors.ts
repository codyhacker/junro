import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'
import type { TravelMode } from '../../shared/types/trip'
import { DEFAULT_PREFS } from '../../shared/types/trip'
import {
  dayCoords,
  selectDays,
  selectLodgings,
  selectPlaces,
  selectUnassignedPlaces,
} from '../trip/selectors'
import { clusterPlaces, buildAreaCircle, type ClusterResult } from './clustering'
import { dayColorAt } from '../../shared/constants/dayColors'
import { routeHash } from './routeHash'

// What each day *wants* routed, derived purely from the trip document. The
// routing listener compares each request's hash against what the planner
// already holds, so exactly the day whose content changed refetches.

export interface DayRouteRequest {
  dayId: string
  coords: [number, number][]
  mode: TravelMode
  hash: string
}

const selectTripMode = (s: RootState): TravelMode =>
  s.trip.active?.prefs.travelMode ?? DEFAULT_PREFS.travelMode

// Effective mode = day override, else the trip default.
export const selectDayRouteRequests = createSelector(
  [selectDays, selectPlaces, selectLodgings, selectTripMode],
  (days, places, lodgings, tripMode): DayRouteRequest[] =>
    days
      // A day with no stops has nothing to route — [lodging, lodging] would
      // otherwise produce a nonsense 1-minute self-route (found in review).
      .filter((day) => day.stopIds.length > 0)
      .map((day) => {
        const coords = dayCoords(day, places, lodgings)
        const mode = day.travelMode ?? tripMode
        return { dayId: day.id, coords, mode, hash: routeHash(coords, mode) }
      })
      // …and at least an origin and a destination overall.
      .filter((req) => req.coords.length >= 2),
)

export const selectRequestByDayId = createSelector(
  [selectDayRouteRequests],
  (requests) => new Map(requests.map((r) => [r.dayId, r])),
)

// ── Stage 1: neighborhood clustering (pure, no I/O) ─────────────────────────
// Clusters the *unassigned* pool — the pins still waiting to be planned — so
// the hulls read as "here are your neighborhoods to place," shrinking as you
// assign. This same result feeds the "Suggest days" flow (Stage 2).
const NO_CLUSTERS: ClusterResult = { clusters: [], excursions: [] }

export const selectClusters = createSelector(
  [selectUnassignedPlaces, (s: RootState) => s.trip.active?.destination.center],
  (places, center): ClusterResult =>
    center
      ? clusterPlaces(
          places.map((p) => ({ id: p.id, coord: p.coord })),
          center,
        )
      : NO_CLUSTERS,
)

// Day-group hulls — a soft day-colored region around each planned day's stops,
// so a *day is a neighborhood* on the map (UX_PLAN.md WS4). This is the
// always-on grouping visual for the planned state (the cluster hulls below
// cover the still-unassigned pool). The selected day's hull lifts.
export const selectDayHullsGeoJSON = createSelector(
  [
    selectDays,
    selectPlaces,
    (s: RootState) => s.mapStyle.uiMode,
    (s: RootState) => s.tripInteraction.selectedDayId,
  ],
  (days, places, uiMode, selectedDayId) => {
    const byId = new Map(places.map((p) => [p.id, p]))
    return {
      type: 'FeatureCollection' as const,
      features: days.flatMap((day, i) => {
        const coords = day.stopIds
          .map((id) => byId.get(id)?.coord)
          .filter((c): c is [number, number] => !!c)
        if (coords.length < 2) return [] // a single stop isn't a region
        const hull = buildAreaCircle(coords)
        if (!hull) return []
        const color = dayColorAt(i)
        return [
          {
            type: 'Feature' as const,
            geometry: hull,
            properties: {
              dayId: day.id,
              color: uiMode === 'dark' ? color.dark : color.light,
              selected: day.id === selectedDayId ? 1 : 0,
            },
          },
        ]
      }),
    }
  },
)

// Soft neighborhood blobs for the map — only clusters of 2+ pins earn a hull
// (a lone pin isn't a neighborhood). Each cluster is tinted from the day-color
// ramp by its index, so neighborhoods speak the same colour language as days,
// pins, and routes (and a suggestion that assigns clusters in order lands each
// on the matching day colour). Local + excursion alike.
export const selectClusterHullsGeoJSON = createSelector(
  [selectClusters, (s: RootState) => s.mapStyle.uiMode],
  ({ clusters, excursions }, uiMode) => ({
    type: 'FeatureCollection' as const,
    features: [...clusters, ...excursions]
      .map((c, i) => ({ c, color: dayColorAt(i) }))
      .filter(({ c }) => c.placeIds.length >= 2 && c.hull)
      .map(({ c, color }) => ({
        type: 'Feature' as const,
        geometry: c.hull!,
        properties: {
          id: c.id,
          count: c.placeIds.length,
          isExcursion: c.isExcursion,
          color: uiMode === 'dark' ? color.dark : color.light,
        },
      })),
  }),
)
