import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { TravelMode } from '../../shared/types/trip'

// Derived planning state — clusters, routes, matrices (PROJECT_PLAN.md §5.2).
// NEVER persisted: Directions responses may not be stored (Mapbox ToS, §6),
// and this slice is deliberately absent from both the prefs writer in
// store.ts and the TripStorage document.

export interface RouteGeometry {
  type: 'LineString'
  coordinates: [number, number][]
}

export interface DayRoute {
  hash: string                 // content hash of (ordered coords + mode)
  geometry: RouteGeometry
  legSeconds: number[]
  totalSeconds: number
  mode: TravelMode
}

interface RouteStatus {
  hash: string
  state: 'loading' | 'error'
}

interface PlannerState {
  dayRoutes: Record<string, DayRoute>
  routeStatus: Record<string, RouteStatus>
}

const initialState: PlannerState = {
  dayRoutes: {},
  routeStatus: {},
}

const plannerSlice = createSlice({
  name: 'planner',
  initialState,
  reducers: {
    routeRequested(state, action: PayloadAction<{ dayId: string; hash: string }>) {
      state.routeStatus[action.payload.dayId] = { hash: action.payload.hash, state: 'loading' }
    },

    routeReady(state, action: PayloadAction<{ dayId: string } & DayRoute>) {
      const { dayId, ...route } = action.payload
      state.dayRoutes[dayId] = route
      delete state.routeStatus[dayId]
    },

    // A failed day keeps its status (with the hash that failed) so the
    // listener doesn't retry in a loop; the rail just shows stops without
    // times and the map draws nothing for that day.
    routeFailed(state, action: PayloadAction<{ dayId: string; hash: string }>) {
      state.routeStatus[action.payload.dayId] = { hash: action.payload.hash, state: 'error' }
      delete state.dayRoutes[action.payload.dayId]
    },

    // Days that no longer need a route at all (deleted, or down to <2 coords).
    routesDropped(state, action: PayloadAction<string[]>) {
      for (const dayId of action.payload) {
        delete state.dayRoutes[dayId]
        delete state.routeStatus[dayId]
      }
    },
  },
})

export const { routeRequested, routeReady, routeFailed, routesDropped } = plannerSlice.actions
export default plannerSlice.reducer
