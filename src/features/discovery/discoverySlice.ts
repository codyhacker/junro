import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import {
  ALL_OVERTURE_GROUPS,
  type OvertureCategoryGroup,
} from '../../shared/constants/overturePlaceCategories'

// Whether the Overture discovery layer is drawn. Ephemeral UI state — the layer
// itself is a static external tileset, so nothing here is persisted.
interface DiscoveryState {
  visible: boolean
  activeGroups: OvertureCategoryGroup[]
}

// Opt-in: the layer is dense (millions of POIs), so it stays off until the
// user turns on Discover (the toggle lives in the Places tab). Keeps the
// default view quiet, in line with the muted basemap.
//
// activeGroups starts with every group active — the drawer opens showing
// everything, and its category chips narrow the filter from there. Copied
// (not a reference to ALL_OVERTURE_GROUPS) because Immer deep-freezes base
// state after the first dispatch, which would freeze the shared module-level
// constant too.
const initialState: DiscoveryState = {
  visible: false,
  activeGroups: [...ALL_OVERTURE_GROUPS],
}

const discoverySlice = createSlice({
  name: 'discovery',
  initialState,
  reducers: {
    setDiscoveryVisible(state, action: PayloadAction<boolean>) {
      state.visible = action.payload
    },
    toggleDiscoveryGroup(state, action: PayloadAction<OvertureCategoryGroup>) {
      const i = state.activeGroups.indexOf(action.payload)
      if (i === -1) state.activeGroups.push(action.payload)
      else state.activeGroups.splice(i, 1)
    },
  },
})

export const { setDiscoveryVisible, toggleDiscoveryGroup } = discoverySlice.actions
export default discoverySlice.reducer
