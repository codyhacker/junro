import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { UiMode } from '../../shared/constants/uiThemes'
import { loadPersisted } from '../../app/persist'

interface MapStyleState {
  uiMode: UiMode
}

const initialState: MapStyleState = {
  uiMode: 'light',
  ...loadPersisted<MapStyleState>('mapStyle'),
}

const mapStyleSlice = createSlice({
  name: 'mapStyle',
  initialState,
  reducers: {
    setUiMode(state, action: PayloadAction<UiMode>) {
      state.uiMode = action.payload
    },
    toggleUiMode(state) {
      state.uiMode = state.uiMode === 'dark' ? 'light' : 'dark'
    },
  },
})

export const { setUiMode, toggleUiMode } = mapStyleSlice.actions
export default mapStyleSlice.reducer
