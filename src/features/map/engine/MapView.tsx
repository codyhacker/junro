import { useEffect, useRef, useState } from 'react'
import { useStore } from 'react-redux'
import { MapEngine } from './MapEngine'
import { MapEngineContext } from './MapEngineContext'
import { registerMapListeners } from './registerListeners'
import type { AppStore } from '../../../app/store'

interface MapViewProps {
  children: React.ReactNode
}

const HAS_TOKEN = Boolean(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN)

export function MapView({ children }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [engine, setEngine] = useState<MapEngine | null>(null)
  // Mapbox GL throws from its constructor when the token is missing/invalid;
  // without this guard that error crashes the whole app to a white screen
  // (children are gated on `engine`). Degrade to a message instead.
  const [failed, setFailed] = useState(false)
  const store = useStore() as AppStore

  useEffect(() => {
    if (!containerRef.current || !HAS_TOKEN) return

    let eng: MapEngine
    try {
      eng = new MapEngine(containerRef.current, store)
    } catch (err) {
      console.error('Map failed to initialize', err)
      setFailed(true)
      return
    }
    const unregister = registerMapListeners(eng)
    // Replay a camera command dispatched before the engine existed (boot
    // hydration flies to the trip destination; the listener wasn't
    // registered yet to hear it).
    const pendingFlyTo = store.getState().camera.lastFlyTo
    if (pendingFlyTo) eng.execute({ type: 'FLY_TO', options: pendingFlyTo })
    setEngine(eng)

    return () => {
      unregister()
      eng.destroy()
      setEngine(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MapEngineContext.Provider value={engine}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {engine && children}
      {(!HAS_TOKEN || failed) && (
        <div className="map-unavailable">
          <div className="map-unavailable-card">
            <div className="map-unavailable-mark">🗺️</div>
            <h1>Map unavailable</h1>
            <p>Junro needs a Mapbox access token to render the map.</p>
            <p className="map-unavailable-hint">
              Set <code>VITE_MAPBOX_ACCESS_TOKEN</code> and redeploy.
            </p>
          </div>
        </div>
      )}
    </MapEngineContext.Provider>
  )
}
