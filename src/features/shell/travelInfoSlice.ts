import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { loadPersisted } from '../../app/persist'

interface TravelInfoState {
  showTravelInfo: boolean
}

const initialState: TravelInfoState = {
  showTravelInfo: true,
  ...loadPersisted<TravelInfoState>('travelInfo'),
}

const travelInfoSlice = createSlice({
  name: 'travelInfo',
  initialState,
  reducers: {
    setShowTravelInfo(state, action: PayloadAction<boolean>) {
      state.showTravelInfo = action.payload
    },
    toggleShowTravelInfo(state) {
      state.showTravelInfo = !state.showTravelInfo
    },
  },
})

export const { setShowTravelInfo, toggleShowTravelInfo } = travelInfoSlice.actions
export default travelInfoSlice.reducer
