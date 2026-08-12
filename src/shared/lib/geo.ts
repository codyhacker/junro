// Local geometry helpers — no API calls, no map. Used for the rough transit
// hint (PROJECT_PLAN.md §1 assumption 4 / §7 Stage 3) and anywhere else a
// straight-line distance is honest enough.

const EARTH_RADIUS_KM = 6371.0088

const toRad = (deg: number) => (deg * Math.PI) / 180

// Initial great-circle bearing from a → b, in degrees clockwise from north.
// Used to orient the camera tangent to a route during the "fly the day" walk.
export function bearingDeg(a: [number, number], b: [number, number]): number {
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const dLng = toRad(b[0] - a[0])
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// Great-circle distance between two [lng, lat] pairs, in kilometres.
export function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Rough transit hint. Mapbox has no transit profile and real routing means
// OTP/GTFS (Phase 6), so a cross-town leg gets an honest, clearly-labeled
// estimate instead of reading as an 80-minute walk: crow-flies at 25 km/h
// plus 12 minutes of walking-to-the-stop-and-waiting overhead.
//
// Display-only — it never enters routing, the matrix, or the ordering.
export const TRANSIT_HINT_MIN_KM = 1.5
export const TRANSIT_SPEED_KMH = 25
export const TRANSIT_OVERHEAD_MIN = 12

// Minutes for a leg, or null when the leg is short enough that walking is
// simply the answer.
export function roughTransitMinutes(distanceKm: number): number | null {
  if (!(distanceKm > TRANSIT_HINT_MIN_KM)) return null
  return Math.round((distanceKm / TRANSIT_SPEED_KMH) * 60 + TRANSIT_OVERHEAD_MIN)
}
