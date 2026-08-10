import 'mapbox-gl/dist/mapbox-gl.css'
import { MapView } from '../features/map/engine/MapView'
import { ModeToggle } from '../features/shell/ModeToggle'

function App() {
  return (
    <div className="map-container">
      <MapView>
        <ModeToggle />
      </MapView>
    </div>
  )
}

export default App
