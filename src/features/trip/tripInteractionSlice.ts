import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

// Ephemeral map/UI interaction state — never persisted.
interface TripInteractionState {
  hoveredPlaceId: string | null
  selectedPlaceId: string | null
  selectedDayId: string | null
}

const initialState: TripInteractionState = {
  hoveredPlaceId: null,
  selectedPlaceId: null,
  selectedDayId: null,
}

const tripInteractionSlice = createSlice({
  name: 'tripInteraction',
  initialState,
  reducers: {
    setHoveredPlace(state, action: PayloadAction<string | null>) {
      state.hoveredPlaceId = action.payload
    },
    setSelectedPlace(state, action: PayloadAction<string | null>) {
      state.selectedPlaceId = action.payload
    },
    setSelectedDay(state, action: PayloadAction<string | null>) {
      state.selectedDayId = action.payload
    },
  },
})

export const { setHoveredPlace, setSelectedPlace, setSelectedDay } = tripInteractionSlice.actions
export default tripInteractionSlice.reducer
