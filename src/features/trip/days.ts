import type { Day, Lodging } from '../../shared/types/trip'
import { uuidv7 } from '../../shared/lib/uuidv7'

// Day materialization — pure, so the reconcile rules from PROJECT_PLAN.md §4
// ("days are materialized, not virtual"; extend = append, shrink = orphan
// stops back to the scrapbook) are testable without a store or a map.
//
// Dates are ISO calendar days ('YYYY-MM-DD') handled in UTC throughout: a trip
// day is a calendar label, never an instant, so local timezones must not shift
// it across a boundary.

const DAY_MS = 86_400_000

function toUtcMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`)
}

export function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

// Inclusive of both ends — a trip from the 1st to the 3rd is three days.
export function enumerateDates(startDate: string, endDate: string): string[] {
  const start = toUtcMs(startDate)
  const end = toUtcMs(endDate)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return []
  const dates: string[] = []
  for (let ms = start; ms <= end; ms += DAY_MS) dates.push(toIsoDate(ms))
  return dates
}

// A lodging covers [checkIn, checkOut) — you sleep there on check-in night,
// not on the night you check out. First match wins if ranges overlap.
export function resolveLodgingId(date: string, lodgings: Lodging[]): string | null {
  const match = lodgings.find(l => date >= l.checkIn && date < l.checkOut)
  return match ? match.id : null
}

export interface MaterializeResult {
  days: Day[]
  orphanedStopIds: string[]   // stops whose day disappeared — back to the scrapbook
}

// Reconciles the day list against a date range. Existing Day objects are
// reused by date (keeping their stops, lock, and overrides); dates that fall
// out of range have their stops orphaned. Lodging is re-resolved every run so
// editing a hotel's range re-anchors the affected days.
export function materializeDays(
  existing: Day[],
  startDate: string | undefined,
  endDate: string | undefined,
  lodgings: Lodging[],
): MaterializeResult {
  const dates = startDate && endDate ? enumerateDates(startDate, endDate) : []
  const byDate = new Map(existing.map(d => [d.date, d]))

  const days = dates.map(date => {
    const prior = byDate.get(date)
    const lodgingId = resolveLodgingId(date, lodgings)
    if (prior) return prior.lodgingId === lodgingId ? prior : { ...prior, lodgingId }
    return {
      id: uuidv7(),
      date,
      lodgingId,
      stopIds: [],
      locked: false,
    } satisfies Day
  })

  const kept = new Set(dates)
  const orphanedStopIds = existing
    .filter(d => !kept.has(d.date))
    .flatMap(d => d.stopIds)

  return { days, orphanedStopIds }
}
