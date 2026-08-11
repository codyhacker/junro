import type { AppStore } from '../../app/store'
import type { Trip } from '../../shared/types/trip'
import { migrateTrip } from '../trip/storage'
import { tripLoaded } from '../trip/tripSlice'
import { flyTo } from '../map/cameraSlice'
import { tripToIcs } from './ics'

// Export / import a trip. JSON is the portable document (the whole point of the
// local-first design — carry a trip between devices before the backend exists);
// .ics drops the itinerary into any calendar app.

function slug(name: string): string {
  return (name.trim() || 'trip').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trip'
}

function download(filename: string, mime: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadTripJson(trip: Trip): void {
  download(`${slug(trip.name)}.junro.json`, 'application/json', JSON.stringify(trip, null, 2))
}

export function downloadTripIcs(trip: Trip): void {
  download(`${slug(trip.name)}.ics`, 'text/calendar;charset=utf-8', tripToIcs(trip))
}

// Parse + validate an exported JSON document. Returns null if it isn't a trip
// (or was written by a newer schema). migrateTrip owns the schema-version
// judgment; we add a structural guard because this is the one untrusted entry
// point (a user could drop in any .json), and migrateTrip alone would wave a
// schema-less object through as "current".
export function parseTripJson(text: string): Trip | null {
  try {
    const trip = migrateTrip(JSON.parse(text))
    if (
      !trip ||
      typeof trip.id !== 'string' ||
      !trip.destination?.center ||
      !Array.isArray(trip.places) ||
      !Array.isArray(trip.days) ||
      !Array.isArray(trip.lodgings)
    ) return null
    return trip
  } catch {
    return null
  }
}

// Load an imported trip as active; the persistence listener saves it and the
// camera flies to its destination. Returns false if the file wasn't valid.
export function importTripJson(store: AppStore, text: string): boolean {
  const trip = parseTripJson(text)
  if (!trip) return false
  store.dispatch(tripLoaded(trip))
  store.dispatch(flyTo({ center: trip.destination.center, zoom: 11.5, duration: 0 }))
  return true
}
