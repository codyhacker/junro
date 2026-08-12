import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

// Shell chrome state. The planning panel is a tabbed surface — Places (the
// place-collector home), Plan (opt-in day organizing), Trip (dates/hotels/
// export config). Places is the default so the app starts simple.
export type PanelTab = 'places' | 'plan' | 'trip'

interface UIState {
  activeTab: PanelTab
}

const initialState: UIState = {
  activeTab: 'places',
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveTab(state, action: PayloadAction<PanelTab>) {
      state.activeTab = action.payload
    },
  },
})

export const { setActiveTab } = uiSlice.actions
export default uiSlice.reducer
