import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './app/store'
import App from './app/App'
import './index.css'
import { applyUiTheme, getPalette } from './shared/constants/uiThemes'
import { hydrateTrips, registerTripPersistence } from './features/trip/persistence'
import { registerRoutingListeners } from './features/planner/registerRoutingListeners'
import { registerIsochroneListeners } from './features/planner/registerIsochroneListeners'
import { bootAuthSession } from './features/auth/bootAuthSession'
import { registerAuthListeners } from './features/auth/registerAuthListeners'
import {
  registerTripSyncPush,
  registerTripAdoption,
  registerSyncConflictResolution,
  registerSyncPersistence,
} from './features/trip/registerTripSync'
import { bootTripSyncFocusPull } from './features/trip/bootTripSyncFocusPull'

// Apply the persisted mode to :root before first paint so the chrome never
// flashes the CSS default palette when the stored mode is dark.
applyUiTheme(getPalette(store.getState().mapStyle.uiMode))

registerTripPersistence()
registerRoutingListeners()
registerIsochroneListeners()
registerAuthListeners()
registerTripSyncPush()
registerTripAdoption()
registerSyncConflictResolution()
registerSyncPersistence()
void hydrateTrips(store)
bootAuthSession(store)
bootTripSyncFocusPull(store)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
)
