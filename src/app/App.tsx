import 'mapbox-gl/dist/mapbox-gl.css'
import { MapView } from '../features/map/engine/MapView'
import { ModeToggle } from '../features/shell/ModeToggle'
import { TripGate } from '../features/trip/TripGate'
import { AddPlace } from '../features/trip/AddPlace'
import { Scrapbook } from '../features/trip/Scrapbook'
import { PlacePanel } from '../features/trip/PlacePanel'

function App() {
  return (
    <div className="map-container">
      <MapView>
        <ModeToggle />
        <TripGate />
        <AddPlace />
        <Scrapbook />
        <PlacePanel />
      </MapView>
    </div>
  )
}

export default App
