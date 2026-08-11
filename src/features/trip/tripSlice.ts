import { createSlice, current, type PayloadAction } from '@reduxjs/toolkit'
import type { Trip, TripSummary, SavedPlace, PlaceCategory, Lodging, TravelMode } from '../../shared/types/trip'
import { DEFAULT_PREFS, DEFAULT_DWELL_MIN } from '../../shared/types/trip'
import { TRIP_SCHEMA_VERSION } from './storage'
import { uuidv7 } from '../../shared/lib/uuidv7'
import { materializeDays } from './days'

interface TripState {
  hydrated: boolean            // storage read finished (even if empty)
  summaries: TripSummary[]
  active: Trip | null
}

const initialState: TripState = {
  hydrated: false,
  summaries: [],
  active: null,
}

function touch(trip: Trip): void {
  trip.updatedAt = new Date().toISOString()
}

// Re-runs the day reconcile against the trip's current dates + lodgings.
// Every date/lodging edit goes through here so `days` is never stale and
// lodging resolution is never hand-maintained. Orphaned stops simply stop
// being referenced by a day — that *is* "back in the scrapbook".
function reconcileDays(trip: Trip): void {
  const snapshot = current(trip)
  trip.days = materializeDays(
    snapshot.days,
    snapshot.startDate,
    snapshot.endDate,
    snapshot.lodgings,
  ).days
}

