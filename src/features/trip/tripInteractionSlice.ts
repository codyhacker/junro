import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { PlaceCategory } from '../../shared/types/trip'

// The place being previewed in the add flow — shown on the map before it's
// saved, so you can see where it'll land.
export interface PendingPlace {
  coord: [number, number]
  category: PlaceCategory
}

// A place handed to the add flow from outside AddPlace (a discovery-layer tap),
// so a map click opens the same confirm card as a search pick. AddPlace adopts
// it and clears it.
export interface AddCandidate {
  name: string
  coord: [number, number]
  address?: string
  category: PlaceCategory
}

// A suggestion-preview day being highlighted on the map, in that day's
// prospective color — set when a SuggestDays row is clicked, cleared on
// dismiss/apply/re-suggest/unmount.
export interface PreviewHighlight {
  placeIds: string[]
  color: string
}

// Ephemeral map/UI interaction state — never persisted.
interface TripInteractionState {
  hoveredPlaceId: string | null
  selectedPlaceId: string | null
  selectedDayId: string | null
  flyDayId: string | null // day whose route is being camera-walked
  pendingPlace: PendingPlace | null
  addCandidate: AddCandidate | null
  previewHighlight: PreviewHighlight | null
}

const initialState: TripInteractionState = {
  hoveredPlaceId: null,
  selectedPlaceId: null,
  selectedDayId: null,
  flyDayId: null,
  pendingPlace: null,
  addCandidate: null,
  previewHighlight: null,
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
    setFlyDay(state, action: PayloadAction<string | null>) {
      state.flyDayId = action.payload
    },
    setPendingPlace(state, action: PayloadAction<PendingPlace | null>) {
      state.pendingPlace = action.payload
    },
    setAddCandidate(state, action: PayloadAction<AddCandidate | null>) {
      state.addCandidate = action.payload
    },
    setPreviewHighlight(state, action: PayloadAction<PreviewHighlight | null>) {
      state.previewHighlight = action.payload
    },
  },
})

export const {
  setHoveredPlace,
  setSelectedPlace,
  setSelectedDay,
  setFlyDay,
  setPendingPlace,
  setAddCandidate,
  setPreviewHighlight,
} = tripInteractionSlice.actions
export default tripInteractionSlice.reducer
