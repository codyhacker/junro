import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Trip, TripSummary, SavedPlace, PlaceCategory } from '../../shared/types/trip'
import { DEFAULT_PREFS, DEFAULT_DWELL_MIN } from '../../shared/types/trip'
import { TRIP_SCHEMA_VERSION } from './storage'
import { uuidv7 } from '../../shared/lib/uuidv7'

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

const tripSlice = createSlice({
  name: 'trip',
  initialState,
  reducers: {
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
  },
})

export const { tripHydrated, createTrip, addPlace, updatePlace, removePlace } = tripSlice.actions
export default tripSlice.reducer
