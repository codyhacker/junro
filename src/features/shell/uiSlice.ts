import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

// Shell chrome open/closed state. Grows with the planning rail + scrapbook
// in Phase 1 — keep this slice free of trip data (that lives in `trip`).
interface UIState {
  scrapbookOpen: boolean
}

const initialState: UIState = {
  scrapbookOpen: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setScrapbookOpen(state, action: PayloadAction<boolean>) {
      state.scrapbookOpen = action.payload
    },
  },
})

export const { setScrapbookOpen } = uiSlice.actions
export default uiSlice.reducer
