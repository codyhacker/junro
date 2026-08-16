import 'mapbox-gl/dist/mapbox-gl.css'
import { MapView } from '../features/map/engine/MapView'
import { ModeToggle } from '../features/shell/ModeToggle'
import { AuthButton } from '../features/auth/AuthButton'
import { TripGate } from '../features/trip/TripGate'
import { AddPlace } from '../features/trip/AddPlace'
import { PlanningPanel } from '../features/trip/PlanningPanel'
import { PlacePanel } from '../features/trip/PlacePanel'
import { UndoBar } from '../features/trip/UndoBar'
import { SyncConflictBanner } from '../features/trip/SyncConflictBanner'
import { ItineraryView } from '../features/viewer/ItineraryView'
import { TodayView } from '../features/viewer/TodayView'

function App() {
  // Viewer mode is a distinct, read-only entry (no map engine — works
  // token-less and offline; the basis for the future public share page).
  const view = new URLSearchParams(window.location.search).get('view')
  if (view === 'itinerary') return <ItineraryView />
  if (view === 'today') return <TodayView />

  return (
    <div className="map-container">
      <MapView>
        <ModeToggle />
        <AuthButton />
        <TripGate />
        {/* Left column — search heads it; the tabbed planning panel follows
            (UX_PLAN round 2: Places · Plan · Trip). */}
        <div className="left-panel">
          <AddPlace />
          <PlanningPanel />
        </div>
        <PlacePanel />
        <div className="top-right-stack">
          <SyncConflictBanner />
          <UndoBar />
        </div>
      </MapView>
    </div>
  )
}

export default App
