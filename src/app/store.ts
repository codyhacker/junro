import { configureStore, combineReducers } from '@reduxjs/toolkit'
import { listenerMiddleware } from './listenerMiddleware'
import { savePersisted } from './persist'
import { withHistory, historyReducer } from '../features/trip/history'

// ── map/ ────────────────────────────────────────────────────────────────────
import mapStyleReducer    from '../features/map/styleSlice'
import terrainReducer     from '../features/map/terrainSlice'
import cameraReducer      from '../features/map/cameraSlice'

// ── shell/ ──────────────────────────────────────────────────────────────────
import uiReducer from '../features/shell/uiSlice'

// ── trip/ ───────────────────────────────────────────────────────────────────
import tripReducer            from '../features/trip/tripSlice'
import tripInteractionReducer from '../features/trip/tripInteractionSlice'

// ── planner/ ────────────────────────────────────────────────────────────────
import plannerReducer   from '../features/planner/plannerSlice'
import isochroneReducer from '../features/planner/isochroneSlice'

// ── discovery/ ──────────────────────────────────────────────────────────────
import discoveryReducer from '../features/discovery/discoverySlice'

// Root reducer is wrapped with the undo/redo history layer, which snapshots
// trip.active on each edit (see features/trip/history.ts).
const combined = combineReducers({
  mapStyle:        mapStyleReducer,
  terrain:         terrainReducer,
  camera:          cameraReducer,
  ui:              uiReducer,
  trip:            tripReducer,
  tripInteraction: tripInteractionReducer,
  planner:         plannerReducer,
  isochrone:       isochroneReducer,
  discovery:       discoveryReducer,
  history:         historyReducer,
})
const rootReducer = withHistory(combined)

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listenerMiddleware.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export type AppStore = typeof store

// Debounced write — coalesces rapid toggles into one write per 400 ms.
let saveTimer: ReturnType<typeof setTimeout> | null = null
store.subscribe(() => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const s = store.getState()
    savePersisted({ mapStyle: s.mapStyle, terrain: s.terrain })
  }, 400)
})
