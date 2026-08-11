import type { Map as MapboxMap } from 'mapbox-gl'
import along from '@turf/along'
import { lineString } from '@turf/helpers'
import type { AppStore } from '../../../app/store'
import { setFlyDay } from '../../trip/tripInteractionSlice'
import { bearingDeg, haversineKm } from '../../../shared/lib/geo'

// "Fly the day" — the trip equivalent of silkymaps' trail fly-along. Walks the
// camera along a day's route geometry (from planner.dayRoutes) at a fixed
// wall-clock pace, orienting tangent to the path. Any user gesture cancels it,
// matching the silkymaps contract; a natural finish restores the prior camera.
//
// Lives in the engine (touches only Mapbox GL); it reads the route geometry
// from the store and syncs the flyDay flag back through Redux when it self-stops.

const FLY_ZOOM = 15.4
const FLY_PITCH = 55
const MS_PER_KM = 2400          // pacing
const MIN_MS = 8000
const MAX_MS = 22000
const GESTURES = ['dragstart', 'rotatestart', 'zoomstart', 'pitchstart'] as const

interface Camera { center: [number, number]; zoom: number; bearing: number; pitch: number }

export class RoutePreviewController {
  private raf: number | null = null
  private preCamera: Camera | null = null
  private detach: (() => void) | null = null

  constructor(private map: MapboxMap, private store: AppStore) {}

  private get active(): boolean {
    return this.raf !== null || this.detach !== null
  }

  start(dayId: string): void {
    if (this.active) this.stop({ restoreCamera: false })
    const route = this.store.getState().planner.dayRoutes[dayId]
    const coords = route?.geometry.coordinates as [number, number][] | undefined
    if (!coords || coords.length < 2) {
      // Nothing to fly — clear the flag so the button doesn't stick "on".
      this.store.dispatch(setFlyDay(null))
      return
    }

    const line = lineString(coords)
    let totalKm = 0
    for (let i = 1; i < coords.length; i++) totalKm += haversineKm(coords[i - 1], coords[i])
    if (totalKm === 0) { this.store.dispatch(setFlyDay(null)); return }

    const duration = Math.min(MAX_MS, Math.max(MIN_MS, totalKm * MS_PER_KM))

    const c = this.map.getCenter()
    this.preCamera = { center: [c.lng, c.lat], zoom: this.map.getZoom(), bearing: this.map.getBearing(), pitch: this.map.getPitch() }

    // Cancel on any user-driven camera gesture. The user is now driving, so
    // stop WITHOUT restoring (leave the camera where they grabbed it); then
    // sync the flag. The resulting STOP_FLY_DAY is a no-op (already stopped).
    const onGesture = () => {
      this.stop({ restoreCamera: false })
      this.store.dispatch(setFlyDay(null))
    }
    for (const g of GESTURES) this.map.on(g, onGesture)
    this.detach = () => { for (const g of GESTURES) this.map.off(g, onGesture) }

    const start = performance.now()
    const step = (now: number) => {
      const f = Math.min(1, (now - start) / duration)
      const distKm = f * totalKm
      const here = (along(line, distKm, { units: 'kilometers' }).geometry.coordinates) as [number, number]
      const ahead = (along(line, Math.min(distKm + 0.03, totalKm), { units: 'kilometers' }).geometry.coordinates) as [number, number]
      this.map.jumpTo({ center: here, bearing: bearingDeg(here, ahead), pitch: FLY_PITCH, zoom: FLY_ZOOM })
      if (f < 1) {
        this.raf = requestAnimationFrame(step)
      } else {
        // Natural finish → just clear the flag; the listener's STOP restores
        // the camera. Leave `raf` set so `active` stays true until it does.
        this.store.dispatch(setFlyDay(null))
      }
    }
    this.raf = requestAnimationFrame(step)
  }

  stop({ restoreCamera }: { restoreCamera?: boolean } = {}): void {
    if (!this.active) return
    if (this.raf !== null) { cancelAnimationFrame(this.raf); this.raf = null }
    this.detach?.(); this.detach = null
    const prev = this.preCamera
    this.preCamera = null
    if (restoreCamera && prev) {
      this.map.easeTo({ center: prev.center, zoom: prev.zoom, bearing: prev.bearing, pitch: prev.pitch, duration: 900 })
    }
  }

  destroy(): void {
    this.stop({ restoreCamera: false })
  }
}
