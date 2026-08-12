import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

// Whether the Overture discovery layer is drawn. Ephemeral UI state — the layer
// itself is a static external tileset, so nothing here is persisted.
interface DiscoveryState {
  visible: boolean
}

// Opt-in: the layer is dense (millions of POIs), so it stays off until the
// user turns on Discover (the toggle lives in the Places tab). Keeps the
// default view quiet, in line with the muted basemap.
const initialState: DiscoveryState = {
  visible: false,
}

const discoverySlice = createSlice({
  name: 'discovery',
  initialState,
  reducers: {
    setDiscoveryVisible(state, action: PayloadAction<boolean>) {
      state.visible = action.payload
    },
  },
})

export const { setDiscoveryVisible } = discoverySlice.actions
export default discoverySlice.reducer
