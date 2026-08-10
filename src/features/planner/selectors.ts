import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'
import type { TravelMode } from '../../shared/types/trip'
import { DEFAULT_PREFS } from '../../shared/types/trip'
import { dayCoords, selectDays, selectLodgings, selectPlaces } from '../trip/selectors'
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
      .map(day => {
        const coords = dayCoords(day, places, lodgings)
        const mode = day.travelMode ?? tripMode
        return { dayId: day.id, coords, mode, hash: routeHash(coords, mode) }
      })
      // A day needs at least an origin and a destination to be routable.
      .filter(req => req.coords.length >= 2),
)

export const selectRequestByDayId = createSelector([selectDayRouteRequests], (requests) =>
  new Map(requests.map(r => [r.dayId, r])),
)
