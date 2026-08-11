import type { Trip } from '../../shared/types/trip'
import { computeTripTimeline } from './timeline'

// Minimal RFC 5545 calendar export — one timed VEVENT per stop, in the
// destination's local wall clock (floating time, no TZID: an itinerary's
// "2 PM" means 2 PM where you are). Good enough to drop a trip into any
// calendar app; the times come from the standalone timeline.

function pad(n: number): string { return String(n).padStart(2, '0') }

function dtFloating(isoDate: string, minutes: number): string {
  const [y, m, d] = isoDate.split('-')
  const hh = Math.floor(minutes / 60) % 24
  const mm = Math.round(minutes % 60)
  return `${y}${m}${d}T${pad(hh)}${pad(mm)}00`
}

// Escape per RFC 5545 §3.3.11 (backslash, semicolon, comma, newline).
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/([;,])/g, '\\$1').replace(/\r?\n/g, '\\n')
}

export function tripToIcs(trip: Trip): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Junro//Trip Planner//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(trip.name || trip.destination.name)}`,
  ]

  for (const day of computeTripTimeline(trip)) {
    for (const stop of day.stops) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${stop.placeId}@junro`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${dtFloating(day.date, stop.arrivalMin)}`,
        `DTEND:${dtFloating(day.date, stop.departureMin)}`,
        `SUMMARY:${esc(stop.name)}`,
        `LOCATION:${esc(stop.address ?? `${stop.coord[1]},${stop.coord[0]}`)}`,
        `GEO:${stop.coord[1]};${stop.coord[0]}`,
      )
      if (stop.notes) lines.push(`DESCRIPTION:${esc(stop.notes)}`)
      lines.push('END:VEVENT')
    }
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
