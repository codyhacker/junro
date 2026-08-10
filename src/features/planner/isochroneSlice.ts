import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { FeatureCollection, Polygon } from 'geojson'

// Reachability-shading UI state — never persisted (the polygons are a derived
// API cache, and the toggle is ephemeral view state).
interface IsochroneState {
  visible: boolean
  key: string | null                         // isochroneKey of the loaded data
  data: FeatureCollection<Polygon> | null
}

const initialState: IsochroneState = { visible: false, key: null, data: null }

const isochroneSlice = createSlice({
  name: 'isochrone',
  initialState,
  reducers: {
    setIsochroneVisible(state, action: PayloadAction<boolean>) {
      state.visible = action.payload
      if (!action.payload) { state.data = null; state.key = null }
    },
    isochroneLoaded(state, action: PayloadAction<{ key: string; data: FeatureCollection<Polygon> }>) {
      state.key = action.payload.key
      state.data = action.payload.data
    },
    isochroneCleared(state) {
      state.data = null
      state.key = null
    },
  },
})

export const { setIsochroneVisible, isochroneLoaded, isochroneCleared } = isochroneSlice.actions
export default isochroneSlice.reducer
