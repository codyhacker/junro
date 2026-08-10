import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './app/store'
import App from './app/App'
import './index.css'
import { applyUiTheme, getPalette } from './shared/constants/uiThemes'

// Apply the persisted mode to :root before first paint so the chrome never
// flashes the CSS default palette when the stored mode is dark.
applyUiTheme(getPalette(store.getState().mapStyle.uiMode))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
)