const tripSlice = createSlice({
  name: 'trip',
  initialState,
  reducers: {
    // Load a full trip document (from JSON import) as the active trip. The
    // persistence listener saves it; migrateTrip has already validated it.
    tripLoaded(state, action: PayloadAction<Trip>) {
      state.active = action.payload
    },

    tripHydrated(state, action: PayloadAction<{ summaries: TripSummary[]; active: Trip | null }>) {
      state.hydrated = true
      state.summaries = action.payload.summaries
      state.active = action.payload.active
    },

    createTrip: {
      prepare(input: { name: string; destination: Trip['destination'] }) {
        const now = new Date().toISOString()
        const trip: Trip = {
          id: uuidv7(),
          schemaVersion: TRIP_SCHEMA_VERSION,
          name: input.name,
          destination: input.destination,
          lodgings: [],
          places: [],
          days: [],
          prefs: { ...DEFAULT_PREFS },
          createdAt: now,
          updatedAt: now,
        }
        return { payload: trip }
      },
      reducer(state, action: PayloadAction<Trip>) {
        state.active = action.payload
      },
    },

    addPlace: {
      prepare(input: {
        name: string
        coord: [number, number]
        category: PlaceCategory
        address?: string
        notes?: string
      }) {
        const place: SavedPlace = {
          id: uuidv7(),
          name: input.name,
          coord: input.coord,
          category: input.category,
          address: input.address,
          notes: input.notes,
          dwellMin: DEFAULT_DWELL_MIN[input.category],
          priority: 'nice',
          source: 'user',
        }
        return { payload: place }
      },
      reducer(state, action: PayloadAction<SavedPlace>) {
        if (!state.active) return
        state.active.places.push(action.payload)
        touch(state.active)
      },
    },

    updatePlace(state, action: PayloadAction<{ id: string; patch: Partial<Omit<SavedPlace, 'id'>> }>) {
      if (!state.active) return
      const place = state.active.places.find(p => p.id === action.payload.id)
      if (!place) return
      Object.assign(place, action.payload.patch)
      touch(state.active)
    },

    removePlace(state, action: PayloadAction<string>) {
      if (!state.active) return
      state.active.places = state.active.places.filter(p => p.id !== action.payload)
      for (const day of state.active.days) {
        day.stopIds = day.stopIds.filter(id => id !== action.payload)
      }
      touch(state.active)
    },

    // ── Dates & days ───────────────────────────────────────────────────────
    // Both dates are optional until both are set; days materialize the moment
    // they both exist (PROJECT_PLAN.md §2 principle 5). Shrinking the range
    // orphans stops — the UI confirms before dispatching this.
    setTripDates(state, action: PayloadAction<{ startDate?: string; endDate?: string }>) {
      if (!state.active) return
      state.active.startDate = action.payload.startDate || undefined
      state.active.endDate = action.payload.endDate || undefined
      reconcileDays(state.active)
      touch(state.active)
    },

    // ── Lodging ────────────────────────────────────────────────────────────
    addLodging: {
      prepare(input: { name: string; coord: [number, number]; checkIn: string; checkOut: string }) {
        return { payload: { id: uuidv7(), ...input } satisfies Lodging }
      },
      reducer(state, action: PayloadAction<Lodging>) {
        if (!state.active) return
        state.active.lodgings.push(action.payload)
        reconcileDays(state.active)
        touch(state.active)
      },
    },

    updateLodging(state, action: PayloadAction<{ id: string; patch: Partial<Omit<Lodging, 'id'>> }>) {
      if (!state.active) return
      const lodging = state.active.lodgings.find(l => l.id === action.payload.id)
      if (!lodging) return
      Object.assign(lodging, action.payload.patch)
      reconcileDays(state.active)
      touch(state.active)
    },

    removeLodging(state, action: PayloadAction<string>) {
      if (!state.active) return
      state.active.lodgings = state.active.lodgings.filter(l => l.id !== action.payload)
      reconcileDays(state.active)
      touch(state.active)
    },

    // ── Stop assignment ────────────────────────────────────────────────────
    // A stop belongs to at most one day: assigning removes it everywhere else,
    // and `dayId: null` is "return to the scrapbook".
    assignStop(state, action: PayloadAction<{ placeId: string; dayId: string | null }>) {
      if (!state.active) return
      const { placeId, dayId } = action.payload
      for (const day of state.active.days) {
        day.stopIds = day.stopIds.filter(id => id !== placeId)
      }
      if (dayId) state.active.days.find(d => d.id === dayId)?.stopIds.push(placeId)
      touch(state.active)
    },

    // ── Travel mode ────────────────────────────────────────────────────────
    // Trip default; a day may override it (excursion days want driving).
    setTravelMode(state, action: PayloadAction<TravelMode>) {
      if (!state.active) return
      state.active.prefs.travelMode = action.payload
      touch(state.active)
    },

    setDayTravelMode(state, action: PayloadAction<{ dayId: string; mode: TravelMode | null }>) {
      if (!state.active) return
      const day = state.active.days.find(d => d.id === action.payload.dayId)
      if (!day) return
      if (action.payload.mode) day.travelMode = action.payload.mode
      else delete day.travelMode
      touch(state.active)
    },

    // Bulk-set a day's ordered stops — used by "Suggest days" apply. Each id
    // is first removed from every other day (a place lives on one day), then
    // the target day's list becomes exactly `placeIds` in the given order.
    // Locked days are never touched.
    setDayStops(state, action: PayloadAction<{ dayId: string; placeIds: string[] }>) {
      if (!state.active) return
      const target = state.active.days.find(d => d.id === action.payload.dayId)
      if (!target || target.locked) return
      const claimed = new Set(action.payload.placeIds)
      for (const day of state.active.days) {
        if (day.id !== action.payload.dayId) day.stopIds = day.stopIds.filter(id => !claimed.has(id))
      }
      target.stopIds = [...action.payload.placeIds]
      touch(state.active)
    },

    // Atomic apply of a "Suggest days" plan — all days in one action so a
    // single undo reverses the whole suggestion (PROJECT_PLAN.md §8 Phase 5).
    applyDaySuggestions(
      state,
      action: PayloadAction<{ dayId: string; placeIds: string[]; travelMode?: TravelMode }[]>,
    ) {
      if (!state.active) return
      for (const a of action.payload) {
        const target = state.active.days.find(d => d.id === a.dayId)
        if (!target || target.locked) continue
        const claimed = new Set(a.placeIds)
        for (const day of state.active.days) {
          if (day.id !== a.dayId) day.stopIds = day.stopIds.filter(id => !claimed.has(id))
        }
        target.stopIds = [...a.placeIds]
        if (a.travelMode) target.travelMode = a.travelMode
      }
      touch(state.active)
    },

    moveStop(state, action: PayloadAction<{ dayId: string; placeId: string; delta: -1 | 1 }>) {
      if (!state.active) return
      const day = state.active.days.find(d => d.id === action.payload.dayId)
      if (!day) return
      const from = day.stopIds.indexOf(action.payload.placeId)
      const to = from + action.payload.delta
      if (from < 0 || to < 0 || to >= day.stopIds.length) return
      const [moved] = day.stopIds.splice(from, 1)
      day.stopIds.splice(to, 0, moved)
      touch(state.active)
    },
  },
})

export const {
  tripHydrated, tripLoaded, createTrip, addPlace, updatePlace, removePlace,
  setTripDates, addLodging, updateLodging, removeLodging, assignStop, moveStop,
  setDayStops, applyDaySuggestions, setTravelMode, setDayTravelMode,
} = tripSlice.actions
export default tripSlice.reducer
