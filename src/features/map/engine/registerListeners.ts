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

  return () => unsubs.forEach(u => u())
}
