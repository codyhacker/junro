import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'
import type { Day, Lodging, SavedPlace } from '../../shared/types/trip'
import { dayHexAt } from '../../shared/constants/dayColors'

// Derived views over the trip document. Lives in the trip feature (not the
// engine) so the augmentation selector and the rail read the same joins.

const NO_DAYS: Day[] = []
const NO_PLACES: SavedPlace[] = []
const NO_LODGINGS: Lodging[] = []

export const selectDays = (s: RootState): Day[] => s.trip.active?.days ?? NO_DAYS
export const selectPlaces = (s: RootState): SavedPlace[] => s.trip.active?.places ?? NO_PLACES
export const selectLodgings = (s: RootState): Lodging[] => s.trip.active?.lodgings ?? NO_LODGINGS

// placeId → the hex of the day it's assigned to. Unassigned places are absent,
// which is what makes "no ring" the natural default on the map.
export const selectPlaceDayHex = createSelector(
  [selectDays, (s: RootState) => s.mapStyle.uiMode],
  (days, mode) => {
    const byPlace: Record<string, string> = {}
    days.forEach((day, i) => {
      const hex = dayHexAt(i, mode)
      for (const id of day.stopIds) byPlace[id] = hex
    })
    return byPlace
  },
)

export const selectAssignedPlaceIds = createSelector([selectDays], (days) =>
  new Set(days.flatMap(d => d.stopIds)),
)

// The scrapbook proper: everything not yet on a day.
export const selectUnassignedPlaces = createSelector(
  [selectPlaces, selectAssignedPlaceIds],
  (places, assigned) => places.filter(p => !assigned.has(p.id)),
)

// Ordered coords for a day's route/camera: [lodging, ...stops, lodging].
// Days without a lodging are just the stops (no loop to close).
export function dayCoords(day: Day, places: SavedPlace[], lodgings: Lodging[]): [number, number][] {
  const byId = new Map(places.map(p => [p.id, p]))
  const stops = day.stopIds.map(id => byId.get(id)).filter((p): p is SavedPlace => p !== undefined)
  const lodging = lodgings.find(l => l.id === day.lodgingId)
  const coords = stops.map(p => p.coord)
  return lodging ? [lodging.coord, ...coords, lodging.coord] : coords
}

// fitBounds payload for DAY_FOCUS — the day's stops plus its lodging.
export function selectDayBounds(
  state: RootState,
  dayId: string,
): [[number, number], [number, number]] | null {
  const day = selectDays(state).find(d => d.id === dayId)
  if (!day) return null
  const coords = dayCoords(day, selectPlaces(state), selectLodgings(state))
  if (coords.length === 0) return null
  const lngs = coords.map(c => c[0])
  const lats = coords.map(c => c[1])
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}
