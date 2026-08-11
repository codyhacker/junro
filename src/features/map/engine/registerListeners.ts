import { startAppListening } from '../../../app/listenerMiddleware'
import { setUiMode, toggleUiMode } from '../styleSlice'
import { selectAugmentationSpec } from './styleAugmentation'
import { flyTo, fitBounds } from '../cameraSlice'
import type { MapEngine } from './MapEngine'

export function registerMapListeners(engine: MapEngine): () => void {
  const unsubs: (() => void)[] = []

  unsubs.push(startAppListening({
    predicate: (_action, currentState, previousState) =>
      selectAugmentationSpec(currentState) !== selectAugmentationSpec(previousState),
    effect: (_action, api) => {
      engine.execute({ type: 'STYLE_RECONCILE', spec: selectAugmentationSpec(api.getState()) })
    },
  }))

  // Mode flip — listen on either action so both the toggle button and any
  // future explicit setter route through the same command.
  unsubs.push(startAppListening({
    predicate: (action) => setUiMode.match(action) || toggleUiMode.match(action),
    effect: (_action, api) => {
      engine.execute({ type: 'UI_THEME_CHANGE', mode: api.getState().mapStyle.uiMode })
    },
  }))

  unsubs.push(startAppListening({
    actionCreator: flyTo,
    effect: (action) => {
      engine.execute({ type: 'FLY_TO', options: action.payload })
    },
  }))

  unsubs.push(startAppListening({
    actionCreator: fitBounds,
    effect: (action) => {
      engine.execute({ type: 'FIT_BOUNDS', bounds: action.payload.bounds, options: action.payload })
    },
  }))

  // ── Trip place interaction → feature-state ────────────────────────────
  unsubs.push(startAppListening({
    predicate: (_action, currentState, previousState) =>
      currentState.tripInteraction.hoveredPlaceId !== previousState.tripInteraction.hoveredPlaceId,
    effect: (_action, api) => {
      engine.execute({ type: 'PLACE_HOVER', placeId: api.getState().tripInteraction.hoveredPlaceId })
    },
  }))

  unsubs.push(startAppListening({
    predicate: (_action, currentState, previousState) =>
      currentState.tripInteraction.selectedPlaceId !== previousState.tripInteraction.selectedPlaceId,
    effect: (_action, api) => {
      engine.execute({ type: 'PLACE_SELECT', placeId: api.getState().tripInteraction.selectedPlaceId })
    },
  }))

  // Selecting a day frames it — stops plus the lodging that anchors it.
  unsubs.push(startAppListening({
    predicate: (_action, currentState, previousState) =>
      currentState.tripInteraction.selectedDayId !== previousState.tripInteraction.selectedDayId,
    effect: (_action, api) => {
      engine.execute({ type: 'DAY_FOCUS', dayId: api.getState().tripInteraction.selectedDayId })
    },
  }))

  // Fly-the-day: flyDayId → START/STOP the camera walk. A programmatic STOP
  // restores the camera; gesture-cancel already stopped without restoring.
  unsubs.push(startAppListening({
    predicate: (_action, currentState, previousState) =>
      currentState.tripInteraction.flyDayId !== previousState.tripInteraction.flyDayId,
    effect: (_action, api) => {
      const dayId = api.getState().tripInteraction.flyDayId
      if (dayId) engine.execute({ type: 'START_FLY_DAY', dayId })
      else engine.execute({ type: 'STOP_FLY_DAY', restoreCamera: true })
    },
  }))

  return () => unsubs.forEach(u => u())
}
